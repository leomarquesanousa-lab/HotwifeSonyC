import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  getCurrentSession,
} from "@/src/lib/auth/session";

import {
  getR2ObjectDownloadUrl,
  uploadBufferToR2,
} from "@/src/lib/storage/r2";

import {
  db,
} from "@/src/prisma/db";

type AiThumbnailRequest = {
  prompt?: string;
  publishType?: string;
  fileName?: string;
  caption?: string;
};

type OpenAiImageResponse = {
  data?: Array<{
    b64_json?: string;
  }>;
  error?: {
    message?: string;
    type?: string;
    code?: string;
  };
};

export const runtime =
  "nodejs";

function normalizePublishType(
  value?: string,
) {
  const normalized =
    value
      ?.trim()
      .toUpperCase();

  if (
    normalized ===
      "POST" ||
    normalized ===
      "REEL" ||
    normalized ===
      "STORY"
  ) {
    return normalized;
  }

  return "REEL";
}

export async function POST(
  request: NextRequest,
  context: {
    params:
      Promise<{
        id: string;
      }>;
  },
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

    const membership =
      await db.orm.public.WorkspaceMember
        .where({
          userId:
            session.user.id,
        })
        .first();

    if (!membership) {
      return NextResponse.json(
        {
          success: false,
          error:
            "WORKSPACE_NOT_FOUND",
        },
        {
          status: 404,
        },
      );
    }

    const {
      id: mediaId,
    } =
      await context.params;

    const media =
      await db.orm.public.MediaAsset
        .where({
          id:
            mediaId,
          workspaceId:
            membership.workspaceId,
        })
        .first();

    if (!media) {
      return NextResponse.json(
        {
          success: false,
          error:
            "MEDIA_NOT_FOUND",
        },
        {
          status: 404,
        },
      );
    }

    if (
      media.status !==
      "UPLOADED"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "MEDIA_NOT_READY",
        },
        {
          status: 409,
        },
      );
    }

    const body =
      (await request.json()) as AiThumbnailRequest;

    const publishType =
      normalizePublishType(
        body.publishType,
      );

    const userPrompt =
      body.prompt?.trim() ??
      "";

    const fileName =
      body.fileName?.trim() ||
      media.originalFileName;

    const caption =
      body.caption
        ?.trim()
        .slice(
          0,
          1200,
        ) ??
      "";

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
      process.env
        .OPENAI_IMAGE_MODEL
        ?.trim() ||
      "gpt-image-2";

    const size =
      publishType ===
      "POST"
        ? "1024x1024"
        : "1008x1792";

    const aspectInstruction =
      publishType ===
      "POST"
        ? "square 1:1 composition"
        : "vertical 9:16 composition";

    const prompt = [
      "Create a professional social-media thumbnail / cover image.",
      `Target: Instagram ${publishType}.`,
      `Use a ${aspectInstruction}.`,
      "Keep the important subject centered and safe from edge cropping.",
      "Do not add logos, watermarks, UI elements, or platform branding.",
      "Do not add text unless the user explicitly asks for text.",
      fileName
        ? `Source media filename: ${fileName}.`
        : "",
      caption
        ? `Publication context: ${caption}.`
        : "",
      userPrompt
        ? `User direction: ${userPrompt}`
        : "User direction: create an eye-catching, polished cover related to the publication context.",
    ]
      .filter(
        Boolean,
      )
      .join("\n");

    const openAiResponse =
      await fetch(
        "https://api.openai.com/v1/images/generations",
        {
          method:
            "POST",
          headers: {
            Authorization:
              `Bearer ${apiKey}`,
            "Content-Type":
              "application/json",
          },
          body:
            JSON.stringify({
              model,
              prompt,
              size,
              quality:
                "medium",
              output_format:
                "jpeg",
              output_compression:
                90,
            }),
          cache:
            "no-store",
        },
      );

    const data =
      (await openAiResponse.json()) as OpenAiImageResponse;

    const base64 =
      data.data?.[0]
        ?.b64_json;

    if (
      !openAiResponse.ok ||
      !base64
    ) {
      console.error(
        "OPENAI_THUMBNAIL_API_ERROR",
        {
          status:
            openAiResponse.status,
          message:
            data.error?.message,
          type:
            data.error?.type,
          code:
            data.error?.code,
          model,
          size,
        },
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "AI_THUMBNAIL_GENERATION_FAILED",
          message:
            data.error?.message ||
            "OpenAI did not return an image.",
        },
        {
          status: 502,
        },
      );
    }

    const buffer =
      Buffer.from(
        base64,
        "base64",
      );

    const objectKey = [
      "workspace",
      membership.workspaceId,
      "creator",
      media.creatorId,
      "media",
      media.id,
      "thumbnails",
      `ai-cover-${Date.now()}.jpg`,
    ].join("/");

    await uploadBufferToR2({
      objectKey,
      buffer,
      contentType:
        "image/jpeg",
    });

    await db.orm.public.MediaAsset
      .where({
        id:
          media.id,
        workspaceId:
          membership.workspaceId,
      })
      .update({
        thumbnailObjectKey:
          objectKey,
      });

    const thumbnailUrl =
      await getR2ObjectDownloadUrl(
        objectKey,
        60 * 60,
      );

    console.info(
      "AI_THUMBNAIL_SAVED",
      {
        mediaId:
          media.id,
        model,
        size,
        objectKey,
      },
    );

    return NextResponse.json({
      success: true,
      mediaId:
        media.id,
      thumbnailObjectKey:
        objectKey,
      thumbnailUrl,
      model,
      size,
    });
  } catch (error) {
    console.error(
      "AI_THUMBNAIL_ROUTE_ERROR",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "INTERNAL_ERROR",
        message:
          error instanceof Error
            ? error.message
            : "Unable to generate AI thumbnail.",
      },
      {
        status: 500,
      },
    );
  }
}
