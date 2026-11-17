import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { isAdmin } from '../../../lib/admin';
import AdminLogin from '../../../components/AdminLogin';
export const metadata: Metadata={title:'Administrator sign in',robots:{index:false,follow:false}};
export default async function Page(){if(await isAdmin())redirect('/admin');return <main id="main" className="section admin-page"><span className="eyebrow">PRIVATE / HOTWIFESONYC</span><h1>Administrator <em>sign in.</em></h1><AdminLogin/></main>;}
