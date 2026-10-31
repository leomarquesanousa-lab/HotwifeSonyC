import { DeleteObjectCommand } from '@aws-sdk/client-s3';
import { z } from 'zod';
import { db } from '@/src/prisma/db';
import { getR2Client } from '@/src/lib/storage/r2';
import { parseAuthBody, AuthError } from '@/src/lib/auth/request';
import { requireStoreManagementAccess, StoreError } from '@/src/lib/store/admin';

const confirmation = z.object({ confirmed: z.literal(true) }).strict();
const headers = { 'Cache-Control': 'private, no-store' };

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const access = await requireStoreManagementAccess();
    if (!access.canDelete) throw new StoreError('Only an owner or administrator can delete media.', 403);
    await parseAuthBody(request, confirmation);
    const { id } = await params;
    if (!z.string().uuid().safeParse(id).success) throw new StoreError('Invalid media ID.');
    const removed = await db.transaction(async tx => {
      // Serialize with product creation/publication; FK checks remain the final guard.
      await tx.execute(db.raw.sql`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${'store-video-products'}, 0))`.returnsRow({ locked: 'pg/int4@1' }).build());
      const media = await tx.orm.public.MediaAsset.where({ id, workspaceId: access.workspaceId }).first();
      if (!media) throw new StoreError('Media not found.', 404);
      if (['UPLOADING', 'PROCESSING'].includes(media.status)) throw new StoreError('Cancel or finish the upload before deleting this media.', 409);
      if (media.folderId || media.mediaType === 'DOCUMENT') throw new StoreError('Participant documents must be retained and managed in the protected document library.', 409);
      for (const field of ['mediaAssetId', 'teaserMediaAssetId', 'thumbnailMediaAssetId'] as const) {
        if (await tx.orm.public.VideoProduct.where({ [field]: id }).first()) throw new StoreError('This file is used by a video product. Manage it in Videos for Sale. Purchases and compliance records must be preserved.', 409);
      }
      if (await tx.orm.public.DistributionJob.where({ mediaAssetId: id }).first()) throw new StoreError('This media has publication history and must be preserved.', 409);
      const keys = [...new Set([media.objectKey, media.thumbnailObjectKey].filter((key): key is string => !!key))];
      for (const key of keys) {
        if (await tx.orm.public.PerformerDocument.where({ objectKey: key }).first()) throw new StoreError('This file is protected participant documentation and must be preserved.', 409);
        const objects = await tx.orm.public.MediaAsset.where({ objectKey: key }).all();
        const thumbnails = await tx.orm.public.MediaAsset.where({ thumbnailObjectKey: key }).all();
        if ([...objects, ...thumbnails].some(row => row.id !== id)) throw new StoreError('This file is shared by another media asset and must be preserved.', 409);
      }
      // Delete both join tables atomically. Never touch purchases or consent.
      await tx.orm.public.MediaAssetCategory.where({ mediaAssetId: id }).delete();
      await tx.orm.public.MediaAssetPerformer.where({ mediaAssetId: id }).delete();
      await tx.orm.public.MediaAsset.where({ id, workspaceId: access.workspaceId }).delete();
      // Durable cleanup receipt. Private storage references stay in the server-side audit.
      const metadata = { workspaceId: access.workspaceId, bucketName: media.bucketName, objectKeys: keys, storageCleanup: 'PENDING' };
      const audit = await tx.orm.public.AuditLog.create({ userId: access.actorId, action: 'MEDIA_DELETED', entityType: 'MEDIA_ASSET', entityId: id, metadata });
      return { media, keys, auditId: audit.id, metadata };
    });

    // Delete bytes only AFTER all DB constraints and the audit commit succeeded.
    // Storage failures leave a durable cleanup receipt, never a broken live product.
    let storageCleanupPending = true;
    try {
      const client = getR2Client();
      for (const key of removed.keys) await client.send(new DeleteObjectCommand({ Bucket: removed.media.bucketName, Key: key }));
      storageCleanupPending = false;
      await db.orm.public.AuditLog.where({ id: removed.auditId }).updateAndCount({ metadata: { ...removed.metadata, storageCleanup: 'COMPLETED' } });
    } catch {
      console.error('MEDIA_STORAGE_CLEANUP_PENDING', { auditId: removed.auditId });
    }
    return Response.json({ success: true, mediaId: id, deletedFromStorage: !storageCleanupPending, storageCleanupPending,
      message: storageCleanupPending ? 'Media removed from the library. Storage cleanup is pending; an administrator can use the audit receipt to retry cleanup.' : 'Media deleted from the library and storage.' }, { headers });
  } catch (error) {
    const status = error instanceof StoreError || error instanceof AuthError ? error.status : 500;
    const message = error instanceof StoreError ? error.message : error instanceof AuthError ? 'Send a confirmed JSON request from this site.' : 'Unable to delete media. Related records may require preservation. No storage files were deleted.';
    return Response.json({ success: false, error: 'MEDIA_DELETE_FAILED', message }, { status, headers });
  }
}
