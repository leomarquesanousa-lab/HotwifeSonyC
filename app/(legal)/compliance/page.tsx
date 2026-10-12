import PolicyPage, { policyMetadata } from '@/components/compliance/PolicyPage';
export const metadata = policyMetadata('compliance');
export default function Page() { return <PolicyPage slug="compliance"/>; }
