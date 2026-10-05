import { requestRecovery } from "@/src/lib/auth/recovery";
export function POST(request: Request) { return requestRecovery(request, "resend"); }
