import type { AuthTransaction } from '@/src/lib/auth/audit';
type Reader = Pick<AuthTransaction, 'orm'>;
export type VideoEvidence = { mediaFingerprint: string; performerId: string; rightsEvidenceRef: string | null; rightsReviewId: string | null };
export async function videoEvidence(tx: Reader, workspaceId: string, productId: string, fingerprint: string, performerId: string): Promise<VideoEvidence | null> {
  const note = await tx.orm.public.ComplianceNote.where({ workspaceId, objectType: 'VIDEO_EVIDENCE', objectId: productId }).orderBy(row => row.createdAt.desc()).first();
  if (!note) return null;
  const value = JSON.parse(note.body);
  if (value.mediaFingerprint !== fingerprint || value.performerId !== performerId) return null;
  return { mediaFingerprint: fingerprint, performerId, rightsEvidenceRef: typeof value.rightsEvidenceRef === 'string' ? value.rightsEvidenceRef : null, rightsReviewId: typeof value.rightsReviewId === 'string' ? value.rightsReviewId : null };
}
