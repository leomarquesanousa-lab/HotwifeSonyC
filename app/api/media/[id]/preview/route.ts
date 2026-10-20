import { NextRequest, NextResponse } from 'next/server';
import { requireAdministrativeAccess } from '@/src/lib/auth/admin-access';
import { AuthError } from '@/src/lib/auth/request';
import { getR2ObjectDownloadUrl } from '@/src/lib/storage/r2';
import { db } from '@/src/prisma/db';
import { canPreviewVideo } from '@/src/lib/auth/video-preview-access';

const headers = { 'Cache-Control': 'private, no-store', Vary: 'Cookie' };
export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { workspace, membership } = await requireAdministrativeAccess();
    if (!canPreviewVideo(membership)) throw new AuthError('PREVIEW_ACCESS_REQUIRED', 403);
    const { id } = await context.params;
    const media = await db.orm.public.MediaAsset.where({ id: id.trim(), workspaceId: workspace.id }).first();
    if (!media) return NextResponse.json({ success: false, error: 'MEDIA_NOT_FOUND' }, { status: 404, headers });
    if (!['UPLOADED', 'READY'].includes(media.status) || !media.objectKey) return NextResponse.json({ success: false, error: 'MEDIA_NOT_READY' }, { status: 409, headers });
    const expiresIn = 900;
    const previewUrl = await getR2ObjectDownloadUrl(media.objectKey, expiresIn);
    return NextResponse.json({ success: true, mediaId: media.id, previewUrl, expiresIn }, { headers });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ success: false, error: error.message }, { status: error.status, headers });
    console.error('MEDIA_PREVIEW_ERROR', error);
    return NextResponse.json({ success: false, error: 'PREVIEW_UNAVAILABLE' }, { status: 500, headers });
  }
}
