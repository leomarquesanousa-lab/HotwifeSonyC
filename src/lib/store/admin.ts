import 'server-only';
import { productInputSchema, resolveProductFields } from './product-fields';
import { db } from '@/src/prisma/db';
import { getCurrentSession } from '@/src/lib/auth/session';
import { assertSameOrigin, AuthError } from '@/src/lib/auth/request';
import type { StoreProduct } from './types';
import { assertCommercialPublication, contentFingerprint, ComplianceError } from '@/src/lib/compliance/service';

function serializeProduct(product: StoreProduct): StoreProduct {
  return { ...product, createdAt: new Date(product.createdAt).toISOString(), updatedAt: new Date(product.updatedAt).toISOString(), publishedAt: product.publishedAt ? new Date(product.publishedAt).toISOString() : null };
}

export class StoreError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export async function requireStoreManagementAccess() {
  const auth = await getCurrentSession();
  if (!auth) throw new StoreError('Sign in to manage your store.', 401);
  const member = await db.orm.public.WorkspaceMember.where({ userId: auth.user.id }).first();
  if (!member || !['OWNER', 'ADMIN', 'OPERATOR'].includes(member.role)) throw new StoreError('You do not have permission to manage this store.', 403);
  const workspace = await db.orm.public.Workspace.where({ id: member.workspaceId, status: 'ACTIVE' }).first();
  if (!workspace) throw new StoreError('This workspace is unavailable.', 403);
  return { workspaceId: member.workspaceId, actorId: auth.user.id, canDelete: ['OWNER', 'ADMIN'].includes(member.role) };
}
export async function requireStoreAccess() { return (await requireStoreManagementAccess()).workspaceId; }
export async function getStoreRemovalPreview(id: string) {
  const access = await requireStoreManagementAccess();
  if (!access.canDelete) throw new StoreError('You do not have permission to delete video products.', 403);
  const product = await db.orm.public.VideoProduct.where({ id, workspaceId: access.workspaceId }).select('id').first();
  if (!product) throw new StoreError('Product not found.', 404);
  const paid = await db.orm.public.Purchase.where({ videoProductId: id, status: 'PAID' }).select('userId').all();
  return { paidPurchaseCount: new Set(paid.map(purchase => purchase.userId)).size };
}
export async function archiveStoreProduct(id: string) {
  const access = await requireStoreManagementAccess();
  if (!access.canDelete) throw new StoreError('You do not have permission to delete video products.', 403);
  return db.transaction(async tx => {
    await tx.execute(db.raw.sql`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${'store-video-products'}, 0))`.returnsRow({ locked: 'pg/int4@1' }).build());
    const product = await tx.orm.public.VideoProduct.where({ id, workspaceId: access.workspaceId }).first();
    if (!product) throw new StoreError('Product not found.', 404);
    // Retries under the shared product lock do not duplicate audit events.
    if (product.status === 'ARCHIVED') return serializeProduct(product);
    const hasPurchases = !!await tx.orm.public.Purchase.where({ videoProductId: id }).select('id').first();
    await tx.orm.public.VideoProduct.where({ id, workspaceId: access.workspaceId }).updateAndCount({ status: 'ARCHIVED' });
    await tx.orm.public.AuditLog.create({ userId: access.actorId, action: 'CONTENT_ARCHIVED', entityType: 'VIDEO_PRODUCT', entityId: id, metadata: { workspaceId: access.workspaceId, previousStatus: product.status, status: 'ARCHIVED', source: 'STORE_DELETE', hasPurchases, purchasesPreserved: true, mediaPreserved: true } });
    const archived = await tx.orm.public.VideoProduct.where({ id, workspaceId: access.workspaceId }).first();
    if (!archived) throw new StoreError('Unable to archive video.', 500);
    return serializeProduct(archived);
  });
}
export async function listStoreMedia(workspaceId: string) {
  return db.orm.public.MediaAsset.where({ workspaceId, status: 'UPLOADED' })
    .select('id', 'originalFileName', 'mediaType', 'contentType', 'durationSeconds')
    .orderBy(m => m.createdAt.desc()).all();
}
export async function listStoreProducts(workspaceId: string) {
  const products = await db.orm.public.VideoProduct.where({ workspaceId }).orderBy(p => p.createdAt.desc()).all();
  return products.map(serializeProduct);
}
export async function saveStoreProduct(workspaceId: string, value: unknown, id?: string) {
  const result = productInputSchema.safeParse(value);
  if (!result.success) throw new StoreError(result.error.issues[0]?.message ?? 'Invalid product.');
  const submitted = result.data;
  const saved = await db.transaction(async tx => {
    const lock = db.raw.sql`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${'store-video-products'}, 0))`
      .returnsRow({ locked: 'pg/int4@1' }).build();
    await tx.execute(lock);
    const existing = id ? await tx.orm.public.VideoProduct.where({ id, workspaceId }).first() : null;
    if (id && !existing) throw new StoreError('Product not found.', 404);
    const input = resolveProductFields(submitted, existing);
    if (!input.mediaAssetId) throw new StoreError('Upload the full video before saving.');
    const duplicate = await tx.orm.public.VideoProduct.where({ slug: input.slug }).first();
    if (duplicate && duplicate.id !== id) throw new StoreError('This slug is already in use.', 409);
    const full = await tx.orm.public.MediaAsset.where({ id: input.mediaAssetId, workspaceId, status: 'UPLOADED', mediaType: 'VIDEO' }).first();
    if (!full || !full.contentType.startsWith('video/')) throw new StoreError('Upload a full video and wait for it to finish before saving.');
    if (await tx.orm.public.VideoProduct.where({ teaserMediaAssetId: full.id }).first()) throw new StoreError('This video is already used as a public teaser. Choose a separate full video.');
    if (input.teaserMediaAssetId) {
      if (input.teaserMediaAssetId === full.id) throw new StoreError('The teaser must be a separate video.');
      const teaser = await tx.orm.public.MediaAsset.where({ id: input.teaserMediaAssetId, workspaceId, status: 'UPLOADED', mediaType: 'VIDEO' }).first();
      if (!teaser || !teaser.contentType.startsWith('video/')) throw new StoreError('Wait for the teaser upload to finish before saving.');
      if (await tx.orm.public.VideoProduct.where({ mediaAssetId: teaser.id }).first()) throw new StoreError('A full product video cannot be used as a public teaser.');
    }
    if (input.thumbnailMediaAssetId) {
      const cover = await tx.orm.public.MediaAsset.where({ id: input.thumbnailMediaAssetId, workspaceId, status: 'UPLOADED', mediaType: 'IMAGE' }).first();
      if (!cover || !['image/jpeg', 'image/png', 'image/webp'].includes(cover.contentType)) throw new StoreError('Upload a JPEG, PNG, or WebP cover and wait for it to finish before saving.');
    }
    const data = input;
    if (input.status === 'PUBLISHED') {
      try { await assertCommercialPublication(tx, workspaceId, input, existing); }
      catch (error) { if (error instanceof ComplianceError) throw new StoreError(error.message, error.status); throw error; }
    }
    if (!id) return tx.orm.public.VideoProduct.create({ ...data, workspaceId, complianceStatus: 'DRAFT' });
    const changed = existing && contentFingerprint(existing) !== contentFingerprint(input);
    const blocked = existing && ['SUSPENDED', 'REMOVED'].includes(existing.complianceStatus);
    await tx.orm.public.VideoProduct.where({ id, workspaceId }).updateAndCount({ ...data, ...(changed && !blocked ? { complianceStatus: 'DRAFT' } : {}) });
    if (changed) await tx.orm.public.ContentReview.where({ workspaceId, videoProductId: id }).updateAndCount({ fingerprint: null, ...(blocked ? {} : { status: 'DRAFT' }) });
    return tx.orm.public.VideoProduct.where({ id, workspaceId }).first();
  });
  if (!saved) throw new StoreError('Unable to save product.', 500);
  return serializeProduct(saved);
}
export async function parseStoreBody(request: Request) {
  try { assertSameOrigin(request); }
  catch (error) {
    if (error instanceof AuthError) throw new StoreError(error.code === 'INVALID_ORIGIN' ? 'Invalid request origin.' : 'Send a JSON request.', error.code === 'INVALID_ORIGIN' ? 403 : 400);
    throw error;
  }
  const text = await request.text();
  if (text.length > 16000) throw new StoreError('Request is too large.', 413);
  try { return JSON.parse(text) as unknown; } catch { throw new StoreError('Invalid JSON.'); }
}
export function storeFailure(error: unknown) {
  return Response.json({ error: error instanceof StoreError ? error.message : 'Unable to complete the store request.' }, { status: error instanceof StoreError ? error.status : 500, headers: { 'Cache-Control': 'no-store' } });
}
