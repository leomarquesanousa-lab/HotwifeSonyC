export const reportReasons = ['Underage concern', 'Non-consensual content', 'Trafficking/exploitation concern', 'Copyright', 'Impersonation/privacy', 'Other illegal/prohibited content', 'Other'] as const;
export const reportStatuses = ['OPEN', 'UNDER_REVIEW', 'ACTION_REQUIRED', 'RESOLVED', 'REJECTED'] as const;
export const reviewStatuses = ['DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'SUSPENDED', 'REMOVED'] as const;
export const legalLinks = [
  ['Terms', '/terms'], ['Privacy', '/privacy'], ['Acceptable Use', '/acceptable-use'],
  ['2257', '/2257'], ['DMCA', '/dmca'], ['Anti-Trafficking', '/anti-trafficking'],
  ['Child Safety', '/child-safety'], ['Age Verification', '/age-verification'], ['Consent', '/consent'],
  ['Content Moderation', '/content-moderation'], ['Report Content', '/report-content'],
  ['Content Removal', '/content-removal'], ['Depicted Person Removal', '/depicted-person-removal'],
  ['Refunds', '/refunds'], ['Billing', '/billing'], ['Contact', '/contact'], ['Compliance', '/compliance'],
] as const;
export const policyGroups = [
  { title: 'Legal', paths: ['/terms', '/privacy', '/dmca', '/2257'] },
  { title: 'Safety', paths: ['/child-safety', '/anti-trafficking', '/age-verification', '/consent'] },
  { title: 'Content', paths: ['/acceptable-use', '/content-moderation', '/report-content', '/content-removal', '/depicted-person-removal'] },
  { title: 'Billing', paths: ['/refunds', '/billing'] },
  { title: 'Support', paths: ['/contact'] },
];
