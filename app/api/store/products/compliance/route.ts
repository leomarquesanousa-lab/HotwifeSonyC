import { z } from 'zod';
import { db } from '@/src/prisma/db';
import { ownerPublicationContext, ComplianceError } from '@/src/lib/compliance/service';
import { parseStoreBody, requireStoreManagementAccess, StoreError, storeFailure } from '@/src/lib/store/admin';

const inputSchema = z.object({ id: z.string().uuid().optional(), mediaAssetId: z.string().uuid(), teaserMediaAssetId: z.string().uuid().nullable(), thumbnailMediaAssetId: z.string().uuid().nullable(), title: z.string().max(160), slug: z.string().max(160), description: z.string().max(5000), category: z.string().max(80) }).strict();
export async function POST(request: Request) {
  try {
    const access = await requireStoreManagementAccess();
    if (!access.canPublishDirectly) throw new StoreError('Direct publication requires OWNER.', 403);
    const result = inputSchema.safeParse(await parseStoreBody(request));
    if (!result.success) throw new StoreError('Complete the product details to check publication readiness.');
    const { id, ...input } = result.data;
    const state = await db.transaction(async tx => {
      const existing = id ? await tx.orm.public.VideoProduct.where({ workspaceId: access.workspaceId, id }).first() : null;
      if (id && !existing) throw new StoreError('Product not found.', 404);
      const fields = input;
      const assets = [fields.mediaAssetId, fields.teaserMediaAssetId, fields.thumbnailMediaAssetId].filter((value): value is string => !!value);
      for (const assetId of assets) if (!await tx.orm.public.MediaAsset.where({ workspaceId: access.workspaceId, id: assetId, status: 'UPLOADED' }).first()) throw new StoreError('Wait for the media upload to finish.');
      const context = await ownerPublicationContext(tx, access.workspaceId, access.actorId, { ...fields, id, complianceStatus: existing?.complianceStatus });
      const { recordedOn, needsAttestation, people, missingConsentIds, pending } = context;
      return { recordedOn, needsAttestation, people, missingConsentIds, pending };
    });
    return Response.json(state, { headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' } });
  } catch (error) { return storeFailure(error instanceof ComplianceError ? new StoreError(error.message, error.status) : error); }
}
