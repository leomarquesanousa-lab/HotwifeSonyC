import { ManyVidsTiming } from "./timing";
import { createHash } from "node:crypto";

import {
  ManyVidsCookieJar,
  type ManyVidsSessionData,
} from "./session";

import {
  ManyVidsError,
  assertNoRemoteError,
  record,
  type ManyVidsStage,
} from "./types";

export const WEB = "https://www.manyvids.com";

export const API = "https://api.manyvids.com";

export function jsonBody(value: unknown) {
  const body = JSON.stringify(value);

  return {
    body,
    hash: createHash("sha256")
      .update(body)
      .digest("hex"),
  };
}

export class ManyVidsClient {
  private jar: ManyVidsCookieJar;
  private responseStatus: number | undefined;
  get lastResponseStatus() { return this.responseStatus; }

  private readonly deadline =
    Date.now() + 12 * 60_000;

  private confirmationDeadline:
    | number
    | undefined;

  constructor(
    session: ManyVidsSessionData,
    private persist: (
      session: ManyVidsSessionData,
    ) => Promise<void>,
    private transport: typeof fetch = fetch,
    private hardDeadline = Infinity,
    readonly timing = new ManyVidsTiming(),
  ) {
    this.jar = new ManyVidsCookieJar(session);
  }

  transferTimeout(maximum: number) {
    const remaining =
      Math.min(
        this.deadline,
        this.hardDeadline,
      ) - Date.now();

    if (remaining <= 0) {
      throw new ManyVidsError(
        "EXECUTION_TIMEOUT",
        "UPLOAD",
      );
    }

    return Math.min(
      maximum,
      remaining,
    );
  }

