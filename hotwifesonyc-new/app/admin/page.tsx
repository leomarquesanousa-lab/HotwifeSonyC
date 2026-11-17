import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { isAdmin } from '../../lib/admin';
import { getContent } from '../../lib/content';
import { listImages } from '../../lib/store.mjs';
import AdminPanel from '../../components/AdminPanel';
export const metadata: Metadata={title:'Content administration',robots:{index:false,follow:false}};
export default async function Page(){if(!await isAdmin())redirect('/admin/login');return <main id="main" className="section admin-page"><span className="eyebrow">PRIVATE / CONTENT STUDIO</span><h1>Your stories.<br/><em>Your space.</em></h1><AdminPanel initial={await getContent()} images={await listImages()}/></main>;}
