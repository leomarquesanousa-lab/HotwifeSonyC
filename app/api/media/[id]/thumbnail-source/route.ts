import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/src/lib/auth/session';
import { getR2ObjectDownloadUrl } from '@/src/lib/storage/r2';
import { db } from '@/src/prisma/db';
import { canPreviewVideo } from '@/src/lib/auth/video-preview-access';

export const runtime = 'nodejs';
const privateHeaders = { 'Cache-Control': 'private, no-store', Vary: 'Cookie', 'X-Content-Type-Options': 'nosniff' };
const failure = (error: string, status: number) => NextResponse.json({ success: false, error }, { status, headers: privateHeaders });

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getCurrentSession();
    if (!session) return failure('UNAUTHORIZED', 401);
    const membership = await db.orm.public.WorkspaceMember.where({ userId: session.user.id }).first();
    if (!membership) return failure('WORKSPACE_NOT_FOUND', 404);
    if (!canPreviewVideo(membership)) return failure('PREVIEW_ACCESS_REQUIRED', 403);
    const { id } = await context.params;
    // Membership/role are checked first; independent scoped reads run together.
    const [workspace, media] = await Promise.all([
      db.orm.public.Workspace.where({ id: membership.workspaceId, status: 'ACTIVE' }).first(),
      db.orm.public.MediaAsset.where({ id, workspaceId: membership.workspaceId }).first(),
    ]);
    if (!workspace) return failure('PREVIEW_ACCESS_REQUIRED', 403);
    if (!media) return failure('MEDIA_NOT_FOUND', 404);
    if (media.status !== 'UPLOADED') return failure('MEDIA_NOT_READY', 409);

    const sourceUrl = await getR2ObjectDownloadUrl(media.objectKey, 15 * 60);
    const range = request.headers.get('range');
    const upstream = await fetch(sourceUrl, {
      method: 'GET', headers: range ? { Range: range } : undefined,
      cache: 'no-store', signal: request.signal,
    });
    if (![200, 206, 416].includes(upstream.status)) {
      await upstream.body?.cancel();
      return failure('THUMBNAIL_SOURCE_FAILED', 502);
    }
    if (!upstream.body && upstream.status !== 416) return failure('THUMBNAIL_SOURCE_EMPTY', 502);
    const headers = new Headers(privateHeaders);
    headers.set('Content-Type', upstream.headers.get('content-type') || media.contentType || 'video/mp4');
    for (const name of ['content-length', 'content-range', 'accept-ranges']) {
      const value = upstream.headers.get(name);
      if (value) headers.set(name, value);
    }
    // Preserve 416 (including bytes */size), even when its response has no body.
    // Do not advertise range support unless the upstream actually advertised it.
    return new NextResponse(upstream.body, { status: upstream.status, headers });
  } catch {
    // Upstream error text can contain private keys/URLs: never log or return it.
    return failure('INTERNAL_ERROR', 500);
  }
}
