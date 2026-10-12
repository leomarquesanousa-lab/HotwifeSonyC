import PolicyPage, { policyMetadata } from '@/components/compliance/PolicyPage';
export const metadata = policyMetadata('report-content');
export default function Page() { return <PolicyPage slug="report-content"/>; }
