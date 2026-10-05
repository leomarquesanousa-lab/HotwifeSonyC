import { parseStoreBody, requireStoreAccess, saveStoreProduct, storeFailure } from '@/src/lib/store/admin';
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const workspaceId = await requireStoreAccess(); const { id } = await params; const body = await parseStoreBody(request); return Response.json({ product: await saveStoreProduct(workspaceId, body, id) }); }
  catch (error) { return storeFailure(error); }
}
