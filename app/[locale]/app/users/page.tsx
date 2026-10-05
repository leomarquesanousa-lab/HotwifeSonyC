import { redirect } from 'next/navigation';
import { getAdminContext } from '@/src/components/app/store-admin-data';
import { listAdministrativeUsers } from '@/src/lib/auth/admin-users';
import AdministrativeUsers from '@/src/components/app/AdministrativeUsers';
export const metadata = { title: 'Administrative Users · HotwifeSonyC' };
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const context = await getAdminContext(locale);
  if (context.role !== 'OWNER') redirect('/app');
  return <AdministrativeUsers initialUsers={await listAdministrativeUsers()}/>;
}
