import { z } from 'zod';
import { dateOnly } from '@/src/lib/compliance/validation';

export const ownerPublicationSchema = z.object({
  recordedOn: dateOnly.refine(value => value <= new Date().toISOString().slice(0, 10), 'The recording date cannot be in the future.').optional(),
  attest: z.literal(true).optional(),
  consents: z.array(z.object({ performerId: z.string().uuid(), evidenceRef: z.string().trim().min(5).max(300) }).strict()).max(100)
    .refine(rows => new Set(rows.map(row => row.performerId)).size === rows.length, 'Select each depicted person only once.').default([]),
}).strict();
export type OwnerPublication = z.infer<typeof ownerPublicationSchema>;

// Calendar dates in this flow always refer to UTC, never the browser's timezone.
export function formatPublishDate(timestamp: string | null) {
  if (!timestamp) return '';
  const [year, month, day] = new Date(timestamp).toISOString().slice(0, 10).split('-');
  return `${month}/${day}/${year}`;
}

export function parsePublishDate(value: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match) return null;
  const [, month, day, year] = match;
  const date = `${year}-${month}-${day}`;
  const timestamp = `${date}T00:00:00.000Z`;
  const parsed = new Date(timestamp);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date ? timestamp : null;
}

export const productInputSchema = z.object({
  creatorId: z.string().uuid().nullable().optional(),
  mediaAssetId: z.string().uuid().nullable().optional(),
  teaserMediaAssetId: z.string().uuid().nullable().optional(),
  thumbnailMediaAssetId: z.string().uuid().nullable().optional(),
  title: z.string().trim().min(1).max(160),
  slug: z.string().trim().min(1).max(160).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers, and single hyphens for the slug.'),
  description: z.string().trim().min(1).max(5000),
  priceCents: z.number().int().min(1).max(2147483647),
  currency: z.literal('USD'),
  category: z.string().trim().min(1).max(80),
  featured: z.boolean(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']),
  ownerPublication: ownerPublicationSchema.optional(),
  publishedAt: z.union([
    z.string().refine(value => parsePublishDate(value) !== null, 'Enter a valid date in MM/DD/YYYY format.').transform(value => parsePublishDate(value)!),
    z.iso.datetime({ offset: true }),
  ]).nullable().optional(),
}).strict();

type ExistingFields = {
  creatorId?: string | null;
  mediaAssetId: string; teaserMediaAssetId: string | null; thumbnailMediaAssetId: string | null; publishedAt: string | null;
};

export function resolveProductFields(input: z.infer<typeof productInputSchema>, existing: ExistingFields | null, now = new Date().toISOString()) {
  const { ownerPublication, ...fields } = input;
  void ownerPublication; // Legal evidence is persisted separately, never as a product field.
  const publishedAt = input.publishedAt === undefined ? existing?.publishedAt ?? null : input.publishedAt;
  return {
    ...fields,
    creatorId: input.creatorId === undefined ? existing?.creatorId ?? null : input.creatorId,
    mediaAssetId: input.mediaAssetId ?? existing?.mediaAssetId ?? '',
    teaserMediaAssetId: input.teaserMediaAssetId ?? existing?.teaserMediaAssetId ?? null,
    thumbnailMediaAssetId: input.thumbnailMediaAssetId ?? existing?.thumbnailMediaAssetId ?? null,
    publishedAt: input.status === 'PUBLISHED' ? publishedAt ?? now : publishedAt,
  };
}
