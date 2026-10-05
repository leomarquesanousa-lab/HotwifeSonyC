import 'server-only';
import { z } from 'zod';
import { db } from '@/src/prisma/db';
import { requireOwnerAccess, ADMIN_ROLES } from './admin-access';
import { AuthError, emailSchema, passwordSchema } from './request';
import { hashPassword } from './password-hash';
import { hashAuthToken } from './tokens';
import { lockAuthKey, type AuthTransaction } from './audit';

export const createAdminSchema = z.object({
  name: z.string().trim().min(2).max(160), email: emailSchema,
  password: passwordSchema, role: z.enum(['ADMIN', 'OPERATOR']),
}).strict();
export const updateAdminSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('CHANGE_ROLE'), role: z.enum(['ADMIN', 'OPERATOR']) }).strict(),
  z.object({ action: z.literal('REMOVE_ACCESS') }).strict(),
]);
export type AdministrativeUser = {
  membershipId: string; userId: string; name: string; email: string; role: string; status: string;
};
async function recheckOwner(tx: AuthTransaction, actor: Awaited<ReturnType<typeof requireOwnerAccess>>) {
  await lockAuthKey(tx, 'admin-users:' + actor.workspace.id);
  const user = await tx.orm.public.User.where({ id: actor.user.id, status: 'ACTIVE' }).first();
  const session = await tx.orm.public.Session.where({ id: actor.session.id, status: 'ACTIVE', revokedAt: null }).first();
  const owner = await tx.orm.public.WorkspaceMember.where({ id: actor.membership.id, userId: actor.user.id, workspaceId: actor.workspace.id, role: 'OWNER' }).first();
  const workspace = await tx.orm.public.Workspace.where({ id: actor.workspace.id, status: 'ACTIVE' }).first();
  if (!user || !session || new Date(session.expiresAt).getTime() <= Date.now() || !owner || !workspace) throw new AuthError('OWNER_ACCESS_REQUIRED', 403);
}
export async function listAdministrativeUsers(): Promise<AdministrativeUser[]> {
  const actor = await requireOwnerAccess();
  const memberships = await db.orm.public.WorkspaceMember.where({ workspaceId: actor.workspace.id })
    .where(member => member.role.in([...ADMIN_ROLES])).all();
  if (!memberships.length) return [];
  const users = await db.orm.public.User.where(user => user.id.in(memberships.map(member => member.userId)))
    .select('id', 'firstName', 'lastName', 'email', 'status').all();
  return memberships.flatMap(member => {
    const user = users.find(item => item.id === member.userId);
    return user ? [{ membershipId: member.id, userId: user.id, name: [user.firstName, user.lastName].filter(Boolean).join(' '), email: user.email, role: member.role, status: user.status }] : [];
  });
}
export async function createAdministrativeUser(value: unknown) {
  const actor = await requireOwnerAccess();
  const parsed = createAdminSchema.safeParse(value);
  if (!parsed.success) throw new AuthError('INVALID_DATA');
  const input = parsed.data;
  const passwordHash = await hashPassword(input.password);
  await db.transaction(async tx => {
    await recheckOwner(tx, actor);
    await lockAuthKey(tx, 'auth-register:' + hashAuthToken(input.email));
    if (await tx.orm.public.User.where({ email: input.email }).first()) throw new AuthError('EMAIL_ALREADY_EXISTS', 409);
    const [firstName, ...rest] = input.name.split(/\s+/);
    const user = await tx.orm.public.User.create({ firstName, lastName: rest.join(' ') || null, email: input.email, passwordHash, status: 'ACTIVE', locale: 'en-US', timezone: 'UTC' });
    await tx.orm.public.WorkspaceMember.create({ workspaceId: actor.workspace.id, userId: user.id, role: input.role });
    await tx.orm.public.AuditLog.create({ userId: actor.user.id, action: 'ADMIN_USER_CREATED', entityType: 'USER', entityId: user.id, metadata: { role: input.role, workspaceId: actor.workspace.id } });
  });
}
export async function updateAdministrativeUser(membershipId: string, value: unknown) {
  const actor = await requireOwnerAccess();
  const input = updateAdminSchema.safeParse(value);
  if (!z.string().uuid().safeParse(membershipId).success || !input.success) throw new AuthError('INVALID_DATA');
  await db.transaction(async tx => {
    await recheckOwner(tx, actor);
    const target = await tx.orm.public.WorkspaceMember.where({ id: membershipId, workspaceId: actor.workspace.id }).first();
    if (!target) throw new AuthError('ADMIN_USER_NOT_FOUND', 404);
    if (!['ADMIN', 'OPERATOR'].includes(target.role) || await tx.orm.public.WorkspaceMember.where({ userId: target.userId, role: 'OWNER' }).first()) throw new AuthError('OWNER_PROTECTED', 403);
    if (input.data.action === 'REMOVE_ACCESS') {
      await tx.orm.public.WorkspaceMember.where({ id: target.id, workspaceId: actor.workspace.id, role: target.role }).delete();
    } else {
      await tx.orm.public.WorkspaceMember.where({ id: target.id, workspaceId: actor.workspace.id, role: target.role }).updateAndCount({ role: input.data.role });
    }
    await tx.orm.public.AuditLog.create({ userId: actor.user.id, action: input.data.action === 'REMOVE_ACCESS' ? 'ADMIN_ACCESS_REMOVED' : 'ADMIN_ROLE_CHANGED', entityType: 'USER', entityId: target.userId, metadata: { workspaceId: actor.workspace.id, previousRole: target.role, role: input.data.action === 'REMOVE_ACCESS' ? null : input.data.role } });
  });
}
