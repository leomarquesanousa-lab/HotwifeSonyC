import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  getCurrentSession,
} from "@/src/lib/auth/session";

type PlatformInput = {
  platformAccountId?: string;
  platform?: string;
  label?: string;
};

type PlatformCaptionsRequest = {
  fileName?: string;
  context?: string;
  language?: string;
  platforms?: PlatformInput[];
};

type OpenAiResponse = {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
  error?: {
    message?: string;
  } | null;
};

function extractOutputText(
  data: OpenAiResponse,
) {
  if (
    typeof data.output_text ===
      "string" &&
    data.output_text.trim()
  ) {
    return data.output_text.trim();
  }

  const parts: string[] = [];

  for (
    const item of data.output ??
    []
  ) {
    for (
      const content of item.content ??
      []
    ) {
      if (
        content.type ===
          "output_text" &&
        typeof content.text ===
          "string"
      ) {
        parts.push(
          content.text,
        );
      }
    }
  }

  return parts
    .join("\n")
    .trim();
}

function normalizeHashtags(
  value: unknown,
) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(
      (
        item,
      ): item is string =>
        typeof item ===
        "string",
    )
    .map(
      (item) => {
        const trimmed =
          item.trim();

        if (!trimmed) {
          return "";
        }

        return trimmed.startsWith(
          "#",
        )
          ? trimmed
          : `#${trimmed.replace(
              /\s+/g,
              "",
            )}`;
      },
    )
    .filter(Boolean)
    .slice(
      0,
      12,
    );
}

export async function POST(
  request: NextRequest,
) {
  try {
    const session =
      await getCurrentSession();

    if (!session) {
      return NextResponse.json(
        {
          success: false,
          error:
            "UNAUTHORIZED",
        },
        {
          status: 401,
        },
      );
    }

    const body =
      (await request.json()) as PlatformCaptionsRequest;

    const fileName =
      body.fileName?.trim();

    const context =
      body.context?.trim() ??
      "";

    const language =
      body.language?.trim() ||
      "en-US";

    const platforms =
      Array.isArray(
        body.platforms,
      )
        ? body.platforms
            .map(
              (item) => ({
                platformAccountId:
                  item.platformAccountId?.trim() ??
                  "",
                platform:
                  item.platform?.trim() ??
                  "",
                label:
                  item.label?.trim() ??
                  item.platform?.trim() ??
                  "",
              }),
            )
            .filter(
              (item) =>
                item.platformAccountId &&
                item.platform,
            )
            .slice(
              0,
              10,
            )
        : [];

    if (
      !fileName ||
      platforms.length ===
        0
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "INVALID_REQUEST",
        },
        {
          status: 400,
        },
      );
    }

    const apiKey =
      process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          error:
            "OPENAI_API_KEY_MISSING",
        },
        {
          status: 500,
        },
      );
    }

    const model =
      process.env.OPENAI_MODEL ||
      "gpt-5.4-mini";

    const platformLines =
      platforms.map(
        (item) =>
          `- ${item.platformAccountId} | ${item.platform} | ${item.label}`,
      );

    const prompt = [
      "Generate platform-specific social-media publishing copy for a creator.",
      "",
      `Video filename: ${fileName}`,
      `Creator context: ${context || "No extra context provided."}`,
      `Language/locale: ${language}`,
      "",
      "Platforms:",
      ...platformLines,
      "",
      "Return ONLY valid JSON in this exact shape:",
      '{"captions":[{"platformAccountId":"...","platform":"INSTAGRAM","caption":"...","hashtags":["#tag1","#tag2"]}]}',
      "",
      "Rules:",
      "- Return exactly one item for every platformAccountId provided.",
      "- Preserve each platformAccountId exactly.",
      "- Adapt writing style and length to the named platform.",
      "- Instagram/Facebook can be conversational and descriptive.",
      "- X should be concise.",
      "- Fanvue and creator subscription platforms can be more direct and promotional without inventing explicit details.",
      "- ManyVids can be title/description oriented and promotional.",
      "- Use only details supported by the filename or creator context.",
      "- Generate 3 to 8 useful hashtags when hashtags fit that platform.",
      "- Avoid duplicate hashtags.",
      "- No markdown fences.",
      "- Keep every caption plus hashtags below 2200 characters.",
    ].join("\n");

    const response =
      await fetch(
        "https://api.openai.com/v1/responses",
        {
          method: "POST",
          headers: {
            Authorization:
              `Bearer ${apiKey}`,
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            model,
            input:
              prompt,
            store:
              false,
            max_output_tokens:
              1400,
          }),
          cache:
            "no-store",
        },
      );

    const data =
      (await response.json()) as OpenAiResponse;

    if (!response.ok) {
      console.error(
        "OPENAI_PLATFORM_CAPTIONS_API_ERROR",
        {
          status:
            response.status,
          message:
            data.error?.message,
        },
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "AI_GENERATION_FAILED",
        },
        {
          status: 502,
        },
      );
    }

    const outputText =
      extractOutputText(
        data,
      );

    if (!outputText) {
      return NextResponse.json(
        {
          success: false,
          error:
            "AI_EMPTY_RESPONSE",
        },
        {
          status: 502,
        },
      );
    }

    const cleaned =
      outputText
        .trim()
        .replace(
          /^```(?:json)?\s*/i,
          "",
        )
        .replace(
          /\s*```$/,
          "",
        );

    const parsed =
      JSON.parse(
        cleaned,
      ) as {
        captions?: Array<{
          platformAccountId?: unknown;
          platform?: unknown;
          caption?: unknown;
          hashtags?: unknown;
        }>;
      };

    const generated =
      Array.isArray(
        parsed.captions,
      )
        ? parsed.captions
        : [];

    const expectedIds =
      new Set(
        platforms.map(
          (item) =>
            item.platformAccountId,
        ),
      );

    const captions =
      generated
        .filter(
          (item) =>
            typeof item.platformAccountId ===
              "string" &&
            expectedIds.has(
              item.platformAccountId,
            ) &&
            typeof item.caption ===
              "string" &&
            item.caption.trim(),
        )
        .map(
          (item) => ({
            platformAccountId:
              item.platformAccountId as string,
            platform:
              typeof item.platform ===
              "string"
                ? item.platform
                : "",
            caption:
              (
                item.caption as string
              )
                .trim()
                .slice(
                  0,
                  2000,
                ),
            hashtags:
              normalizeHashtags(
                item.hashtags,
              ),
          }),
        );

    if (
      captions.length !==
      platforms.length
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "AI_INCOMPLETE_PLATFORM_RESPONSE",
        },
        {
          status: 502,
        },
      );
    }

    return NextResponse.json({
      success: true,
      captions,
    });
  } catch (error) {
    console.error(
      "AI_PLATFORM_CAPTIONS_ROUTE_ERROR",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "AI_GENERATION_FAILED",
      },
      {
        status: 500,
      },
    );
  }
}
