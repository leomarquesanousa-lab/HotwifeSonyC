import PolicyPage, { policyMetadata } from '@/components/compliance/PolicyPage';
export const metadata = policyMetadata('acceptable-use');
export default function Page() { return <PolicyPage slug="acceptable-use"/>; }
