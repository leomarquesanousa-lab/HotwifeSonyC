'use client';
import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { futureStoreNavigation, getStoreNavigation } from './store-navigation';
export default function AppSidebar({ role }: { role?: string }) {
  const pathname = usePathname();
  const { locale = 'en-US' } = useParams<{ locale: string }>();
  const t = useTranslations('appShell');
  return <aside className="hidden w-[220px] shrink-0 border-r border-white/[0.06] bg-[#090d15] lg:block"><div className="sticky top-[64px] flex h-[calc(100vh-64px)] flex-col overflow-y-auto px-3 py-5"><nav aria-label="Store administration" className="space-y-1">{getStoreNavigation(locale,t,role).map(item => {
    const Icon = item.icon;
    const active = item.path === `/app` ? pathname === item.path : pathname.startsWith(item.path);
    return <Link key={item.path} href={item.path} aria-current={active ? 'page' : undefined} className={`group relative flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-[12px] font-medium transition ${active ? 'bg-gradient-to-r from-blue-500/[0.13] to-violet-500/[0.06] text-white' : 'text-white/40 hover:bg-white/[0.035] hover:text-white/80'}`}>{active && <span className="absolute bottom-2 left-0 top-2 w-[2px] rounded-full bg-blue-400"/>}<div className={`flex h-8 w-8 items-center justify-center rounded-lg ${active ? 'bg-blue-500/[0.12] text-blue-300' : 'bg-white/[0.025] text-white/30'}`}><Icon className="h-4 w-4"/></div>{item.label}</Link>;
  })}</nav><div className="mt-7 border-t border-white/[0.06] pt-5"><p className="px-3 text-[9px] uppercase tracking-widest text-white/25">Coming later</p>{futureStoreNavigation.map(label => <div key={label} aria-disabled="true" className="flex min-h-11 items-center justify-between gap-2 px-3 text-[11px] text-white/25"><span>{label}</span><span className="text-[8px]">Planned</span></div>)}</div><div className="mt-auto pt-6"><div className="rounded-2xl border border-white/[0.06] bg-gradient-to-br from-white/[0.035] to-transparent p-3.5"><div className="text-[10px] font-semibold tracking-wide text-violet-300/70">HotwifeSonyC</div><p className="mt-2 text-[11px] leading-5 text-white/30">Your library. Your video store.</p></div></div></div></aside>;
}
