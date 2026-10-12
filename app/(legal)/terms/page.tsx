import PolicyPage, { policyMetadata } from '@/components/compliance/PolicyPage';
export const metadata = policyMetadata('terms');
export default function Page() { return <PolicyPage slug="terms"/>; }
