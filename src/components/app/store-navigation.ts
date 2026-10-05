import { BarChart3, LayoutDashboard, Library, Settings, Store } from 'lucide-react';
export function getStoreNavigation(locale: string, t: (key: string) => string) {
  return [
    { label: t('dashboard'), path: `/app`, icon: LayoutDashboard },
    { label: t('mediaLibrary'), path: `/app/media`, icon: Library },
    { label: 'Videos for Sale', path: `/app/store/videos`, icon: Store },
    { label: t('analytics'), path: `/app/analytics`, icon: BarChart3 },
    { label: t('settings'), path: `/app/settings`, icon: Settings },
  ];
}
export const futureStoreNavigation = ['Sales / Orders', 'Customers'];
