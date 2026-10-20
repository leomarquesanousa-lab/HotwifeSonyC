import type { AuthTransaction } from '@/src/lib/auth/audit';
type Reader = Pick<AuthTransaction, 'orm'>;
// Product-scoped association, independent of shared media and identity approvals.
export async function productCreatorId(tx: Reader, workspaceId: string, productId: string): Promise<string | null> {
  const note = await tx.orm.public.ComplianceNote.where({ workspaceId, objectType: 'PRODUCT_CREATOR', objectId: productId }).orderBy(row => row.createdAt.desc()).first();
  if (!note) return null;
  const value = JSON.parse(note.body);
  if (value.creatorId === null) return null;
  if (typeof value.creatorId !== 'string' || !/^[0-9a-f-]{36}$/i.test(value.creatorId)) throw new Error('Invalid stored product creator association.');
  return value.creatorId;
}
export async function withProductCreator<T extends { workspaceId: string; id: string }>(tx: Reader, product: T) {
  return { ...product, creatorId: await productCreatorId(tx, product.workspaceId, product.id) };
}
export async function recordProductCreator(tx: Reader, workspaceId: string, productId: string, actorId: string, creatorId: string | null) {
  await tx.orm.public.ComplianceNote.create({ workspaceId, objectType: 'PRODUCT_CREATOR', objectId: productId, actorId, body: JSON.stringify({ creatorId }) });
}
