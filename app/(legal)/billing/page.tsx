import PolicyPage, { policyMetadata } from '@/components/compliance/PolicyPage';
export const metadata = policyMetadata('billing');
export default function Page() { return <PolicyPage slug="billing"/>; }
