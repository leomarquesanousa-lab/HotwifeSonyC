import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  getCurrentSession,
} from "@/src/lib/auth/session";

import {
  stageManyVidsVideo,
} from "@/src/lib/distribution/manyvids";

import {
  db,
} from "@/src/prisma/db";

export const runtime =
  "nodejs";

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

    const formData =
      await request.formData();

    const mediaId =
      String(
        formData.get(
          "mediaId",
        ) ?? "",
      ).trim();

    const title =
      String(
        formData.get(
          "title",
        ) ?? "",
      ).trim();

    const description =
      String(
        formData.get(
          "description",
        ) ?? "",
      ).trim();

    const priceRaw =
      String(
        formData.get(
          "price",
        ) ?? "",
      )
        .trim()
        .replace(
          ",",
          ".",
        );

    const price =
      Number(
        priceRaw,
      );

    const tags =
      String(
        formData.get(
          "tags",
        ) ?? "",
      )
        .split(
          /[,\n#]+/,
        )
        .map(
          (tag) =>
            tag.trim(),
        )
        .filter(Boolean)
        .slice(0, 10);

    const publishMode =
      String(
        formData.get(
          "publishMode",
        ) ?? "NOW",
      ) === "SCHEDULED"
        ? "SCHEDULED"
        : "NOW";

    const scheduleDate =
      String(
        formData.get(
          "scheduleDate",
        ) ?? "",
      ).trim();

    const scheduleTime =
      String(
        formData.get(
          "scheduleTime",
        ) ?? "",
      ).trim();

    const thumbnailMode =
      String(
        formData.get(
          "thumbnailMode",
        ) ?? "AUTO",
      ) === "CUSTOM"
        ? "CUSTOM"
        : "AUTO";

    const thumbnailEntry =
      formData.get(
        "thumbnail",
      );

    if (!mediaId) {
      return NextResponse.json(
        {
          success: false,
          error:
            "MEDIA_ID_REQUIRED",
        },
        {
          status: 400,
        },
      );
    }

    if (!title) {
      return NextResponse.json(
        {
          success: false,
          error:
            "MANYVIDS_TITLE_REQUIRED",
        },
        {
          status: 400,
        },
      );
    }

    if (
      !Number.isFinite(
        price,
      ) ||
      price <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "MANYVIDS_PRICE_REQUIRED",
        },
        {
          status: 400,
        },
      );
    }

    if (
      tags.length <
      3
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "MANYVIDS_MINIMUM_3_TAGS_REQUIRED",
        },
        {
          status: 400,
        },
      );
    }

    if (
      publishMode ===
        "SCHEDULED" &&
      (!scheduleDate ||
        !scheduleTime)
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "MANYVIDS_SCHEDULE_REQUIRED",
        },
        {
          status: 400,
        },
      );
    }

    let thumbnail:
      | {
          name: string;
          mimeType: string;
          buffer: Buffer;
        }
      | null = null;

    if (
      thumbnailMode ===
      "CUSTOM"
    ) {
      if (
        !(thumbnailEntry instanceof File) ||
        thumbnailEntry.size < 1
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "MANYVIDS_THUMBNAIL_REQUIRED",
          },
          {
            status: 400,
          },
        );
      }

      if (
        ![
          "image/jpeg",
          "image/png",
          "image/webp",
        ].includes(
          thumbnailEntry.type,
        )
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "MANYVIDS_THUMBNAIL_TYPE_UNSUPPORTED",
          },
          {
            status: 400,
          },
        );
      }

      thumbnail = {
        name:
          thumbnailEntry.name ||
          "thumbnail.jpg",
        mimeType:
          thumbnailEntry.type,
        buffer:
          Buffer.from(
            await thumbnailEntry.arrayBuffer(),
          ),
      };
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

    const mediaAsset =
      await db.orm.public.MediaAsset
        .where({
          id:
            mediaId,
          workspaceId:
            membership.workspaceId,
        })
        .first();

    if (!mediaAsset) {
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
      mediaAsset.status !==
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

    if (
      mediaAsset.mediaType !==
      "VIDEO"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "MEDIA_NOT_VIDEO",
        },
        {
          status: 400,
        },
      );
    }

    const manyVidsAccount =
      await db.orm.public.PlatformAccount
        .where({
          workspaceId:
            membership.workspaceId,
          creatorId:
            mediaAsset.creatorId,
          platform:
            "MANYVIDS",
          status:
            "CONNECTED",
        })
        .first();

    if (!manyVidsAccount) {
      return NextResponse.json(
        {
          success: false,
          error:
            "MANYVIDS_NOT_CONNECTED",
        },
        {
          status: 409,
        },
      );
    }

    const result =
      await stageManyVidsVideo({
        creatorId:
          mediaAsset.creatorId,
        objectKey:
          mediaAsset.objectKey,
        originalFileName:
          mediaAsset.originalFileName,
        title,
        description,
        price,
        tags,
        publishMode,
        scheduleDate:
          publishMode ===
            "SCHEDULED"
            ? scheduleDate
            : null,
        scheduleTime:
          publishMode ===
            "SCHEDULED"
            ? scheduleTime
            : null,
        thumbnailMode,
        thumbnail,
      });

    return NextResponse.json({
      success: true,
      staged: true,
      fileSelected:
        result.fileSelected,
      editPageOpened:
        result.editPageOpened,
      fieldsFilled:
        result.fieldsFilled,
      externalVideoId:
        result.externalVideoId,
      fileName:
        result.fileName,
      currentUrl:
        result.currentUrl,
      priceFilled:
        result.priceFilled,
      thumbnailApplied:
        result.thumbnailApplied,
      tagsFilled:
        result.tagsFilled,
      scheduleConfigured:
        result.scheduleConfigured,
      saved:
        result.saved,
      message:
        "ManyVids upload completed. Tags, thumbnail and SAVE automation were executed and validated as far as the ManyVids page allowed.",
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "UNKNOWN_ERROR";

    console.error(
      "MANYVIDS_UPLOAD_TEST_ERROR",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "MANYVIDS_UPLOAD_TEST_FAILED",
        message,
      },
      {
        status: 500,
      },
    );
  }
}
