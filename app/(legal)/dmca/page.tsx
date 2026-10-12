import PolicyPage, { policyMetadata } from '@/components/compliance/PolicyPage';
export const metadata = policyMetadata('dmca');
export default function Page() { return <PolicyPage slug="dmca"/>; }
