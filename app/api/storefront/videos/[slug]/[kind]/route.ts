import { NextRequest } from 'next/server';
import { resolvePublicMedia } from '@/src/lib/store/public';
import { getR2ObjectDownloadUrl } from '@/src/lib/storage/r2';
export const dynamic = 'force-dynamic';
const privateHeaders = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };
export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string; kind: string }> }) {
  const { slug, kind } = await params;
  if (kind !== 'teaser' && kind !== 'thumbnail') return new Response(null, { status: 404 });
  try {
    const media = await resolvePublicMedia(slug, kind);
    if (!media) return kind === 'thumbnail'
      ? new Response(null, { status: 307, headers: { ...privateHeaders, Location: '/storefront/scene-1.svg' } })
      : new Response(null, { status: 404, headers: privateHeaders });
    const range = request.headers.get('range');
    if (range && !/^bytes=\d*-\d*$/.test(range)) return new Response(null, { status: 416, headers: privateHeaders });
    const signedUrl = await getR2ObjectDownloadUrl(media.objectKey, 120);
    const upstream = await fetch(signedUrl, {
      headers: range ? { Range: range } : {}, cache: 'no-store', signal: request.signal,
    });
    if (![200, 206, 416].includes(upstream.status)) return new Response(null, { status: 502, headers: privateHeaders });
    const headers = new Headers(privateHeaders);
    headers.set('Content-Type', kind === 'thumbnail' ? upstream.headers.get('content-type') ?? media.contentType : media.contentType);
    for (const name of ['content-length', 'content-range', 'accept-ranges']) {
      const value = upstream.headers.get(name); if (value) headers.set(name, value);
    }
    return new Response(upstream.body, { status: upstream.status, headers });
  } catch {
    return new Response(null, { status: 503, headers: privateHeaders });
  }
}
