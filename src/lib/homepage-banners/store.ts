import { defaultBanners, type HomepageBanner } from './types';

export class BannerError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export type BannerStorage = {
  read: () => Promise<{ banners: HomepageBanner[]; version?: string }>;
  write: (banners: HomepageBanner[], version?: string) => Promise<void>;
};
export function createBannerStore(storage: BannerStorage) {
  return {
    async list() { return (await storage.read()).banners; },
    async save(value: Omit<HomepageBanner, 'id'>, id?: string) {
      const { banners, version } = await storage.read();
      if (id && !banners.some(banner => banner.id === id)) throw new BannerError('Banner not found.', 404);
      if (!id && banners.length >= 10) throw new BannerError('Maximum of 10 banners reached.', 409);
      const banner = { ...value, id: id ?? crypto.randomUUID() };
      const next = banners.filter(item => item.id !== id).sort((a,b) => a.order - b.order);
      next.splice(Math.min(value.order - 1, next.length), 0, banner);
      next.forEach((item,index) => { item.order = index + 1; });
      await storage.write(next, version);
      return next;
    },
    async remove(id: string) {
      const { banners, version } = await storage.read();
      if (!banners.some(banner => banner.id === id)) throw new BannerError('Banner not found.', 404);
      const next = banners.filter(banner => banner.id !== id).sort((a,b) => a.order - b.order);
      next.forEach((item,index) => { item.order = index + 1; });
      await storage.write(next, version);
      return next;
    },
  };
}
export function initialBanners() { return structuredClone(defaultBanners); }
