import { z } from 'zod';
import { reportReasons, reportStatuses, reviewStatuses } from './constants';

export const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const date = new Date(value + 'T00:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, 'Use a valid calendar date.');
export function adultOn(birth: string, date: string) {
  const age = Number(date.slice(0, 4)) - Number(birth.slice(0, 4)) - (date.slice(5) < birth.slice(5) ? 1 : 0);
  return age >= 18 && birth < date;
}
export function businessDeadline(start: Date) {
  const date = new Date(start); let days = 0;
  while (days < 5) { date.setUTCDate(date.getUTCDate() + 1); if (![0, 6].includes(date.getUTCDay())) days++; }
  return date.toISOString();
}
export const reportInput = z.object({
  kind: z.enum(['CONTENT', 'DEPICTED_PERSON', 'SUPPORT']).default('CONTENT'),
  contentUrl: z.string().trim().url().max(2000),
  reason: z.enum(reportReasons),
  reporterName: z.string().trim().min(2).max(160),
  reporterEmail: z.string().trim().email().max(255).transform(v => v.toLowerCase()),
  depictedPerson: z.boolean(),
  description: z.string().trim().min(20).max(6000),
  supportingInfo: z.string().trim().max(3000).optional(),
  website: z.string().max(0).optional(),
  truthful: z.literal(true),
}).strict();
export const adminInput = z.discriminatedUnion('action', [
  z.object({ action: z.literal('creatorProfile'), performerId: z.string().uuid(), displayName: z.string().trim().min(1).max(120), legalName: z.string().trim().max(200).optional(), status: z.enum(['ACTIVE', 'INACTIVE']).optional() }).strict(),
  z.object({ action: z.literal('creatorDocumentReplacement'), performerId: z.string().uuid(), documentId: z.string().uuid() }).strict(),
  z.object({ action: z.literal('creatorLink'), performerId: z.string().uuid().optional(), displayName: z.string().trim().min(1).max(120).optional(), samePerson: z.literal(true) }).strict(),
  z.object({ action: z.literal('creatorIdentity'), performerId: z.string().uuid().optional(), displayName: z.string().trim().min(1).max(120).optional(), dateOfBirth: dateOnly, evidenceRef: z.string().trim().min(5).max(300), expiresAt: z.iso.datetime({ offset: true }).nullable(), samePerson: z.literal(true), reviewed: z.literal(true) }).strict(),
  z.object({ action: z.literal('creatorEvidence'), productId: z.string().uuid(), recordedOn: dateOnly.optional(), consentEvidenceRef: z.string().trim().min(5).max(300).optional(), rightsEvidenceRef: z.string().trim().min(5).max(300).optional(), reviewed: z.literal(true).optional() }).strict(),
  z.object({ action: z.literal('creatorReview'), productId: z.string().uuid(), recordedOn: dateOnly.optional(), consentEvidenceRef: z.string().trim().min(5).max(300).optional(), rightsEvidenceRef: z.string().trim().min(5).max(300).optional(), reviewed: z.literal(true) }).strict(),
  z.object({ action: z.literal('moderate'), productId: z.string().uuid(), status: z.enum(['SUSPENDED', 'REMOVED']), note: z.string().trim().min(5).max(3000) }).strict(),
  z.object({ action: z.literal('report'), id: z.string().uuid(), status: z.enum(reportStatuses), note: z.string().trim().min(5).max(3000), productId: z.string().uuid().optional() }).strict(),
  z.object({ action: z.literal('identity'), subjectType: z.enum(['USER', 'PERFORMER']), subjectId: z.string().uuid(), status: z.enum(['NOT_VERIFIED', 'VERIFIED', 'REJECTED']), dateOfBirth: dateOnly, evidenceRef: z.string().trim().min(5).max(300), expiresAt: z.iso.datetime({ offset: true }).nullable(), attest: z.literal(true) }).strict(),
  z.object({ action: z.literal('consent'), productId: z.string().uuid(), performerId: z.string().uuid(), evidenceRef: z.string().trim().min(5).max(300), depiction: z.boolean(), distribution: z.boolean(), publication: z.boolean(), downloads: z.literal(false), status: z.enum(['RECORDED', 'DISPUTED', 'REVOKED']), attest: z.literal(true) }).strict(),
  z.object({ action: z.literal('review'), productId: z.string().uuid(), status: z.enum(reviewStatuses), providerUserId: z.string().uuid(), recordedOn: dateOnly, allPersonsConfirmed: z.boolean(), prohibitedChecked: z.boolean(), copyrightConfirmed: z.boolean(), note: z.string().trim().min(5).max(3000) }).strict(),
]);
