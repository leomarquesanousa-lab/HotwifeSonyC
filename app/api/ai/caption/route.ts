import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  getCurrentSession,
} from "@/src/lib/auth/session";

type AiCaptionRequest = {
  fileName?: string;
  context?: string;
  platforms?: string[];
  language?: string;
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

  return parts.join("\n").trim();
}

function parseAiJson(
  value: string,
) {
  const cleaned =
    value
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
      caption?: unknown;
      hashtags?: unknown;
    };

  const caption =
    typeof parsed.caption ===
    "string"
      ? parsed.caption.trim()
      : "";

  const hashtags =
    Array.isArray(
      parsed.hashtags,
    )
      ? parsed.hashtags
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
          )
      : [];

  if (!caption) {
    throw new Error(
      "AI_CAPTION_EMPTY",
    );
  }

  return {
    caption,
    hashtags,
  };
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
      (await request.json()) as AiCaptionRequest;

    const fileName =
      body.fileName?.trim();

    const context =
      body.context?.trim() ??
      "";

    const platforms =
      Array.isArray(
        body.platforms,
      )
        ? body.platforms
            .filter(
              (
                item,
              ): item is string =>
                typeof item ===
                "string",
            )
            .map(
              (item) =>
                item.trim(),
            )
            .filter(Boolean)
            .slice(
              0,
              10,
            )
        : [];

    const language =
      body.language?.trim() ||
      "en-US";

    if (!fileName) {
      return NextResponse.json(
        {
          success: false,
          error:
            "MEDIA_REQUIRED",
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

    const prompt = [
      "Generate social-media publishing copy for a creator.",
      "",
      `Video filename: ${fileName}`,
      `Creator context: ${context || "No extra context provided."}`,
      `Selected platforms: ${
        platforms.length > 0
          ? platforms.join(", ")
          : "Not selected yet"
      }`,
      `Language/locale: ${language}`,
      "",
      "Return ONLY valid JSON in this exact shape:",
      "{\"caption\":\"...\",\"hashtags\":[\"#tag1\",\"#tag2\"]}",
      "",
      "Requirements:",
      "- Write one polished caption that can be edited before publishing.",
      "- Keep it natural, engaging and concise.",
      "- Do not invent details not supported by the filename or creator context.",
      "- Generate 5 to 10 relevant hashtags.",
      "- Avoid duplicate hashtags.",
      "- Do not include markdown fences.",
      "- Keep the combined result comfortably below 2200 characters.",
    ].join("\n");

    const openAiResponse =
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
              500,
          }),
          cache:
            "no-store",
        },
      );

    const openAiData =
      (await openAiResponse.json()) as OpenAiResponse;

    if (
      !openAiResponse.ok
    ) {
      console.error(
        "OPENAI_CAPTION_API_ERROR",
        {
          status:
            openAiResponse.status,
          message:
            openAiData.error?.message,
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
        openAiData,
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

    const result =
      parseAiJson(
        outputText,
      );

    return NextResponse.json({
      success: true,
      caption:
        result.caption,
      hashtags:
        result.hashtags,
    });
  } catch (error) {
    console.error(
      "AI_CAPTION_ROUTE_ERROR",
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
