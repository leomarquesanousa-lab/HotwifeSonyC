import { listStoreProducts, parseStoreBody, requireStoreAccess, saveStoreProduct, storeFailure } from '@/src/lib/store/admin';
export async function GET() {
  try { const workspaceId = await requireStoreAccess(); return Response.json({ products: await listStoreProducts(workspaceId) }, { headers: { 'Cache-Control': 'no-store' } }); }
  catch (error) { return storeFailure(error); }
}
export async function POST(request: Request) {
  try { const workspaceId = await requireStoreAccess(); const body = await parseStoreBody(request); return Response.json({ product: await saveStoreProduct(workspaceId, body) }, { status: 201 }); }
  catch (error) { return storeFailure(error); }
}
