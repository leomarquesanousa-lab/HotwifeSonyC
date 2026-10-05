import { Catalog } from '@/components/storefront/StorefrontInteractive';
import { getPublishedVideos } from '@/src/lib/store/public';
export const metadata = { title: 'Explore Videos' };
export default async function Page({ searchParams }: { searchParams: Promise<{ categoria?: string }> }) {
  const { categoria } = await searchParams;
  const videos = await getPublishedVideos();
  return <section className="store-section store-page"><span className="store-eyebrow">THE PRIVATE COLLECTION</span><h1>Find your next favorite story.</h1><p className="store-lead">Watch previews. Find your favorites. Discover something new in every video.</p><Catalog key={categoria ?? 'All Categories'} initialCategory={categoria ?? 'All Categories'} videos={videos}/></section>;
}
