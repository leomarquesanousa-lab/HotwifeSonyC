import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { requireAdministrativeAccess } from '@/src/lib/auth/admin-access';
import { AuthError } from '@/src/lib/auth/request';
import { db } from '@/src/prisma/db';

export const getAdminContext = cache(async (locale: string) => {
  let auth;
  try { auth = await requireAdministrativeAccess(); }
  catch (error) {
    if (error instanceof AuthError && error.status === 401) redirect('/login');
    if (error instanceof AuthError && error.status === 403) redirect('/account');
    throw error;
  }
  const {membership, workspace} = auth;
  return {
    user: { id: auth.user.id, firstName: auth.user.firstName, lastName: auth.user.lastName, email: auth.user.email, locale: auth.user.locale, timezone: auth.user.timezone },
    workspace, role: membership?.role ?? null,
  };
});

export const getStoreOverview = cache(async (workspaceId: string) => {
  const [media, products] = await Promise.all([
    db.orm.public.MediaAsset.where({workspaceId}).select('id','originalFileName','status','lastErrorCode','createdAt','uploadCompletedAt','updatedAt').all(),
    db.orm.public.VideoProduct.where({workspaceId}).select('id','mediaAssetId','title','description','slug','status','featured','publishedAt','updatedAt','teaserMediaAssetId').all(),
  ]);
  const uploadedIds = new Set(media.filter(item => item.status === 'UPLOADED').map(item => item.id));
  const live = products.filter(item => item.status === 'PUBLISHED' && item.publishedAt && new Date(item.publishedAt).getTime() <= Date.now() && uploadedIds.has(item.mediaAssetId));
  const failures = media.filter(item => item.status === 'FAILED' || item.lastErrorCode);
  const recent = [
    ...media.filter(item => item.status === 'UPLOADED').map(item => ({ id: `media-${item.id}`, title: 'Media uploaded', detail: item.originalFileName, date: item.uploadCompletedAt ?? item.createdAt, destination: 'media' })),
    ...products.map(item => ({ id: `product-${item.id}`, title: 'Product updated', detail: `${item.title} · ${item.status}`, date: item.updatedAt, destination: 'store/videos' })),
  ].sort((a,b) => new Date(b.date).getTime()-new Date(a.date).getTime()).slice(0,6);
  return {
    totals: { media: media.length, products: products.length, published: products.filter(item => item.status === 'PUBLISHED').length, drafts: products.filter(item => item.status === 'DRAFT').length, archived: products.filter(item => item.status === 'ARCHIVED').length, featured: products.filter(item => item.featured).length, live: live.length },
    recent,
    failureCount: failures.length,
    failures: failures.sort((a,b) => new Date(b.updatedAt).getTime()-new Date(a.updatedAt).getTime()).slice(0,4).map(item => ({id:item.id,name:item.originalFileName,code:item.lastErrorCode ?? 'MEDIA_FAILED'})),
    coverage: { liveWithTeaser: live.filter(item => item.teaserMediaAssetId).length, liveWithDescription: live.filter(item => item.description.trim()).length },
  };
});
export type StoreOverview = Awaited<ReturnType<typeof getStoreOverview>>;
