import { listStoreMedia, requireStoreAccess, storeFailure } from '@/src/lib/store/admin';
export async function GET() {
  try { const workspaceId = await requireStoreAccess(); return Response.json({ media: await listStoreMedia(workspaceId) }, { headers: { 'Cache-Control': 'no-store' } }); }
  catch (error) { return storeFailure(error); }
}
