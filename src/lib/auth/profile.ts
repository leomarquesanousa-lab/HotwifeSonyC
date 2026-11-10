import 'server-only';
import { randomUUID } from 'node:crypto';
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { db } from '@/src/prisma/db';
import { getR2BucketName, getR2Client } from '@/src/lib/storage/r2';
import { getCurrentSession } from './session';
import { AuthError, assertSameOrigin } from './request';

export const MAX_PROFILE_PHOTO_BYTES = 2 * 1024 * 1024;
async function photoRecord(userId: string) {
  const record = await db.orm.public.AuditLog.where({ userId, action: 'PROFILE_PHOTO_UPDATED', entityType: 'USER', entityId: userId }).orderBy(row => row.createdAt.desc()).first();
  const metadata = record?.metadata;
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null;
  const value = metadata as Record<string, unknown>;
  return typeof value.objectKey === 'string' && value.objectKey.startsWith(`profiles/${userId}/`) && typeof value.bucketName === 'string' ? { objectKey: value.objectKey, bucketName: value.bucketName } : null;
}
export async function profileSummary() {
  const auth = await getCurrentSession();
  if (!auth) throw new AuthError('UNAUTHORIZED', 401);
  return { name: [auth.user.firstName, auth.user.lastName].filter(Boolean).join(' ') || 'My profile', hasPhoto: !!await photoRecord(auth.user.id) };
}
export async function saveProfilePhoto(request: Request) {
  assertSameOrigin(request);
  const auth = await getCurrentSession();
  if (!auth) throw new AuthError('UNAUTHORIZED', 401);
  // JSON origin protection is shared with the existing account mutation APIs.
  // Bound the stream before decoding so oversized requests never reach R2.
  const reader = request.body?.getReader();
  if (!reader) throw new AuthError('Choose a JPG, PNG or WebP photo.', 400);
  const chunks: Uint8Array[] = []; let length = 0;
  while (true) { const { value, done } = await reader.read(); if (done) break; length += value.length; if (length > 3 * 1024 * 1024) { await reader.cancel(); throw new AuthError('Photo must be at most 2 MB.', 413); } chunks.push(value); }
  let body;
  try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new AuthError('Invalid photo request.', 400); }
  if (typeof body?.data !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(body.data)) throw new AuthError('Choose a JPG, PNG or WebP photo.', 400);
  const bytes = Buffer.from(body.data, 'base64');
  if (!bytes.length || bytes.length > MAX_PROFILE_PHOTO_BYTES) throw new AuthError('Photo must be at most 2 MB.', 413);
  const type = bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ? 'image/png' : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 ? 'image/jpeg' : bytes.toString('ascii',0,4) === 'RIFF' && bytes.toString('ascii',8,12) === 'WEBP' ? 'image/webp' : null;
  if (!type) throw new AuthError('Choose a valid JPG, PNG or WebP photo. SVG is not supported.', 400);
  const bucketName = getR2BucketName(), objectKey = `profiles/${auth.user.id}/${randomUUID()}`;
  await getR2Client().send(new PutObjectCommand({ Bucket: bucketName, Key: objectKey, Body: bytes, ContentType: type }));
  // The existing immutable account audit registry also retains the current photo
  // pointer. Versions remain in R2; changing a photo never deletes an old file.
  await db.orm.public.AuditLog.create({ userId: auth.user.id, action: 'PROFILE_PHOTO_UPDATED', entityType: 'USER', entityId: auth.user.id, metadata: { objectKey, bucketName, contentType: type } });
  return { ok: true };
}
export async function profilePhoto() {
  const auth = await getCurrentSession();
  if (!auth) throw new AuthError('UNAUTHORIZED', 401);
  const record = await photoRecord(auth.user.id);
  if (!record) throw new AuthError('PHOTO_NOT_FOUND', 404);
  const result = await getR2Client().send(new GetObjectCommand({ Bucket: record.bucketName, Key: record.objectKey }));
  if (!result.Body || !['image/png','image/jpeg','image/webp'].includes(result.ContentType ?? '') || !result.ContentLength || result.ContentLength > MAX_PROFILE_PHOTO_BYTES) throw new AuthError('PHOTO_UNAVAILABLE', 404);
  const bytes = await result.Body.transformToByteArray();
  if (bytes.length > MAX_PROFILE_PHOTO_BYTES) throw new AuthError('PHOTO_UNAVAILABLE', 404);
  return new Response(new Uint8Array(bytes).buffer, { headers: { 'Content-Type': result.ContentType!, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'", Vary: 'Cookie' } });
}
