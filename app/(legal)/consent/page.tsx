import PolicyPage, { policyMetadata } from '@/components/compliance/PolicyPage';
export const metadata = policyMetadata('consent');
export default function Page() { return <PolicyPage slug="consent"/>; }
