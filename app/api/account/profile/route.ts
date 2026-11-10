import { profileSummary, saveProfilePhoto } from '@/src/lib/auth/profile';
import { authFailure } from '@/src/lib/auth/request';
export const runtime = 'nodejs';
export async function GET() {
  try { return Response.json(await profileSummary(), { headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' } }); } catch (error) { return authFailure(error); }
}
export async function POST(request: Request) {
  try { return Response.json(await saveProfilePhoto(request), { headers: { 'Cache-Control': 'no-store' } }); } catch (error) { return authFailure(error); }
}
