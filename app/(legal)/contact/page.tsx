import PolicyPage, { policyMetadata } from '@/components/compliance/PolicyPage';
export const metadata = policyMetadata('contact');
export default function Page() { return <PolicyPage slug="contact"/>; }
