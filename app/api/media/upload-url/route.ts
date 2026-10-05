import crypto from "node:crypto";

import {
  PutObjectCommand,
} from "@aws-sdk/client-s3";

import {
  getSignedUrl,
} from "@aws-sdk/s3-request-presigner";

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

type UploadUrlRequest = {
  fileName?: string;
  contentType?: string;
  fileSize?: number;
};

const MAX_FILE_SIZE =
  2 * 1024 * 1024 * 1024;

const ALLOWED_CONTENT_TYPES =
  new Set([
    "video/mp4",
    "video/quicktime",
    "video/x-m4v",
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
      (await request.json()) as UploadUrlRequest;

    const fileName =
      body.fileName?.trim();

    const contentType =
      body.contentType?.trim();

    const fileSize =
      body.fileSize;

    if (
      !fileName ||
      !contentType ||
      typeof fileSize !== "number" ||
      !Number.isFinite(fileSize) ||
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

    if (
      fileSize >
      MAX_FILE_SIZE
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "FILE_TOO_LARGE",
          maxFileSize:
            MAX_FILE_SIZE,
        },
        {
          status: 400,
        },
      );
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

    const mediaId =
      crypto.randomUUID();

    const safeFileName =
      sanitizeFileName(
        fileName,
      ) || "video";

    const objectKey = [
      "workspace",
      workspaceMember.workspaceId,
      "creator",
      creator.id,
      "media",
      mediaId,
      safeFileName,
    ].join("/");

    const client =
      getR2Client();

    const bucket =
      getR2BucketName();

    const command =
      new PutObjectCommand({
        Bucket:
          bucket,
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
          originalFileName:
            fileName,
        },
      });

    const uploadUrl =
      await getSignedUrl(
        client,
        command,
        {
          expiresIn:
            15 * 60,
        },
      );

    return NextResponse.json({
      success: true,
      mediaId,
      objectKey,
      uploadUrl,
      expiresIn:
        15 * 60,
    });
  } catch (error) {
    console.error(
      "MEDIA_UPLOAD_URL_ERROR",
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