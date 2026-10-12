import { z } from 'zod';
import { assertSameOrigin } from '@/src/lib/auth/request';
import { storeFailure } from '@/src/lib/store/admin';
import { bannerStore, requireBannerAdmin, uploadBannerImage } from '@/src/lib/homepage-banners/server';
import { BannerError } from '@/src/lib/homepage-banners/store';
const fields = z.object({ order: z.coerce.number().int().min(1).max(10), focalX: z.coerce.number().min(0).max(100), focalY: z.coerce.number().min(0).max(100), mobileX: z.coerce.number().min(0).max(100), mobileY: z.coerce.number().min(0).max(100), active: z.enum(['true','false']) });
function failure(error: unknown) { return error instanceof BannerError ? Response.json({ error: error.message }, { status: error.status }) : storeFailure(error); }
function result(banners: unknown) { return Response.json({ banners }, { headers: { 'Cache-Control': 'private, no-store' } }); }
export async function GET() {
  try { await requireBannerAdmin(); return result(await bannerStore.list()); } catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  try {
    assertSameOrigin(request); await requireBannerAdmin();
    if (Number(request.headers.get('content-length')) > 8 * 1024 * 1024) throw new BannerError('Image must be 5 MB or smaller.');
    const text = await request.text();
    if (text.length > 8 * 1024 * 1024) throw new BannerError('Image must be 5 MB or smaller.');
    const data = JSON.parse(text);
    const parsed = fields.safeParse(data);
    if (!parsed.success) throw new BannerError('Check the order and focal points (0–100).');
    const idValue = data.id;
    const id = typeof idValue === 'string' && idValue ? idValue : undefined;
    const banners = await bannerStore.list();
    const existing = banners.find(banner => banner.id === id);
    if (id && !existing) throw new BannerError('Banner not found.',404);
    if (!id && banners.length >= 10) throw new BannerError('Maximum of 10 banners reached.',409);
    const image = data.image;
    let file: File | undefined;
    if (image) {
      if (typeof image.data !== 'string' || typeof image.type !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(image.data)) throw new BannerError('Invalid image.');
      const bytes = new Uint8Array(Buffer.from(image.data, 'base64'));
      file = new File([bytes], 'banner', { type: image.type });
    }
    let imageKey = existing?.imageKey;
    let src = existing?.src;
    if (file instanceof File && file.size) { imageKey = await uploadBannerImage(file); src = `/api/homepage-banners/image?v=${imageKey.split('/').at(-1)}`; }
    if (!src) throw new BannerError('Choose an image.');
    const f = parsed.data;
    return result(await bannerStore.save({ src, imageKey, alt: existing?.alt ?? 'HotwifeSonyC featured banner', width: existing?.width ?? 1600, height: existing?.height ?? 900, active: f.active === 'true', order: f.order, focal: { x: f.focalX, y: f.focalY }, mobileFocal: { x: f.mobileX, y: f.mobileY } }, id));
  } catch (error) { return failure(error); }
}
export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request); await requireBannerAdmin();
    const data = await request.json();
    if (data.confirmed !== true || typeof data.id !== 'string') throw new BannerError('Confirm banner deletion.');
    return result(await bannerStore.remove(data.id));
  } catch (error) { return failure(error); }
}
