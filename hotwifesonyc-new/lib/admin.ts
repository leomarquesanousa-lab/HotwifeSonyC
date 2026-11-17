import { cookies } from 'next/headers';
import { COOKIE, getCredentials, checkSession } from './auth.mjs';
export async function isAdmin() { return checkSession((await cookies()).get(COOKIE)?.value,await getCredentials()); }
export const privateHeaders = { 'Cache-Control':'no-store', 'X-Robots-Tag':'noindex, nofollow' };
