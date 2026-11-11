import { redirect } from 'next/navigation';
import StoreVideos from '@/src/components/store/StoreVideos';
import { listStoreMedia, listStoreProducts, requireStoreManagementAccess, StoreError } from '@/src/lib/store/admin';
export const metadata = { title: 'Videos for Sale · HotwifeSonyC' };
export default async function Page({ searchParams }: { searchParams: Promise<{ mediaId?: string | string[] }> }) {
  const query = await searchParams;
  const initialMediaId = typeof query.mediaId === 'string' && /^[0-9a-f-]{36}$/i.test(query.mediaId) ? query.mediaId : undefined;
  let workspaceId: string;
  let canDelete = false;
  try { const access = await requireStoreManagementAccess(); workspaceId = access.workspaceId; canDelete = access.canDelete; }
  catch (error) { if (error instanceof StoreError && error.status === 401) redirect(`/login`); if (error instanceof StoreError && error.status === 403) return <div className="p-8 text-white/60">You do not have permission to manage this store.</div>; throw error; }
  const [products, media] = await Promise.all([listStoreProducts(workspaceId), listStoreMedia(workspaceId)]);
  return <StoreVideos key={initialMediaId ?? 'all'} initialProducts={products} media={media} canDelete={canDelete} initialMediaId={initialMediaId}/>;
}
