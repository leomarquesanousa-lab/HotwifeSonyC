import Image from 'next/image';
import Link from 'next/link';
import { getContent } from '../lib/content';
import Platforms from '../components/Platforms';
import Biography from '../components/Biography';
import PlatformLogo from '../components/PlatformLogo';
import CreatorGallery from '../components/CreatorGallery';
import { readCreatorPicks } from '../lib/creator-picks.mjs';
export default async function Home() {
  const {site}=await getContent();
  const photographs=await readCreatorPicks([site.hero.image,site.portrait.image]);
  return <main id="main">
    <section className="hero"><div className="hero-title"><span className="eyebrow">{site.name.toUpperCase()} / A PERSONAL COLLECTION</span><h1>One Vision.<br/><em>Endless Stories</em></h1><div className="hero-platforms">{site.platforms.filter(p=>p.active&&p.url).map(p=><a key={p.id} href={p.url!} target="_blank" rel="noopener noreferrer"><PlatformLogo platform={p}/>{p.name} ↗<span className="sr-only"> (opens in a new tab)</span></a>)}</div><div className="hero-bottom"><span>{site.introduction}</span><a className="round-link" href="#meet" aria-label="Meet Sony C">↓</a></div></div><div className="hero-photo"><Image src={site.hero.image} alt={site.hero.alt} fill sizes="(max-width: 800px) 100vw, 58vw" preload/><span className="photo-caption">SONY C / IN FRAME</span></div><div className="hero-foot"><span>THE PERSONAL. THE ORIGINAL.</span><span>SC — 01</span></div></section>
    <section id="meet" className="meet section"><div className="meet-photo"><Image src={site.portrait.image} alt={site.portrait.alt} fill sizes="(max-width: 800px) 90vw, 40vw"/><span className="photo-caption">BEHIND THE STORIES</span></div><div className="meet-copy"><span className="eyebrow">THE WOMAN BEHIND THE STORIES</span><h2>Meet <em>Sony C.</em></h2><p className="meet-deck">Brazilian. Married. Unpredictable.</p><span className="meet-rule" aria-hidden="true"/><Biography text={site.biography}/><a className="text-link" href="#platforms">Discover my platforms <span>↗</span></a></div></section>
    <section id="picks" className="picks section"><div className="section-heading"><div><span className="eyebrow">IN THE SPOTLIGHT / 02</span><h2>Creator <em>Picks.</em></h2></div><p>A selection of photographs from the Sony C collection.</p></div><CreatorGallery photos={photographs}/><Link className="text-link picks-catalog-link" href="/catalog">Explore Video Catalog <span aria-hidden="true">↗</span></Link></section>
    <Platforms platforms={site.platforms}/>
  </main>;
}
