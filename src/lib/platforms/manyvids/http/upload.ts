import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getR2Client } from "../../../storage/r2";
import { API, ManyVidsClient } from "./client";
import { ManyVidsError, record, unwrapData, type UploadedVideo, type VideoSource } from "./types";

const PART_BYTES = 20 * 1024 * 1024;
function textField(value: unknown): string {
  if (typeof value !== "string" || !value) throw new ManyVidsError("INVALID_MULTIPART_RESPONSE", "UPLOAD");
  return value;
}
export function validateSignedUploadUrl(value: unknown): URL {
  let url: URL;
  try { url = new URL(textField(value)); } catch { throw new ManyVidsError("INVALID_SIGNED_URL", "UPLOAD"); }
  // No account cookie is ever forwarded here. Refuse unexpected destinations/redirects.
  if (url.protocol !== "https:" || url.username || url.password || url.port ||
    !(url.hostname.endsWith(".amazonaws.com") || url.hostname.endsWith(".r2.cloudflarestorage.com"))) {
    throw new ManyVidsError("UNSUPPORTED_STORAGE_HOST", "UPLOAD");
  }
  return url;
}
export async function uploadVideo(client: ManyVidsClient, source: VideoSource, creatorId: string): Promise<UploadedVideo> {
  // Match upload-create-test: renew after session/tag lookups, immediately before create.
  // request() absorbs and persists Set-Cookie before this awaited refresh resolves.
  await client.refresh();
  const created = record(unwrapData(await client.timing.measure("UPLOADER_CREATE", () => client.json("/uploader/create", "UPLOAD", {
    file: { name: source.originalFileName, size: source.fileSize, id: `creator-platform-${crypto.randomUUID()}`, isRemote: false, type: source.contentType },
    meta: { user_id: Number(creatorId) },
  })), "UPLOAD"));
  const uploadId = textField(created.UploadId);
  const key = textField(created.Key);
  if (!key.startsWith(`${creatorId}/`)) throw new ManyVidsError("REMOTE_OBJECT_OWNER_MISMATCH", "UPLOAD");
  const query = `?key=${encodeURIComponent(key)}`;
  const r2 = getR2Client();
  try {
    const parts: { PartNumber: number; ETag: string }[] = [];
    for (let start = 0, number = 1; start < source.fileSize; start += PART_BYTES, number++) {
      const end = Math.min(source.fileSize - 1, start + PART_BYTES - 1);
      // Bound memory to a single part; use the bucket resolved from the authorized MediaAsset.
      const bytes = await client.timing.measure("SOURCE_FETCH", async () => {
        const object = await r2.send(new GetObjectCommand({ Bucket: source.bucketName, Key: source.objectKey, Range: `bytes=${start}-${end}` }), { abortSignal: AbortSignal.timeout(client.transferTimeout(60_000)) });
        if (!object.Body || object.ContentLength !== end - start + 1) throw new ManyVidsError("R2_RANGE_MISMATCH", "UPLOAD");
        const bytes = await object.Body.transformToByteArray();
        if (bytes.byteLength !== end - start + 1) throw new ManyVidsError("R2_SIZE_MISMATCH", "UPLOAD");
        return bytes;
      }, { partNumber: number, fileSizeBytes: source.fileSize, bytes: end - start + 1 });
      const signed = unwrapData(await client.timing.measure("UPLOAD_SIGN", () => client.request(API, `/uploader/sign/${encodeURIComponent(uploadId)}/${number}${query}`, "UPLOAD"), { partNumber: number }), "UPLOAD");
      const url = validateSignedUploadUrl(signed);
      const etag = await client.timing.measure("VIDEO_TRANSFER", async () => {
        let response: Response;
        try { response = await fetch(url, { method: "PUT", body: bytes as Uint8Array<ArrayBuffer>, redirect: "manual", credentials: "omit", signal: AbortSignal.timeout(client.transferTimeout(120_000)) }); }
        catch { throw new ManyVidsError("PART_NETWORK_OR_TIMEOUT", "UPLOAD"); }
        if (!response.ok) throw new ManyVidsError(`PART_HTTP_${response.status}`, "UPLOAD");
        const etag = response.headers.get("etag");
        await response.body?.cancel();
        if (!etag) throw new ManyVidsError("PART_ETAG_MISSING", "UPLOAD");
        return etag;
      }, { partNumber: number, fileSizeBytes: source.fileSize, bytes: bytes.byteLength });
      parts.push({ PartNumber: number, ETag: etag });
    }
    const result = record(unwrapData(await client.timing.measure("UPLOADER_COMPLETE", () => client.json(`/uploader/complete/${encodeURIComponent(uploadId)}${query}`, "UPLOAD", { parts })), "UPLOAD"));
    const resultKey = textField(result.Key);
    if (resultKey !== key) throw new ManyVidsError("COMPLETE_KEY_MISMATCH", "UPLOAD");
    return { bucket: textField(result.Bucket), key, etag: textField(result.ETag).replace(/^"|"$/g, "") };
  } catch (error) {
    // Best effort only, never mask the primary failure or retry create/complete blindly.
    try { await client.request(API, `/uploader/abort/${encodeURIComponent(uploadId)}${query}`, "UPLOAD", { method: "DELETE" }, false); } catch { /* sanitized by caller */ }
    throw error;
  } finally { r2.destroy(); }
}
