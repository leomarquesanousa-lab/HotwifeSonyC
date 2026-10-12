import { parseAuthBody } from '@/src/lib/auth/request';
import { reportInput } from '@/src/lib/compliance/validation';
import { submitReport, complianceFailure } from '@/src/lib/compliance/service';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    const body = await parseAuthBody(request, reportInput);
    return Response.json(await submitReport(body, request), { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return complianceFailure(error); }
}
