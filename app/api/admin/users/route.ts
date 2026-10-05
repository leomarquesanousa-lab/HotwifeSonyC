import { NextResponse } from 'next/server';
import { requireOwnerAccess } from '@/src/lib/auth/admin-access';
import { createAdminSchema, createAdministrativeUser, listAdministrativeUsers } from '@/src/lib/auth/admin-users';
import { authFailure, parseAuthBody } from '@/src/lib/auth/request';
export async function GET() {
  try { return NextResponse.json({ users: await listAdministrativeUsers() }, { headers: { 'Cache-Control': 'no-store' } }); }
  catch (error) { return authFailure(error); }
}
export async function POST(request: Request) {
  try {
    await requireOwnerAccess();
    await createAdministrativeUser(await parseAuthBody(request, createAdminSchema));
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) { return authFailure(error); }
}