  async request(
    host: typeof WEB | typeof API,
    path: string,
    stage: ManyVidsStage,
    init: RequestInit = {},
    jsonRequired = true,
  ): Promise<unknown> {
    this.responseStatus = undefined;
    const url = new URL(path, host);

    if (
      url.origin !== host ||
      url.username ||
      url.password
    ) {
      throw new ManyVidsError(
        "INVALID_API_ORIGIN",
        stage,
      );
    }

    const deadline =
      Math.min(
        this.hardDeadline,
        stage === "CONFIRM"
          ? (
              this.confirmationDeadline ??=
                Date.now() + 5 * 60_000
            )
          : this.deadline,
      );

    if (Date.now() >= deadline) {
      throw new ManyVidsError(
        "EXECUTION_TIMEOUT",
        stage,
      );
    }

    const headers =
      new Headers(init.headers);

    headers.set(
      "Accept",
      "application/json",
    );

    headers.set(
      "Cookie",
      this.jar.header(url),
    );

    if (host === WEB) {
      const xsrf =
        this.jar
          .header(url)
          .split("; ")
          .find((cookie) =>
            cookie.startsWith(
              "XSRF-TOKEN=",
            ),
          )
          ?.slice(11);

      if (xsrf) {
        try {
          headers.set(
            "X-XSRF-TOKEN",
            decodeURIComponent(xsrf),
          );
        } catch {
          headers.set(
            "X-XSRF-TOKEN",
            xsrf,
          );
        }
      }
    }

    headers.set(
      "Origin",
      WEB,
    );

    headers.set(
      "Referer",
      `${WEB}/`,
    );

    let response: Response;
    let text: string;

    try {
      response =
        await this.transport(
          url,
          {
            ...init,
            headers,
            redirect: "manual",
            cache: "no-store",
            signal:
              AbortSignal.timeout(
                Math.max(
                  1,
                  Math.min(
                    60_000,
                    deadline -
                      Date.now(),
                  ),
                ),
              ),
          },
        );

      this.responseStatus = response.status;
      text =
        await response.text();
    } catch {
      throw new ManyVidsError(
        "NETWORK_OR_TIMEOUT",
        stage,
      );
    }

    if (
      this.jar.absorb(
        response.headers,
        url,
      )
    ) {
      await this.persist(
        this.jar.snapshot(),
      );
    }

    if (
      response.status === 401 ||
      response.status === 403 ||
      (
        response.status >= 300 &&
        response.status < 400
      )
    ) {
      const cookieHeader =
        headers.get("Cookie") ?? "";

      const cookieNames =
        cookieHeader
          .split("; ")
          .map((cookie) =>
            cookie
              .split("=", 1)[0]
              ?.trim(),
          )
          .filter(
            (
              name,
            ): name is string =>
              Boolean(name),
          );

      const hasAccessToken =
        cookieHeader
          .split("; ")
          .some((cookie) =>
            cookie.startsWith(
              "mv.access-token=",
            ),
          );

      console.warn(
        "MANYVIDS_REQUEST_REJECTED",
        {
          stage,

          host:
            host === API
              ? "API"
              : "WEB",

          method:
            init.method ?? "GET",

          path:
            url.pathname,

          upstreamStatus:
            response.status,

          server:
            response.headers.get(
              "server",
            ),

          contentType:
            response.headers.get(
              "content-type",
            ),

          via:
            response.headers.get(
              "via",
            ),

          xCache:
            response.headers.get(
              "x-cache",
            ),

          challengeDetected:
            response.headers.get(
              "cf-mitigated",
            ) === "challenge",

          redirectPresent:
            Boolean(
              response.headers.get(
                "location",
              ),
            ),

          apiCookieCount:
            cookieNames.length,

          cookieNames,

          hasAccessToken,

          responseBytes:
            text.length,
        },
      );

      throw new ManyVidsError(
        "SESSION_REJECTED",
        stage,
        409,
      );
    }

    if (!response.ok) {
      throw new ManyVidsError(
        `HTTP_${response.status}`,
        stage,
      );
    }

    const isJson =
      response.headers
        .get("content-type")
        ?.includes("json");

    let data: unknown = text;

    if (
      jsonRequired ||
      isJson
    ) {
      try {
        data =
          JSON.parse(text) as unknown;
      } catch {
        throw new ManyVidsError(
          "INVALID_RESPONSE_JSON",
          stage,
        );
      }
    } else if (
      /^\s*[\[{]/.test(text)
    ) {
      try {
        data =
          JSON.parse(text) as unknown;
      } catch {
        /* Unknown legacy text remains opaque. */
      }
    }

    assertNoRemoteError(
      data,
      stage,
    );

    if (stage === "TEASER") {
      console.info(
        "MANYVIDS_TEASER_RESPONSE_SHAPE",
        {
          kind:
            Array.isArray(data)
              ? "array"
              : data === null
                ? "null"
                : typeof data,

          fieldCount:
            Object.keys(
              record(data),
            ).length,
        },
      );
    }

    return data;
  }

  async json(
    path: string,
    stage: ManyVidsStage,
    value: unknown,
    method = "POST",
  ) {
    const {
      body,
      hash,
    } = jsonBody(value);

    return this.request(
      API,
      path,
      stage,
      {
        method,
        body,
        headers: {
          "Content-Type":
            "application/json",
          ...(path === "/uploader/create" && method === "POST" ? {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36",
            "Accept-Language": "en-US,en;q=0.9",
            "Sec-Fetch-Dest": "empty",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Site": "same-site",
            "Sec-CH-UA": '"Chromium";v="152", "Not?A_Brand";v="24", "Google Chrome";v="152"',
            "Sec-CH-UA-Mobile": "?0",
            "Sec-CH-UA-Platform": '"Windows"',
            "Priority": "u=1, i",
          } : {}),

          ...(
            path.startsWith(
              "/unified-media/",
            ) ||
            path.startsWith(
              "/v1/store/videos",
            )
              ? {
                  "x-amz-content-sha256":
                    hash,
                }
              : {}
          ),
        },
      },
      method !== "PUT",
    );
  }

  async freshToken():
    Promise<string> {
    const body =
      record(
        await this.request(
          WEB,
          "/includes/init_session.php",
          "SESSION",
        ),
      );

    if (
      typeof body.mvtoken !==
        "string" ||
      !body.mvtoken
    ) {
      throw new ManyVidsError(
        "MVTOKEN_MISSING",
        "SESSION",
      );
    }

    return body.mvtoken;
  }

  async form(
    path: string,
    stage: ManyVidsStage,
    body: URLSearchParams,
  ) {
    const token =
      await this.freshToken();

    const fields =
      new URLSearchParams(body);

    fields.set(
      "mvtoken",
      token,
    );

    return this.request(
      WEB,
      `${path}?mvtoken=${encodeURIComponent(
        token,
      )}`,
      stage,
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded; charset=UTF-8",
          "X-Requested-With":
            "XMLHttpRequest",
        },
        body:
          fields.toString(),
      },
      stage !== "TEASER",
    );
  }

  async refresh() {
    return this.timing.measure("SESSION_REFRESH", () => this.request(
      API,
      "/auth/token/v1",
      "SESSION",
    ));
  }
}
