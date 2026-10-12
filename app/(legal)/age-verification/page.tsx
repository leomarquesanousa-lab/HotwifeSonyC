import PolicyPage, { policyMetadata } from '@/components/compliance/PolicyPage';
export const metadata = policyMetadata('age-verification');
export default function Page() { return <PolicyPage slug="age-verification"/>; }
