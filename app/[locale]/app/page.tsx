import DashboardClient from '@/src/components/app/DashboardClient';
import { getAdminContext, getStoreOverview } from '@/src/components/app/store-admin-data';
export const metadata = { title: 'Dashboard · HotwifeSonyC' };
export default async function AppPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const context = await getAdminContext(locale);
  if (!context.workspace) return <div className="p-8 text-white/60">No active store workspace is available for this account.</div>;
  const data = await getStoreOverview(context.workspace.id);
  return <DashboardClient locale={locale} firstName={context.user.firstName} data={data}/>;
}
