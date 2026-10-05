import { db } from "@/src/prisma/db";
import { ManyVidsError, type PublishInput } from "./types";

export type LocalOptions = {
  assets: Array<{ id: string; label: string; mediaType: string; durationSeconds: number | null; fileSize: number; width?: number | null; height?: number | null; contentType?: string; performerIds?: string[] }>;
  performers: Array<{ id: string; label: string; documents: Array<{ id: string; label: string; role: "identity" | "consent"; source: "document" | "agreement"; agreementDate?: string }> }>;
};

export async function loadLocalOptions(workspaceId: string, creatorId: string): Promise<LocalOptions> {
  const [assets, performers, documents, agreements, mediaPerformers] = await Promise.all([
    db.orm.public.MediaAsset.where({ workspaceId, creatorId, status: "UPLOADED", storageProvider: "R2" }).all(),
    db.orm.public.Performer.where({ workspaceId, status: "ACTIVE" }).all(),
    db.orm.public.PerformerDocument.where({ workspaceId, status: "ACTIVE", storageProvider: "R2" }).all(),
    db.orm.public.Agreement.where({ workspaceId, storageProvider: "R2" }).all(),
    db.orm.public.MediaAssetPerformer.where({ workspaceId }).all(),
  ]);
  return {
    assets: assets.filter((asset) => asset.objectKey && asset.bucketName && ["IMAGE", "VIDEO"].includes(asset.mediaType)).map((asset) => ({ id: asset.id, label: asset.originalFileName, mediaType: asset.mediaType, durationSeconds: asset.durationSeconds, fileSize: Number(asset.fileSize), width: asset.width, height: asset.height, contentType: asset.contentType, performerIds: mediaPerformers.filter((link) => link.mediaAssetId === asset.id).map((link) => link.performerId) })),
    performers: performers.map((performer) => ({
      id: performer.id, label: performer.displayName,
      documents: [
        ...documents.filter((doc) => doc.performerId === performer.id && doc.objectKey && doc.bucketName && doc.fileSize > BigInt(0) && ["image/jpeg", "image/png", "application/pdf"].includes(doc.contentType) && (!doc.expiresAt || Date.parse(doc.expiresAt) > Date.now()) && ["PHOTO_ID", "RELEASE_FORM"].includes(doc.documentType)).map((doc) => ({ id: doc.id, label: doc.title, role: doc.documentType === "PHOTO_ID" ? "identity" as const : "consent" as const, source: "document" as const })),
        ...agreements.filter((agreement) => agreement.performerId === performer.id && agreement.status === "COMPLETED" && agreement.completedAt && !agreement.voidedAt && agreement.signedPdfObjectKey && agreement.bucketName).map((agreement) => ({ id: agreement.id, label: `Signed release — ${agreement.agreementDate}`, agreementDate: agreement.agreementDate, role: "consent" as const, source: "agreement" as const })),
      ],
    })),
  };
}

export function validateLocalOptions(input: PublishInput, options: LocalOptions, videoDuration: number) {
  if (input.thumbnail.source === "upload_custom") {
    const assetId = input.thumbnail.mediaAssetId;
    const asset = options.assets.find((item) => item.id === assetId);
    if (!asset || asset.mediaType !== "IMAGE" || asset.fileSize <= 0) throw new ManyVidsError("THUMBNAIL_ASSET_NOT_READY", "THUMBNAIL", 400);
  } else if (input.thumbnail.frameTime !== undefined && input.thumbnail.frameTime >= videoDuration) {
    throw new ManyVidsError("INVALID_THUMBNAIL_FRAME", "THUMBNAIL", 400);
  }
  if (input.teaser.source === "upload_custom") {
    const assetId = input.teaser.mediaAssetId;
    const asset = options.assets.find((item) => item.id === assetId);
    if (!asset || asset.mediaType !== "VIDEO") throw new ManyVidsError("TEASER_ASSET_NOT_READY", "TEASER", 400);
    if (!asset.durationSeconds || asset.durationSeconds > 30 || asset.fileSize <= 0 || asset.fileSize >= 50_000_000) throw new ManyVidsError("INVALID_CUSTOM_TEASER_LIMITS", "TEASER", 400);
  } else if (input.teaser.startTime >= videoDuration || (input.teaser.duration !== undefined && input.teaser.startTime + input.teaser.duration > videoDuration)) {
    throw new ManyVidsError("INVALID_TEASER_RANGE", "TEASER", 400);
  }
  return input.performers.map((performer) => {
    if (performer.mode === "account") return { kind: "account" as const };
    const local = options.performers.find((item) => item.id === performer.localPerformerId);
    const identity = local?.documents.find((doc) => doc.id === performer.idDocumentId && doc.role === "identity" && doc.source === "document");
    const consent = local?.documents.find((doc) => doc.id === performer.consentDocumentId && doc.role === "consent" && doc.source === performer.consentSource);
    if (!identity || !consent) throw new ManyVidsError("PERFORMER_DOCUMENTS_REQUIRED", "PERFORMER", 400);
    return { kind: "documents_ready" as const };
  });
}
