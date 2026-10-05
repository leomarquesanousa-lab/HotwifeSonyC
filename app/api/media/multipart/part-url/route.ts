import {
  UploadPartCommand,
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

type PartUrlRequest = {
  mediaId?: string;
  uploadId?: string;
  partNumber?: number;
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
      (await request.json()) as PartUrlRequest;

    const mediaId =
      body.mediaId?.trim();

    const uploadId =
      body.uploadId?.trim();

    const partNumber =
      body.partNumber;

    if (
      !mediaId ||
      !uploadId ||
      typeof partNumber !== "number" ||
      !Number.isInteger(partNumber) ||
      partNumber < 1 ||
      partNumber > 10000
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "INVALID_REQUEST",
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

    const bucketName =
      getR2BucketName();

    const client =
      getR2Client();

    const command =
      new UploadPartCommand({
        Bucket:
          bucketName,
        Key:
          mediaAsset.objectKey,
        UploadId:
          uploadId,
        PartNumber:
          partNumber,
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
      partNumber,
      uploadUrl,
      expiresIn:
        15 * 60,
    });
  } catch (error) {
    console.error(
      "MEDIA_MULTIPART_PART_URL_ERROR",
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