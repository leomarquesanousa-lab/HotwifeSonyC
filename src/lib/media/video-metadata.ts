import { z } from "zod";

const positiveDatabaseInt = z.number().int().positive().max(2_147_483_647);

export const videoMetadataSchema = z.object({
  // The existing column is Int: retain the measured duration rounded up to a whole second.
  // This also avoids admitting a 30.x second custom teaser into a <=30 second limit.
  durationSeconds: z.number().finite().positive().max(2_147_483_647).transform(Math.ceil),
  width: positiveDatabaseInt,
  height: positiveDatabaseInt,
});

export type VideoMetadata = z.infer<typeof videoMetadataSchema>;

export function missingVideoMetadataFields(media: {
  durationSeconds?: unknown; width?: unknown; height?: unknown; fileSize?: unknown;
}): string[] {
  const missing: string[] = [];
  for (const name of ["durationSeconds", "width", "height"] as const) {
    if (!positiveDatabaseInt.safeParse(media[name]).success) missing.push(name);
  }
  const size = media.fileSize;
  const validSize = typeof size === "bigint" ? size > BigInt(0)
    : typeof size === "number" ? Number.isSafeInteger(size) && size > 0
    : typeof size === "string" && /^[1-9]\d*$/.test(size);
  if (!validSize) missing.push("fileSize");
  return missing;
}

export function verifiedVideoFileSize(contentLength: unknown, expected: bigint): bigint {
  if (typeof contentLength !== "number" || !Number.isSafeInteger(contentLength) || contentLength <= 0 || BigInt(contentLength) !== expected) {
    throw new Error("MEDIA_SIZE_MISMATCH");
  }
  return BigInt(contentLength);
}
