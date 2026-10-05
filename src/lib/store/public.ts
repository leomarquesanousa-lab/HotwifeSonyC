import 'server-only';
import { cache } from 'react';
import { db } from '@/src/prisma/db';
import type { VideoProduct } from '@/components/storefront/data';

export const getPublishedVideos = cache(async (): Promise<VideoProduct[]> => {
  const products = await db.orm.public.VideoProduct.where({ status: 'PUBLISHED' })
    .where(p => p.publishedAt.lte(new Date().toISOString()))
    .orderBy(p => p.publishedAt.desc()).all();
  if (!products.length) return [];
  const [media, workspaces, fullMedia] = await Promise.all([
    db.orm.public.MediaAsset.where(m => m.id.in(products.flatMap(p => [p.mediaAssetId, ...(p.teaserMediaAssetId ? [p.teaserMediaAssetId] : [])])))
      .select('id', 'workspaceId', 'status', 'mediaType', 'contentType', 'durationSeconds').all(),
    db.orm.public.Workspace.where(w => w.id.in(products.map(p => p.workspaceId))).select('id', 'status').all(),
    db.orm.public.VideoProduct.select('mediaAssetId').all(),
  ]);
  const assets = new Map(media.map(m => [m.id, m]));
  const protectedIds = new Set(fullMedia.map(p => p.mediaAssetId));
  const activeWorkspaces = new Set(workspaces.filter(w => w.status === 'ACTIVE').map(w => w.id));
  return products.flatMap(product => {
    const full = assets.get(product.mediaAssetId);
    if (!activeWorkspaces.has(product.workspaceId) || !full || full.workspaceId !== product.workspaceId || full.status !== 'UPLOADED' || full.mediaType !== 'VIDEO') return [];
    const teaser = product.teaserMediaAssetId ? assets.get(product.teaserMediaAssetId) : null;
    const hasTeaser = teaser && teaser.workspaceId === product.workspaceId && teaser.status === 'UPLOADED' && teaser.mediaType === 'VIDEO' && teaser.contentType.startsWith('video/') && !protectedIds.has(teaser.id);
    const seconds = full.durationSeconds;
    const duration = seconds == null ? 'Duration unavailable' : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
    const publishedAt = new Date(product.publishedAt!).toISOString();
    const isNew = Date.now() - new Date(publishedAt).getTime() < 14 * 86400000;
    return [{
      id: product.id, slug: product.slug, title: product.title, description: product.description,
      priceCents: product.priceCents, currency: product.currency, category: product.category,
      duration, featured: product.featured, publishedAt,
      thumbnail: `/api/storefront/videos/${encodeURIComponent(product.slug)}/thumbnail`,
      badge: product.featured ? 'Featured' : isNew ? 'New' : undefined,
      tags: [product.category],
      teaser: { source: hasTeaser ? `/api/storefront/videos/${encodeURIComponent(product.slug)}/teaser` : null },
    }];
  });
});

export async function getPublishedVideo(slug: string) {
  return (await getPublishedVideos()).find(video => video.slug === slug) ?? null;
}

export async function resolvePublicMedia(slug: string, kind: string) {
  if (kind !== 'teaser' && kind !== 'thumbnail') return null;
  const product = await db.orm.public.VideoProduct.where({ slug, status: 'PUBLISHED' })
    .where(p => p.publishedAt.lte(new Date().toISOString())).first();
  if (!product) return null;
  const [workspace, full] = await Promise.all([
    db.orm.public.Workspace.where({ id: product.workspaceId, status: 'ACTIVE' }).first(),
    db.orm.public.MediaAsset.where({ id: product.mediaAssetId, workspaceId: product.workspaceId, status: 'UPLOADED', mediaType: 'VIDEO' }).first(),
  ]);
  if (!workspace || !full) return null;
  if (kind === 'thumbnail' && !product.thumbnailMediaAssetId) {
    if (!full.thumbnailObjectKey || full.thumbnailObjectKey === full.objectKey) return null;
    const collision = await db.orm.public.MediaAsset.where({ objectKey: full.thumbnailObjectKey }).first();
    if (collision && (collision.mediaType !== 'IMAGE' || !collision.contentType.startsWith('image/'))) return null;
    return { objectKey: full.thumbnailObjectKey, contentType: 'image/jpeg' };
  }
  const assetId = kind === 'teaser' ? product.teaserMediaAssetId : product.thumbnailMediaAssetId;
  if (!assetId || assetId === product.mediaAssetId) return null;
  const asset = await db.orm.public.MediaAsset.where({ id: assetId, workspaceId: product.workspaceId, status: 'UPLOADED' }).first();
  if (!asset) return null;
  if (await db.orm.public.VideoProduct.where({ mediaAssetId: asset.id }).first()) return null;
  if (kind === 'teaser' && (asset.mediaType !== 'VIDEO' || !asset.contentType.startsWith('video/'))) return null;
  if (kind === 'thumbnail' && (asset.mediaType !== 'IMAGE' || !['image/jpeg', 'image/png', 'image/webp'].includes(asset.contentType))) return null;
  return { objectKey: asset.objectKey, contentType: asset.contentType };
}
