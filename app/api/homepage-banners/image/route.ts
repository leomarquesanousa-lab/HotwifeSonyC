import { GetObjectCommand } from '@aws-sdk/client-s3';
import { bannerStore } from '@/src/lib/homepage-banners/server';
import { getR2Client, getR2BucketName } from '@/src/lib/storage/r2';
export async function GET(request: Request) {
  try {
    const version = new URL(request.url).searchParams.get('v');
    const banner = (await bannerStore.list()).find(item => item.imageKey?.split('/').at(-1) === version);
    if (!version || !banner?.imageKey) return new Response(null,{ status: 404 });
    const image = await getR2Client().send(new GetObjectCommand({ Bucket: getR2BucketName(), Key: banner.imageKey }));
    return new Response(new Uint8Array(await image.Body!.transformToByteArray()).buffer,{ headers: { 'Content-Type': image.ContentType ?? 'image/jpeg', 'Cache-Control': 'public, max-age=0, must-revalidate', 'X-Content-Type-Options': 'nosniff' } });
  } catch { return new Response(null,{ status: 503 }); }
}
