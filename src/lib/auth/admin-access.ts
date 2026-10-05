import 'server-only';
import { db } from '@/src/prisma/db';
import { getCurrentSession } from './session';
import { AuthError } from './request';

export const ADMIN_ROLES = ['OWNER', 'ADMIN', 'OPERATOR'] as const;
export async function getAdministrativeMembership(userId: string) {
  const memberships = await db.orm.public.WorkspaceMember.where({ userId })
    .where(member => member.role.in([...ADMIN_ROLES])).all();
  for (const membership of memberships) {
    const workspace = await db.orm.public.Workspace.where({ id: membership.workspaceId, status: 'ACTIVE' }).first();
    if (workspace) return { membership, workspace };
  }
  return null;
}
export async function requireAdministrativeAccess() {
  const auth = await getCurrentSession();
  if (!auth) throw new AuthError('UNAUTHORIZED', 401);
  const access = await getAdministrativeMembership(auth.user.id);
  if (!access) throw new AuthError('ADMIN_ACCESS_REQUIRED', 403);
  return { ...auth, ...access };
}
export async function requireOwnerAccess() {
  const access = await requireAdministrativeAccess();
  if (access.membership.role !== 'OWNER') throw new AuthError('OWNER_ACCESS_REQUIRED', 403);
  return access;
}
