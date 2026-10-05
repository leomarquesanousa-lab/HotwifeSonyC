import { getPurchasedVideoMedia, purchaseFailure } from '@/src/lib/store/purchases';
import { getR2ObjectDownloadUrl } from '@/src/lib/storage/r2';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const origin = request.headers.get('origin');
  if ((origin && origin !== new URL(request.url).origin) || request.headers.get('sec-fetch-site') === 'cross-site') return Response.json({ error: 'Invalid request origin.' }, { status: 403, headers: { 'Cache-Control': 'no-store' } });
  try {
    const { id } = await params;
    const media = await getPurchasedVideoMedia(id, 'full');
    const url = await getR2ObjectDownloadUrl(media.objectKey, 15 * 60);
    return Response.json({ url }, { headers: { 'Cache-Control': 'private, no-store', 'Vary': 'Cookie' } });
  } catch (error) { return purchaseFailure(error); }
}
