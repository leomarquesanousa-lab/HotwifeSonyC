import { NextResponse } from 'next/server';
import { requireOwnerAccess } from '@/src/lib/auth/admin-access';
import { updateAdminSchema, updateAdministrativeUser } from '@/src/lib/auth/admin-users';
import { authFailure, parseAuthBody } from '@/src/lib/auth/request';
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireOwnerAccess();
    const { id } = await context.params;
    await updateAdministrativeUser(id, await parseAuthBody(request, updateAdminSchema));
    return NextResponse.json({ success: true });
  } catch (error) { return authFailure(error); }
}
