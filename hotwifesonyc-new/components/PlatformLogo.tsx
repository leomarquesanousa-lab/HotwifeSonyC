import Image from 'next/image';
import type { Platform } from '../lib/content';

const marks: Record<string, string> = {
  'onlyfans.com': '/platforms/onlyfans.png',
  'fansly.com': '/platforms/fansly.png',
  'clips4sale.com': '/platforms/clips4sale.svg',
  'manyvids.com': '/platforms/manyvids.png',
};

export default function PlatformLogo({ platform }: { platform: Platform }) {
  let host = '';
  try { host = new URL(platform.url ?? '').hostname.replace(/^www\./, ''); } catch { /* Unconfigured platforms retain their text label. */ }
  const source = marks[host];
  return source ? <Image className="platform-logo" src={source} alt="" aria-hidden="true" width={24} height={24} unoptimized/> : null;
}
