import type { Metadata } from 'next';
import Catalog from '../../components/Catalog';
import { getContent } from '../../lib/content';
export const metadata: Metadata = { title: 'Video Catalog', description: 'Browse the informational Sony C video catalog and discover official platform links.' };
export default async function Page() { const {catalog}=await getContent(); return <main id="main" className="catalog-page section"><span className="eyebrow">SONY C / THE COLLECTION</span><h1>Video <em>Catalog.</em></h1><p className="catalog-description">Explore the stories. Find them on my platforms.</p><Catalog entries={catalog.filter(v=>v.status==='active').map(v=>({...v,reviewNotes:''}))}/><p className="catalog-disclaimer">An informational collection. Videos are available only on external platforms.</p></main>; }
