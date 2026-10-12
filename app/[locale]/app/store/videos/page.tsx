import { redirect } from 'next/navigation';
import StoreVideos from '@/src/components/store/StoreVideos';
import { listStoreMedia, listStoreProducts, requireStoreManagementAccess, StoreError } from '@/src/lib/store/admin';
export const metadata = { title: 'Videos for Sale · HotwifeSonyC' };
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  let workspaceId: string;
  let canDelete = false;
  try { const access = await requireStoreManagementAccess(); workspaceId = access.workspaceId; canDelete = access.canDelete; }
  catch (error) { if (error instanceof StoreError && error.status === 401) redirect(`/login`); if (error instanceof StoreError && error.status === 403) return <div className="p-8 text-white/60">You do not have permission to manage this store.</div>; throw error; }
  const [products, media] = await Promise.all([listStoreProducts(workspaceId), listStoreMedia(workspaceId)]);
  return <StoreVideos locale={locale} initialProducts={products} media={media} canDelete={canDelete}/>;
}
