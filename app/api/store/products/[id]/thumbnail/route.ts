import { requireStoreAccess, storeFailure } from '@/src/lib/store/admin';
import { db } from '@/src/prisma/db';
import { getR2ObjectDownloadUrl } from '@/src/lib/storage/r2';
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const workspaceId = await requireStoreAccess(); const { id } = await params;
    const product = await db.orm.public.VideoProduct.where({ id, workspaceId }).first();
    if (!product) return new Response(null, { status: 404 });
    const media = await db.orm.public.MediaAsset.where({ id: product.thumbnailMediaAssetId ?? product.mediaAssetId, workspaceId, status: 'UPLOADED' }).first();
    const key = product.thumbnailMediaAssetId && media?.mediaType === 'IMAGE' ? media.objectKey : media?.thumbnailObjectKey;
    if (!key || key === (product.thumbnailMediaAssetId ? '' : media?.objectKey)) return new Response(null, { status: 307, headers: { Location: '/storefront/scene-1.svg', 'Cache-Control': 'no-store' } });
    const url = await getR2ObjectDownloadUrl(key, 120);
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) return new Response(null, { status: 502 });
    return new Response(response.body, { headers: { 'Content-Type': response.headers.get('content-type') ?? 'image/jpeg', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
  } catch (error) { return storeFailure(error); }
}
