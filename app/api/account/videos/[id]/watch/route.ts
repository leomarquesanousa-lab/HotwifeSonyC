import { getPurchasedVideoMedia, purchaseFailure } from '@/src/lib/store/purchases';
import { getR2ObjectDownloadUrl } from '@/src/lib/storage/r2';
import { assertSameOrigin, AuthError } from '@/src/lib/auth/request';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const { id } = await params;
    const media = await getPurchasedVideoMedia(id, 'full');
    const url = await getR2ObjectDownloadUrl(media.objectKey, 15 * 60);
    return Response.json({ url }, { headers: { 'Cache-Control': 'private, no-store', 'Vary': 'Cookie' } });
  } catch (error) {
    if (error instanceof AuthError) return Response.json({ error: error.code === 'INVALID_ORIGIN' ? 'Invalid request origin.' : 'Send a JSON request.' }, { status: error.status, headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' } });
    return purchaseFailure(error);
  }
}
