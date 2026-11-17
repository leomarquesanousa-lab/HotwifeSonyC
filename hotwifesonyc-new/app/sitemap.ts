import type { MetadataRoute } from 'next';
export default function sitemap(): MetadataRoute.Sitemap {
  const origin=process.env.SITE_URL || 'http://127.0.0.1:3100';
  return [{url:new URL('/',origin).href},{url:new URL('/catalog',origin).href}];
}
