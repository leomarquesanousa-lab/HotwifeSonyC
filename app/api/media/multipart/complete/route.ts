import {
  CompleteMultipartUploadCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";

import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  getCurrentSession,
} from "@/src/lib/auth/session";

import {
  getR2Client,
} from "@/src/lib/storage/r2";

import {
  db,
} from "@/src/prisma/db";
import { videoMetadataSchema, verifiedVideoFileSize } from "@/src/lib/media/video-metadata";

type CompletedPartInput = {
  partNumber?: number;
  etag?: string;
};

type CompleteMultipartRequest = {
  mediaId?: string;
  uploadId?: string;
  parts?: CompletedPartInput[];
  videoMetadata?: unknown;
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
      (await request.json()) as CompleteMultipartRequest;

    const mediaId =
      body.mediaId?.trim();

    const uploadId =
      body.uploadId?.trim();

    const parts =
      Array.isArray(
        body.parts,
      )
        ? body.parts
        : [];

    if (
      !mediaId ||
      !uploadId ||
      parts.length === 0
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

    const normalizedParts =
      parts
        .map(
          (part) => {
            const partNumber =
              part.partNumber;

            const etag =
              part.etag?.trim();

            if (
              typeof partNumber !==
                "number" ||
              !Number.isInteger(
                partNumber,
              ) ||
              partNumber < 1 ||
              partNumber > 10000 ||
              !etag
            ) {
              return null;
            }

            return {
              PartNumber:
                partNumber,
              ETag:
                etag,
            };
          },
        )
        .filter(
          (
            part,
          ): part is {
            PartNumber: number;
            ETag: string;
          } =>
            part !== null,
        )
        .sort(
          (a, b) =>
            a.PartNumber -
            b.PartNumber,
        );

    if (
      normalizedParts.length !==
      parts.length
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "INVALID_PARTS",
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

    // Prefer already recorded measurements; allow an in-flight older upload to supply them.
    const storedMetadata = videoMetadataSchema.safeParse(mediaAsset);
    const videoMetadata = mediaAsset.mediaType === "VIDEO"
      ? (storedMetadata.success ? storedMetadata : videoMetadataSchema.safeParse(body.videoMetadata)) : null;
    if (videoMetadata && !videoMetadata.success) {
      return NextResponse.json({ success: false, error: "VIDEO_METADATA_REQUIRED", message: "Duração e dimensões estão ausentes. O vídeo não foi marcado como pronto para publicação." }, { status: 400 });
    }

    const bucketName = mediaAsset.bucketName;

    const client =
      getR2Client();

    const command =
      new CompleteMultipartUploadCommand({
        Bucket:
          bucketName,
        Key:
          mediaAsset.objectKey,
        UploadId:
          uploadId,
        MultipartUpload: {
          Parts:
            normalizedParts,
        },
      });

    const result =
      await client.send(
        command,
      );

    let fileSize = mediaAsset.fileSize;
    if (mediaAsset.mediaType === "VIDEO") {
      const object = await client.send(new HeadObjectCommand({ Bucket: bucketName, Key: mediaAsset.objectKey }));
      try { fileSize = verifiedVideoFileSize(object.ContentLength, mediaAsset.fileSize); }
      catch {
        return NextResponse.json({ success: false, error: "MEDIA_SIZE_MISMATCH", message: "O tamanho no armazenamento não corresponde ao arquivo original. O vídeo não está pronto para publicação." }, { status: 409 });
      }
    }

    const now =
      new Date().toISOString();

    await db.orm.public.MediaAsset.where({
      id:
        mediaAsset.id,
    }).update({
      ...(videoMetadata?.success ? videoMetadata.data : {}),
      fileSize,
      status:
        "UPLOADED",
      objectEtag:
        result.ETag ??
        null,
      uploadCompletedAt:
        now,
      lastErrorCode:
        null,
      lastErrorMessage:
        null,
    });

    return NextResponse.json({
      success: true,
      mediaId:
        mediaAsset.id,
      objectKey:
        mediaAsset.objectKey,
      status:
        "UPLOADED",
      etag:
        result.ETag ??
        null,
    });
  } catch (error) {
    console.error(
      "MEDIA_MULTIPART_COMPLETE_ERROR",
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
