import { getPurchasedVideoMedia, purchaseFailure } from '@/src/lib/store/purchases';
import { getR2ObjectDownloadUrl } from '@/src/lib/storage/r2';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const media = await getPurchasedVideoMedia(id, 'cover');
    const upstream = await fetch(await getR2ObjectDownloadUrl(media.objectKey, 120), { cache: 'no-store' });
    if (!upstream.ok) return new Response(null, { status: 404, headers: { 'Cache-Control': 'no-store' } });
    return new Response(upstream.body, { headers: { 'Content-Type': media.contentType, 'Cache-Control': 'private, no-store', 'Vary': 'Cookie', 'X-Content-Type-Options': 'nosniff' } });
  } catch (error) { return purchaseFailure(error); }
}
