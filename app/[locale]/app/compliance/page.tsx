import { redirect } from 'next/navigation';
import CreatorVerification from '@/components/compliance/CreatorVerification';
import { complianceDashboard, ComplianceError, type ComplianceDashboard } from '@/src/lib/compliance/service';
import { AuthError } from '@/src/lib/auth/request';
export const metadata = { title: 'Creator Verification | HotwifeSonyC', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';
export default async function Page() {
  let data: ComplianceDashboard;
  try { data = await complianceDashboard(); }
  catch (error) {
    if (error instanceof AuthError && error.status === 401) redirect('/login');
    if ((error instanceof AuthError || error instanceof ComplianceError) && error.status === 403) return <main className="p-8">Compliance access requires OWNER or ADMIN.</main>;
    throw error;
  }
  return <CreatorVerification initial={data}/>;
}
