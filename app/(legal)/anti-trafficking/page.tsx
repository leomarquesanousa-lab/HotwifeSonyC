import PolicyPage, { policyMetadata } from '@/components/compliance/PolicyPage';
export const metadata = policyMetadata('anti-trafficking');
export default function Page() { return <PolicyPage slug="anti-trafficking"/>; }
