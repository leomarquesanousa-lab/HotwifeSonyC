import 'server-only';
import { productInputSchema, resolveProductFields } from './product-fields';
import { db } from '@/src/prisma/db';
import { getCurrentSession } from '@/src/lib/auth/session';
import { assertSameOrigin, AuthError } from '@/src/lib/auth/request';
import type { StoreProduct } from './types';

function serializeProduct(product: StoreProduct): StoreProduct {
  return { ...product, createdAt: new Date(product.createdAt).toISOString(), updatedAt: new Date(product.updatedAt).toISOString(), publishedAt: product.publishedAt ? new Date(product.publishedAt).toISOString() : null };
}

export class StoreError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export async function requireStoreAccess() {
  const auth = await getCurrentSession();
  if (!auth) throw new StoreError('Sign in to manage your store.', 401);
  const member = await db.orm.public.WorkspaceMember.where({ userId: auth.user.id }).first();
  if (!member || !['OWNER', 'ADMIN', 'OPERATOR'].includes(member.role)) throw new StoreError('You do not have permission to manage this store.', 403);
  const workspace = await db.orm.public.Workspace.where({ id: member.workspaceId, status: 'ACTIVE' }).first();
  if (!workspace) throw new StoreError('This workspace is unavailable.', 403);
  return member.workspaceId;
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
    if (!id) return tx.orm.public.VideoProduct.create({ ...data, workspaceId });
    await tx.orm.public.VideoProduct.where({ id, workspaceId }).updateAndCount(data);
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
