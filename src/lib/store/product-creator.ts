import type { AuthTransaction } from '@/src/lib/auth/audit';
type Reader = Pick<AuthTransaction, 'orm'>;
// This reviewed account/profile link identifies the default creator, not who else
// appears in a particular upload and not whether its content has been reviewed.
export async function primaryCreatorId(tx: Reader, workspaceId: string): Promise<string | null> {
  const owners = await tx.orm.public.WorkspaceMember.where({ workspaceId, role: 'OWNER' }).all();
  if (owners.length !== 1 || !await tx.orm.public.User.where({ id: owners[0].userId, status: 'ACTIVE' }).first()) return null;
  const note = await tx.orm.public.ComplianceNote.where({ workspaceId, objectType: 'CREATOR_LINK', objectId: owners[0].userId }).orderBy(row => row.createdAt.desc()).first();
  if (!note) return null;
  let value;
  try { value = JSON.parse(note.body); } catch { return null; }
  if (!value || value.samePersonReviewed !== true || typeof value.performerId !== 'string') return null;
  const person = await tx.orm.public.Performer.where({ workspaceId, id: value.performerId, status: 'ACTIVE' }).first();
  return person?.id ?? null;
}
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
  const note = await tx.orm.public.ComplianceNote.where({ workspaceId: product.workspaceId, objectType: 'PRODUCT_PARTICIPANTS', objectId: product.id }).orderBy(row => row.createdAt.desc()).first();
  const participantIds: string[] = note ? JSON.parse(note.body).participantIds : [];
  if (!Array.isArray(participantIds) || participantIds.some(id => typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id))) throw new Error('Invalid stored participant association.');
  const mediaIds = ['mediaAssetId', 'teaserMediaAssetId', 'thumbnailMediaAssetId'].flatMap(key => {
    const value = (product as Record<string, unknown>)[key]; return typeof value === 'string' ? [value] : [];
  });
  const links = mediaIds.length ? await tx.orm.public.MediaAssetPerformer.where({ workspaceId: product.workspaceId }).where(link => link.mediaAssetId.in(mediaIds)).all() : [];
  const consents = await tx.orm.public.ContentConsent.where({ workspaceId: product.workspaceId, videoProductId: product.id }).select('performerId').all();
  const knownParticipantIds = [...new Set([...links.map(link => link.performerId), ...consents.map(consent => consent.performerId)])];
  return { ...product, creatorId: await productCreatorId(tx, product.workspaceId, product.id), participantIds, knownParticipantIds };
}
export async function recordProductParticipants(tx: Reader, workspaceId: string, productId: string, actorId: string, participantIds: string[]) {
  await tx.orm.public.ComplianceNote.create({ workspaceId, objectType: 'PRODUCT_PARTICIPANTS', objectId: productId, actorId, body: JSON.stringify({ participantIds: [...participantIds].sort() }) });
}
export async function recordProductCreator(tx: Reader, workspaceId: string, productId: string, actorId: string, creatorId: string | null) {
  await tx.orm.public.ComplianceNote.create({ workspaceId, objectType: 'PRODUCT_CREATOR', objectId: productId, actorId, body: JSON.stringify({ creatorId }) });
}
