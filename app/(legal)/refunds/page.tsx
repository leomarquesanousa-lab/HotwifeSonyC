import PolicyPage, { policyMetadata } from '@/components/compliance/PolicyPage';
export const metadata = policyMetadata('refunds');
export default function Page() { return <PolicyPage slug="refunds"/>; }
