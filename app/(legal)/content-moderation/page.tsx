import PolicyPage, { policyMetadata } from '@/components/compliance/PolicyPage';
export const metadata = policyMetadata('content-moderation');
export default function Page() { return <PolicyPage slug="content-moderation"/>; }
