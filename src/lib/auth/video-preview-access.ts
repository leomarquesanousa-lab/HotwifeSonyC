import 'server-only';
import { db } from '@/src/prisma/db';

// Explicit, workspace-scoped grants. Membership IDs are deployment configuration,
// never supplied by the browser. Empty configuration denies OPERATOR preview.
export function canPreviewVideo(membership: { id: string; role: string }) {
  if (['OWNER', 'ADMIN'].includes(membership.role)) return true;
  return membership.role === 'OPERATOR' && (process.env.OPERATOR_PREVIEW_MEMBERSHIP_IDS ?? '')
    .split(',').map(id => id.trim()).filter(Boolean).includes(membership.id);
}

export async function hasVideoPreviewAccess(userId: string, workspaceId: string) {
  const membership = await db.orm.public.WorkspaceMember.where({ userId, workspaceId }).first();
  return !!membership && canPreviewVideo(membership);
}
