import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

import {
  getSignedUrl,
} from "@aws-sdk/s3-request-presigner";

function getRequiredEnv(
  name: string,
) {
  const value =
    process.env[name]?.trim();

  if (!value) {
    throw new Error(
      `${name}_MISSING`,
    );
  }

  return value;
}

export function getR2Client() {
  const accountId =
    getRequiredEnv(
      "R2_ACCOUNT_ID",
    );

  const accessKeyId =
    getRequiredEnv(
      "R2_ACCESS_KEY_ID",
    );

  const secretAccessKey =
    getRequiredEnv(
      "R2_SECRET_ACCESS_KEY",
    );

  const endpoint =
    process.env
      .R2_ENDPOINT
      ?.trim() ||
    `https://${accountId}.r2.cloudflarestorage.com`;

  return new S3Client({
    region: "auto",
    endpoint,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

export function getR2BucketName() {
  return getRequiredEnv(
    "R2_BUCKET_NAME",
  );
}

export async function getR2ObjectDownloadUrl(
  objectKey: string,
  expiresInSeconds = 3600,
) {
  const client =
    getR2Client();

  const bucketName =
    getR2BucketName();

  const command =
    new GetObjectCommand({
      Bucket:
        bucketName,
      Key:
        objectKey,
    });

  return getSignedUrl(
    client,
    command,
    {
      expiresIn:
        expiresInSeconds,
    },
  );
}

export async function uploadBufferToR2({
  objectKey,
  buffer,
  contentType,
}: {
  objectKey: string;
  buffer: Buffer;
  contentType: string;
}) {
  const client =
    getR2Client();

  const bucketName =
    getR2BucketName();

  await client.send(
    new PutObjectCommand({
      Bucket:
        bucketName,
      Key:
        objectKey,
      Body:
        buffer,
      ContentType:
        contentType,
    }),
  );

  return {
    bucketName,
    objectKey,
  };
}
