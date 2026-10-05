import crypto from "node:crypto";
import { videoMetadataSchema } from "@/src/lib/media/video-metadata";

import {
  CreateMultipartUploadCommand,
} from "@aws-sdk/client-s3";

import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  getCurrentSession,
} from "@/src/lib/auth/session";

import {
  getR2BucketName,
  getR2Client,
} from "@/src/lib/storage/r2";

import {
  db,
} from "@/src/prisma/db";

type MultipartStartRequest = {
  fileName?: string;
  contentType?: string;
  fileSize?: number;
  performerId?: string;
  folderId?: string;
  videoMetadata?: unknown;
  source?: "STORE_PRODUCT";
};

const ALLOWED_CONTENT_TYPES =
  new Set([
    "video/mp4",
    "video/quicktime",
    "video/x-m4v",
    "image/jpeg",
    "image/png",
    "image/webp",
  ]);

function sanitizeFileName(
  fileName: string,
) {
  return fileName
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 180);
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
          error: "UNAUTHORIZED",
        },
        {
          status: 401,
        },
      );
    }

    const body =
      (await request.json()) as MultipartStartRequest;

    const fileName =
      body.fileName?.trim();

    const contentType =
      body.contentType?.trim();

    const fileSize =
      body.fileSize;

    const performerId =
      body.performerId?.trim();

    const folderId =
      body.folderId?.trim();

    if (
      !fileName ||
      !contentType ||
      typeof fileSize !== "number" ||
      !Number.isSafeInteger(fileSize) ||
      fileSize <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "INVALID_FILE",
        },
        {
          status: 400,
        },
      );
    }

    if (
      Boolean(performerId) !== Boolean(folderId)
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "MEDIA_DESTINATION_REQUIRED",
          message:
            "Select a complete upload destination.",
        },
        {
          status: 400,
        },
      );
    }

    if (
      !ALLOWED_CONTENT_TYPES.has(
        contentType,
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "UNSUPPORTED_FILE_TYPE",
        },
        {
          status: 400,
        },
      );
    }

    const videoMetadata = contentType.startsWith("video/") ? videoMetadataSchema.safeParse(body.videoMetadata) : null;
    if (videoMetadata && !videoMetadata.success) {
      return NextResponse.json({ success: false, error: "VIDEO_METADATA_REQUIRED", message: "O vídeo precisa de duração e dimensões válidas antes de iniciar o upload. Atualize a página e selecione o arquivo novamente." }, { status: 400 });
    }

    const workspaceMember =
      await db.orm.public.WorkspaceMember.where({
        userId:
          session.user.id,
      }).first();

    if (!workspaceMember) {
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

    const performer =
      performerId ? await db.orm.public.Performer.where({
        id:
          performerId,
        workspaceId:
          workspaceMember.workspaceId,
      }).first() : null;

    if (performerId && !performer) {
      return NextResponse.json(
        {
          success: false,
          error:
            "PERFORMER_NOT_FOUND",
        },
        {
          status: 404,
        },
      );
    }

    const folder =
      performer ? await db.orm.public.PerformerLibraryFolder.where({
        id:
          folderId,
        workspaceId:
          workspaceMember.workspaceId,
        performerId:
          performer.id,
      }).first() : null;

    if (
      performer && (!folder ||
      folder.status !== "ACTIVE")
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "MEDIA_FOLDER_NOT_FOUND",
        },
        {
          status: 404,
        },
      );
    }

    if (folder && !folder.parentId) {
      return NextResponse.json(
        {
          success: false,
          error:
            "MEDIA_FOLDER_NOT_UPLOADABLE",
          message:
            "Choose a folder inside SAFE or UNSAFE.",
        },
        {
          status: 400,
        },
      );
    }

    const creator =
      await db.orm.public.Creator.where({
        workspaceId:
          workspaceMember.workspaceId,
      }).first();

    if (!creator) {
      return NextResponse.json(
        {
          success: false,
          error:
            "CREATOR_NOT_FOUND",
        },
        {
          status: 404,
        },
      );
    }

    const existingMedia =
      await db.orm.public.MediaAsset.where({
        workspaceId:
          workspaceMember.workspaceId,
        creatorId:
          creator.id,
        folderId:
          folder?.id ?? null,
        originalFileName:
          fileName,
      }).first();

    if (
      body.source !== "STORE_PRODUCT" && existingMedia &&
      existingMedia.status !==
        "FAILED" &&
      existingMedia.status !==
        "CANCELLED"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "DUPLICATE_MEDIA",
          message:
            "A file with this name already exists in this folder.",
          existingMedia: {
            id:
              existingMedia.id,
            originalFileName:
              existingMedia.originalFileName,
            status:
              existingMedia.status,
          },
        },
        {
          status: 409,
        },
      );
    }

    const mediaId =
      crypto.randomUUID();

    const safeFileName =
      sanitizeFileName(
        fileName,
      ) || "media";

    const objectKey = performer && folder
      ? ['workspace', workspaceMember.workspaceId, 'performer', performer.id, 'library', folder.id, 'media', mediaId, safeFileName].join('/')
      : ['workspace', workspaceMember.workspaceId, 'creator', creator.id, 'media', mediaId, safeFileName].join('/');

    const bucketName =
      getR2BucketName();

    const client =
      getR2Client();

    const multipartCommand =
      new CreateMultipartUploadCommand({
        Bucket:
          bucketName,
        Key:
          objectKey,
        ContentType:
          contentType,
        Metadata: {
          mediaId,
          workspaceId:
            workspaceMember.workspaceId,
          creatorId:
            creator.id,
          ...(performer && folder ? { performerId: performer.id, folderId: folder.id } : {}),
          originalFileName:
            encodeURIComponent(
              fileName,
            ),
        },
      });

    const multipartResult =
      await client.send(
        multipartCommand,
      );

    const uploadId =
      multipartResult.UploadId;

    if (!uploadId) {
      console.error(
        "MEDIA_MULTIPART_UPLOAD_ID_MISSING",
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "MULTIPART_START_FAILED",
        },
        {
          status: 500,
        },
      );
    }

    await db.orm.public.MediaAsset.create({
      id:
        mediaId,
      workspaceId:
        workspaceMember.workspaceId,
      creatorId:
        creator.id,
      folderId:
        folder?.id ?? null,

      originalFileName:
        fileName,
      objectKey,
      bucketName,
      storageProvider:
        "R2",

      contentType,
      fileSize:
        BigInt(
          Math.trunc(
            fileSize,
          ),
        ),

      mediaType:
        contentType.startsWith(
          "image/",
        )
          ? "IMAGE"
          : "VIDEO",
      status:
        "UPLOADING",

      durationSeconds:
        videoMetadata?.success ? videoMetadata.data.durationSeconds : null,
      width:
        videoMetadata?.success ? videoMetadata.data.width : null,
      height:
        videoMetadata?.success ? videoMetadata.data.height : null,

      thumbnailObjectKey:
        null,
      objectEtag:
        null,

      uploadCompletedAt:
        null,
      processingStartedAt:
        null,
      processingCompletedAt:
        null,

      lastErrorCode:
        null,
      lastErrorMessage:
        null,
    });

    if (performer) await db.orm.public.MediaAssetPerformer.create({
      workspaceId:
        workspaceMember.workspaceId,
      mediaAssetId:
        mediaId,
      performerId:
        performer.id,
    });

    return NextResponse.json({
      success: true,
      mediaId,
      objectKey,
      uploadId,
      bucketName,
      performerId: performer?.id ?? null,
      folderId: folder?.id ?? null,
    });
  } catch (error) {
    console.error(
      "MEDIA_MULTIPART_START_ERROR",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "INTERNAL_ERROR",
      },
      {
        status: 500,
      },
    );
  }
}
