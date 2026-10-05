import 'server-only';
import { z } from 'zod';
import { db } from '@/src/prisma/db';
import { getCurrentSession } from '@/src/lib/auth/session';

export class PurchaseAccessError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
async function requireCustomer() {
  const auth = await getCurrentSession();
  if (!auth) throw new PurchaseAccessError('Sign in to access your videos.', 401);
  return auth.user;
}
export async function listPurchasedVideos() {
  const user = await requireCustomer();
  const purchases = await db.orm.public.Purchase.where({ userId: user.id, status: 'PAID' }).orderBy(p => p.createdAt.desc()).all();
  if (!purchases.length) return [];
  const products = await db.orm.public.VideoProduct.where(p => p.id.in(purchases.map(p => p.videoProductId))).select('id', 'title').all();
  const byId = new Map(products.map(p => [p.id, p]));
  return purchases.flatMap(p => { const product = byId.get(p.videoProductId); return product ? [product] : []; });
}
export async function requirePurchasedVideo(productId: string) {
  const user = await requireCustomer();
  if (!z.string().uuid().safeParse(productId).success) throw new PurchaseAccessError('Video access denied.', 403);
  const purchase = await db.orm.public.Purchase.where({ userId: user.id, videoProductId: productId, status: 'PAID' }).first();
  if (!purchase) throw new PurchaseAccessError('You have not purchased this video.', 403);
  const product = await db.orm.public.VideoProduct.where({ id: productId }).first();
  if (!product) throw new PurchaseAccessError('Video unavailable.', 404);
  const workspace = await db.orm.public.Workspace.where({ id: product.workspaceId, status: 'ACTIVE' }).first();
  if (!workspace) throw new PurchaseAccessError('Video unavailable.', 404);
  return product;
}
export async function getPurchasedVideoMedia(productId: string, kind: 'full' | 'cover') {
  const product = await requirePurchasedVideo(productId);
  const full = await db.orm.public.MediaAsset.where({ id: product.mediaAssetId, workspaceId: product.workspaceId, status: 'UPLOADED', mediaType: 'VIDEO' }).first();
  if (!full || !full.contentType.startsWith('video/')) throw new PurchaseAccessError('Video unavailable.', 404);
  if (kind === 'full') return { objectKey: full.objectKey, contentType: full.contentType };
  if (product.thumbnailMediaAssetId) {
    const cover = await db.orm.public.MediaAsset.where({ id: product.thumbnailMediaAssetId, workspaceId: product.workspaceId, status: 'UPLOADED', mediaType: 'IMAGE' }).first();
    if (cover && ['image/jpeg', 'image/png', 'image/webp'].includes(cover.contentType) && !await db.orm.public.VideoProduct.where({ mediaAssetId: cover.id }).first()) return { objectKey: cover.objectKey, contentType: cover.contentType };
  } else if (full.thumbnailObjectKey && full.thumbnailObjectKey !== full.objectKey) {
    const collision = await db.orm.public.MediaAsset.where({ objectKey: full.thumbnailObjectKey }).first();
    if (!collision || (collision.mediaType === 'IMAGE' && ['image/jpeg', 'image/png', 'image/webp'].includes(collision.contentType))) return { objectKey: full.thumbnailObjectKey, contentType: collision?.contentType ?? 'image/jpeg' };
  }
  throw new PurchaseAccessError('Cover unavailable.', 404);
}

// Trusted server integration only: not a Server Action or a public route.
// Call only AFTER a future gateway verifies payment, amount and currency.
// The demo checkout never calls this function or grants access.
export async function recordApprovedPurchase(value: unknown) {
  const input = z.object({ userId: z.string().uuid(), videoProductId: z.string().uuid(), amountCents: z.number().int().min(0).max(2147483647), currency: z.string().regex(/^[A-Z]{3}$/) }).strict().parse(value);
  return db.transaction(async tx => {
    await tx.execute(db.raw.sql`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${`purchase:${input.userId}:${input.videoProductId}`}, 0))`.returnsRow({ locked: 'pg/int4@1' }).build());
    const user = await tx.orm.public.User.where({ id: input.userId, status: 'ACTIVE' }).first();
    if (!user) throw new PurchaseAccessError('Customer unavailable.', 404);
    const purchases = await tx.orm.public.Purchase.where({ userId: input.userId, videoProductId: input.videoProductId }).all();
    const active = purchases.find(p => p.status === 'PENDING' || p.status === 'PAID');
    if (active) {
      if (active.amountCents !== input.amountCents || active.currency !== input.currency) throw new PurchaseAccessError('Payment does not match the purchase.', 409);
      if (active.status === 'PAID') return active;
      await tx.orm.public.Purchase.where({ id: active.id, status: 'PENDING' }).updateAndCount({ status: 'PAID' });
      return tx.orm.public.Purchase.where({ id: active.id }).first();
    }
    const product = await tx.orm.public.VideoProduct.where({ id: input.videoProductId, status: 'PUBLISHED' }).where(p => p.publishedAt.lte(new Date().toISOString())).first();
    const workspace = product ? await tx.orm.public.Workspace.where({ id: product.workspaceId, status: 'ACTIVE' }).first() : null;
    if (!product || !workspace) throw new PurchaseAccessError('Product unavailable.', 404);
    if (product.priceCents !== input.amountCents || product.currency !== input.currency) throw new PurchaseAccessError('Payment does not match the product price.', 409);
    return tx.orm.public.Purchase.create({ ...input, status: 'PAID' });
  });
}
export function purchaseFailure(error: unknown) {
  return Response.json({ error: error instanceof PurchaseAccessError ? error.message : 'Unable to access this video.' }, { status: error instanceof PurchaseAccessError ? error.status : 500, headers: { 'Cache-Control': 'private, no-store', 'Vary': 'Cookie' } });
}
