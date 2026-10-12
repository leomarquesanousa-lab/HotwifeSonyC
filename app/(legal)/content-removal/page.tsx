import PolicyPage, { policyMetadata } from '@/components/compliance/PolicyPage';
export const metadata = policyMetadata('content-removal');
export default function Page() { return <PolicyPage slug="content-removal"/>; }
