import {
  AbortMultipartUploadCommand,
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

type AbortMultipartRequest = {
  mediaId?: string;
  uploadId?: string;
};

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
      (await request.json()) as AbortMultipartRequest;

    const mediaId =
      body.mediaId?.trim();

    const uploadId =
      body.uploadId?.trim();

    if (
      !mediaId ||
      !uploadId
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

    const mediaAsset =
      await db.orm.public.MediaAsset.where({
        id:
          mediaId,
        workspaceId:
          workspaceMember.workspaceId,
      }).first();

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
      "UPLOADING"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "MEDIA_NOT_UPLOADING",
        },
        {
          status: 409,
        },
      );
    }

    const client =
      getR2Client();

    const bucketName =
      getR2BucketName();

    const command =
      new AbortMultipartUploadCommand({
        Bucket:
          bucketName,
        Key:
          mediaAsset.objectKey,
        UploadId:
          uploadId,
      });

    await client.send(
      command,
    );

    await db.orm.public.MediaAsset.where({
      id:
        mediaAsset.id,
    }).update({
      status:
        "CANCELLED",
      lastErrorCode:
        "UPLOAD_ABORTED",
      lastErrorMessage:
        "Upload was cancelled before completion.",
    });

    return NextResponse.json({
      success: true,
      mediaId:
        mediaAsset.id,
      status:
        "CANCELLED",
    });
  } catch (error) {
    console.error(
      "MEDIA_MULTIPART_ABORT_ERROR",
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