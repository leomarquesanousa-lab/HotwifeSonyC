import { getStoreRemovalPreview, archiveStoreProduct, StoreError, parseStoreBody, requireStoreAccess, saveStoreProduct, storeFailure } from '@/src/lib/store/admin';
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const workspaceId = await requireStoreAccess(); const { id } = await params; const body = await parseStoreBody(request); return Response.json({ product: await saveStoreProduct(workspaceId, body, id) }); }
  catch (error) { return storeFailure(error); }
}
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    return Response.json(await getStoreRemovalPreview(id), { headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' } });
  } catch (error) { return storeFailure(error); }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const body = await parseStoreBody(request);
    if (!body || typeof body !== 'object' || !('confirmed' in body) || body.confirmed !== true) throw new StoreError('Confirm deletion before continuing.');
    const { id } = await params;
    return Response.json({ product: await archiveStoreProduct(id) }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return storeFailure(error); }
}
