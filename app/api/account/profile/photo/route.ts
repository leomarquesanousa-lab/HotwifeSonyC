import { profilePhoto } from '@/src/lib/auth/profile';
import { authFailure } from '@/src/lib/auth/request';
export const runtime = 'nodejs';
export async function GET() { try { return await profilePhoto(); } catch (error) { return authFailure(error); } }
