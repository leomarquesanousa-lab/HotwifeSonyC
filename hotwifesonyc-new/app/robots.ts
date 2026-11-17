import type { MetadataRoute } from 'next';
export default function robots(): MetadataRoute.Robots {
  const origin=process.env.SITE_URL;
  return {rules:origin?{userAgent:'*',allow:['/','/catalog'],disallow:['/admin','/api','/reference','/.local','/content','/docs']}:{userAgent:'*',disallow:'/'},...(origin?{sitemap:new URL('/sitemap.xml',origin).href}:{})};
}
