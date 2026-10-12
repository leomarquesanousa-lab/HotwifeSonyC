import { parseAuthBody } from '@/src/lib/auth/request';
import { adminInput } from '@/src/lib/compliance/validation';
import { reportStatuses } from '@/src/lib/compliance/constants';
import { complianceAction, complianceDashboard, complianceFailure, requireComplianceAccess, ComplianceError } from '@/src/lib/compliance/service';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  try {
    const status = new URL(request.url).searchParams.get('status') || undefined;
    if (status && !reportStatuses.some(value => value === status)) throw new ComplianceError('Invalid status filter.');
    return Response.json(await complianceDashboard(status), { headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' } });
  } catch (error) { return complianceFailure(error); }
}
export async function POST(request: Request) {
  try {
    await requireComplianceAccess();
    return Response.json(await complianceAction(await parseAuthBody(request, adminInput)), { headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' } });
  } catch (error) { return complianceFailure(error); }
}
