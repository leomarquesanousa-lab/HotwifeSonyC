import { randomBytes, scryptSync, timingSafeEqual, createHmac } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { dataDirectory } from './store.mjs';
export const COOKIE = 'sony_admin';
export const SESSION_SECONDS = 8*60*60;
export function secureCookie(request) { return process.env.SITE_URL ? new URL(process.env.SITE_URL).protocol==='https:' : new URL(request.url).protocol==='https:'; }
export async function getCredentials() { try { return JSON.parse(await readFile(join(dataDirectory(),'admin.json'),'utf8')); } catch(error) { if(error.code === 'ENOENT') return null; throw error; } }
export async function setupAdmin(password, reset = false) {
  if(typeof password !== 'string' || password.length < 16 || password.length > 256) throw new Error('Use a password of 16–256 characters.');
  if(await getCredentials() && !reset) throw new Error('Admin already configured. Use --reset explicitly to replace credentials and invalidate sessions.');
  const salt = randomBytes(32).toString('hex');
  const credential = {salt,hash:scryptSync(password,salt,64).toString('hex'),secret:randomBytes(48).toString('hex')};
  await mkdir(dataDirectory(),{recursive:true});
  await writeFile(join(dataDirectory(),'admin.json'),JSON.stringify(credential),{mode:0o600});
}
export function checkPassword(password, credential) {
  if(!credential || typeof password !== 'string' || password.length > 256) return false;
  return timingSafeEqual(scryptSync(password,credential.salt,64),Buffer.from(credential.hash,'hex'));
}
export function createSession(credential, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({expires:now+SESSION_SECONDS*1000,nonce:randomBytes(24).toString('hex')})).toString('base64url');
  return `${payload}.${createHmac('sha256',credential.secret).update(payload).digest('base64url')}`;
}
export function checkSession(token, credential, now = Date.now()) {
  try { if(!credential || typeof token !== 'string' || token.length>1024) return false; const [payload,signature,extra] = token.split('.'); if(extra || !signature) return false;
    const expected = createHmac('sha256',credential.secret).update(payload).digest(); const actual = Buffer.from(signature,'base64url');
    if(expected.length !== actual.length || !timingSafeEqual(expected,actual)) return false;
    const data=JSON.parse(Buffer.from(payload,'base64url').toString()); return Number.isFinite(data.expires) && data.expires > now && data.expires <= now+SESSION_SECONDS*1000;
  } catch { return false; }
}
const failures = new Map();
// Single-owner, single-process local panel: bounded global lockout avoids trusting spoofable proxy IP headers.
export function loginAllowed(now = Date.now()) { const state=failures.get('admin'); return !state || state.count<8 || now-state.start>15*60*1000; }
export function failedLogin(now = Date.now()) { let state=failures.get('admin'); if(!state || now-state.start>15*60*1000) state={start:now,count:0}; state.count++; failures.set('admin',state); }
export function successfulLogin() { failures.delete('admin'); }
export function sameOrigin(request) {
  const origin=request.headers.get('origin'); if(!origin)return false;
  try {
    const requestURL=new URL(request.url);const host=request.headers.get('host')||requestURL.host;
    const expected=process.env.SITE_URL ? new URL(process.env.SITE_URL).origin : `${requestURL.protocol}//${host}`;
    if(!process.env.SITE_URL && !/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host))return false;
    return new URL(origin).origin===expected;
  }catch{return false;}
}
