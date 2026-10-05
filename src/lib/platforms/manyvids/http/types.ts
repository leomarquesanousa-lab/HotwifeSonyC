import { z } from "zod";

const remoteId = z.string().regex(/^\d+$/).refine((v) => Number.isSafeInteger(Number(v)) && Number(v) > 0);
export const manyVidsTagSchema = z.object({ id: remoteId, label: z.string().trim().min(1).max(100) }).strict();
export type ManyVidsTag = z.infer<typeof manyVidsTagSchema>;
export const coPerformerSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("account"), remotePerformerId: remoteId, label: z.string().trim().min(1).max(200) }).strict(),
  z.object({ mode: z.literal("documents"), localPerformerId: z.string().min(1), idDocumentId: z.string().min(1), consentDocumentId: z.string().min(1), consentSource: z.enum(["document", "agreement"]), label: z.string().trim().min(1).max(200) }).strict(),
]);
export type ManyVidsCoPerformer = z.infer<typeof coPerformerSchema>;
export const publishInputSchema = z.object({
  publicationId: z.string().min(1),
  title: z.string().trim().min(1).max(180),
  description: z.string().max(5000),
  price: z.number().finite().positive().refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 0.000001),
  tags: z.array(z.union([manyVidsTagSchema, z.string().trim().min(1).max(100)])).min(3).max(10),
  performers: z.array(coPerformerSchema).refine((items) => new Set(items.map((item) => item.mode === "account" ? `account:${item.remotePerformerId}` : `documents:${item.localPerformerId}`)).size === items.length, "Duplicate performer"),
  thumbnail: z.discriminatedUnion("source", [
    z.object({ source: z.literal("generate_from_video"), frameTime: z.number().finite().nonnegative().optional() }).strict(),
    z.object({ source: z.literal("upload_custom"), mediaAssetId: z.string().min(1) }).strict(),
  ]),
  teaser: z.discriminatedUnion("source", [
    z.object({ source: z.literal("generate_from_video"), startTime: z.number().finite().nonnegative(), duration: z.number().finite().positive().max(30).optional() }).strict(),
    z.object({ source: z.literal("upload_custom"), mediaAssetId: z.string().min(1) }).strict(),
  ]),
  publishMode: z.enum(["NOW", "SCHEDULED"]),
  scheduleDate: z.string().optional(),
  scheduleTime: z.string().optional(),
  isAiGenerated: z.boolean().default(false),
  is3D: z.boolean().default(false),
}).strict();
export type PublishInput = z.infer<typeof publishInputSchema>;
export type UnknownManyVidsResponse = unknown;
export type UploadedVideo = { bucket: string; key: string; etag: string };
export type VideoSource = {
  objectKey: string; bucketName: string; originalFileName: string;
  contentType: string; fileSize: number; durationSeconds: number; width: number; height: number;
};
export type ManyVidsStage = "SESSION" | "TAGS" | "UPLOAD" | "REGISTER" | "THUMBNAIL" | "TEASER" | "PERFORMER" | "SAVE" | "TRANSCODE" | "FINALIZE" | "CONFIRM" | "EXECUTE";

export class ManyVidsError extends Error {
  constructor(public readonly code: string, public readonly stage: ManyVidsStage, public readonly httpStatus = 502) {
    // Only application-owned codes enter logs, responses and persisted errors.
    super(`ManyVids: ${code} (${stage}).`);
    this.name = "ManyVidsError";
  }
}
export function safeError(error: unknown): ManyVidsError {
  return error instanceof ManyVidsError ? error : new ManyVidsError("UNEXPECTED_FAILURE", "EXECUTE", 500);
}
export function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
export function id(value: unknown, stage: ManyVidsStage): string {
  const parsed = remoteId.safeParse(typeof value === "number" ? String(value) : value);
  if (!parsed.success) throw new ManyVidsError("INVALID_REMOTE_ID", stage);
  return parsed.data;
}
export function unwrapData(value: unknown, stage: ManyVidsStage): unknown {
  const data = record(value).data;
  if (typeof data !== "string") return data;
  try { return JSON.parse(data) as unknown; } catch { throw new ManyVidsError("INVALID_DATA_JSON", stage); }
}
export function assertNoRemoteError(value: unknown, stage: ManyVidsStage) {
  const body = record(value);
  const errors = body.errors;
  const hasErrors = Array.isArray(errors) ? errors.length > 0 : typeof errors === "object" && errors !== null ? Object.keys(errors).length > 0 : Boolean(errors);
  if (body.error || body.success === false || hasErrors) {
    throw new ManyVidsError("REMOTE_REJECTED", stage);
  }
}
export function requireSupported(input: PublishInput) {
  if (input.publishMode !== "NOW") throw new ManyVidsError("SCHEDULING_NOT_SUPPORTED", "EXECUTE", 400);
  if (input.thumbnail.source !== "generate_from_video") throw new ManyVidsError("CUSTOM_THUMBNAIL_NOT_SUPPORTED", "EXECUTE", 400);
  if (input.teaser.source !== "generate_from_video") throw new ManyVidsError("CUSTOM_TEASER_NOT_SUPPORTED", "EXECUTE", 400);
  if (input.performers.some((performer) => performer.mode === "documents")) throw new ManyVidsError("DOCUMENTS_NOT_SUPPORTED", "PERFORMER", 400);
  if (input.thumbnail.frameTime !== undefined) throw new ManyVidsError("THUMBNAIL_FRAME_NOT_SUPPORTED", "THUMBNAIL", 400);
  // Only start_time is evidenced in the HAR; never silently discard a requested duration.
  if (input.teaser.duration !== undefined) throw new ManyVidsError("TEASER_DURATION_NOT_SUPPORTED", "TEASER", 400);
}
