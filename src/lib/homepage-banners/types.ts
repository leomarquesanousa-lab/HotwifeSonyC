export type HomepageBanner = { id: string; src: string; alt: string; width: number; height: number; active: boolean; order: number; focal: { x: number; y: number }; mobileFocal: { x: number; y: number }; imageKey?: string };
export const defaultBanners: HomepageBanner[] = [
  { src: '/banner-home.png', alt: 'Sony C by the ocean at sunset', width: 1672, height: 941, focal: { x: 26, y: 0 }, mobileFocal: { x: 24, y: 36 } },
  { src: '/hero1.jpeg', alt: 'Sony C in a softly lit interior', width: 1792, height: 1008, focal: { x: 42, y: 58 }, mobileFocal: { x: 10, y: 52 } },
  { src: '/hero2.jpeg', alt: 'Sony C surrounded by colorful lights', width: 1024, height: 768, focal: { x: 50, y: 0 }, mobileFocal: { x: 70, y: 38 } },
  { src: '/hero3.jpeg', alt: 'Sony C with a nighttime city skyline', width: 1872, height: 1056, focal: { x: 50, y: 4 }, mobileFocal: { x: 65, y: 45 } },
  { src: '/hero4.jpeg', alt: 'Sony C in a warm, sunlit room', width: 1792, height: 1008, focal: { x: 49, y: 2 }, mobileFocal: { x: 65, y: 40 } },
  { src: '/hero5.jpeg', alt: 'Sony C by the pool at sunset', width: 1600, height: 1200, focal: { x: 38, y: 4 }, mobileFocal: { x: 10, y: 40 } },
  { src: '/hero6.jpeg', alt: 'Sony C by the pool with a daytime city skyline', width: 1599, height: 1200, focal: { x: 40, y: 20 }, mobileFocal: { x: 25, y: 42 } },
].map((slide, index) => ({ ...slide, id: 'original-' + index, active: true, order: index + 1 }));
export function publicBanners(banners: HomepageBanner[]) { return banners.filter(banner => banner.active).sort((a,b) => a.order - b.order).map(banner => { const publicBanner = { ...banner }; delete publicBanner.imageKey; return publicBanner; }); }
