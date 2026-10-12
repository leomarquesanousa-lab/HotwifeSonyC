import PolicyPage, { policyMetadata } from '@/components/compliance/PolicyPage';
export const metadata = policyMetadata('child-safety');
export default function Page() { return <PolicyPage slug="child-safety"/>; }
