import { parseAuthBody } from '@/src/lib/auth/request';
import { z } from 'zod';
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
    const input = adminInput.safeParse(await parseAuthBody(request, z.unknown()));
    if (!input.success) {
      const field = String(input.error.issues[0]?.path[0] ?? 'details');
      const names: Record<string, string> = { dateOfBirth: 'Date of birth', evidenceRef: 'Protected identity document', expiresAt: 'Document validity', reviewed: 'Actual identity review confirmation', samePerson: 'Owner-to-creator link confirmation', displayName: 'Creator name', recordedOn: 'Recording date' };
      throw new ComplianceError(`Check ${names[field] ?? 'the submitted details'}. The required value is missing or invalid.`);
    }
    return Response.json(await complianceAction(input.data), { headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' } });
  } catch (error) { return complianceFailure(error); }
}
