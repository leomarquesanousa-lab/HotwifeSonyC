import 'server-only';
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getR2Client, getR2BucketName } from '@/src/lib/storage/r2';
import { requireStoreManagementAccess } from '@/src/lib/store/admin';
import { BannerError, createBannerStore, initialBanners } from './store';
import type { HomepageBanner } from './types';

const configKey = 'site-config/homepage-banners.json';
function status(error: unknown) { return (error as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode; }
export const bannerStore = createBannerStore({
  async read() {
    try {
      const result = await getR2Client().send(new GetObjectCommand({ Bucket: getR2BucketName(), Key: configKey }));
      const banners = JSON.parse(await result.Body!.transformToString()) as HomepageBanner[];
      if (!Array.isArray(banners) || banners.length > 10) throw new Error('Invalid banner configuration');
      return { banners, version: result.ETag };
    } catch (error) { if (status(error) === 404) return { banners: initialBanners() }; throw error; }
  },
  async write(banners, version) {
    try {
      await getR2Client().send(new PutObjectCommand({ Bucket: getR2BucketName(), Key: configKey, Body: JSON.stringify(banners), ContentType: 'application/json', ...(version ? { IfMatch: version } : { IfNoneMatch: '*' }) }));
    } catch (error) { if (status(error) === 412 || status(error) === 409) throw new BannerError('Banners changed in another session. Refresh and try again.', 409); throw error; }
  },
});
export async function requireBannerAdmin() {
  const access = await requireStoreManagementAccess();
  if (!access.canDelete) throw new BannerError('You do not have permission to manage homepage banners.', 403);
}
export async function uploadBannerImage(file: File) {
  if (file.size > 5 * 1024 * 1024) throw new BannerError('Image must be 5 MB or smaller.');
  const buffer = Buffer.from(await file.arrayBuffer());
  const png = buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  const jpeg = buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255;
  const webp = buffer.subarray(0,4).toString() === 'RIFF' && buffer.subarray(8,12).toString() === 'WEBP';
  const contentType = png ? 'image/png' : jpeg ? 'image/jpeg' : webp ? 'image/webp' : null;
  if (!contentType || file.type !== contentType) throw new BannerError('Choose a PNG, JPEG or WebP image.');
  const imageKey = `homepage-banners/images/${crypto.randomUUID()}`;
  await getR2Client().send(new PutObjectCommand({ Bucket: getR2BucketName(), Key: imageKey, Body: buffer, ContentType: contentType }));
  return imageKey;
}
