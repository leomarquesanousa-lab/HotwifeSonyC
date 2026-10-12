import HomepageBanners from '@/src/components/store/HomepageBanners';
import { bannerStore, requireBannerAdmin } from '@/src/lib/homepage-banners/server';
export const metadata = { title: 'Homepage Banners · HotwifeSonyC' };
export default async function Page() {
  await requireBannerAdmin();
  return <HomepageBanners initialBanners={await bannerStore.list()}/>;
}
