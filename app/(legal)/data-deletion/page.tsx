import PolicyPage, { policyMetadata } from '@/components/compliance/PolicyPage';
export const metadata = policyMetadata('data-deletion');
export default function Page() { return <PolicyPage slug="data-deletion"/>; }
