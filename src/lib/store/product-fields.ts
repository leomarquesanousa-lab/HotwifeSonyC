import { z } from 'zod';

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
  publishedAt: z.union([
    z.string().refine(value => parsePublishDate(value) !== null, 'Enter a valid date in MM/DD/YYYY format.').transform(value => parsePublishDate(value)!),
    z.iso.datetime({ offset: true }),
  ]).nullable().optional(),
}).strict();

type ExistingFields = {
  mediaAssetId: string; teaserMediaAssetId: string | null; thumbnailMediaAssetId: string | null; publishedAt: string | null;
};

export function resolveProductFields(input: z.infer<typeof productInputSchema>, existing: ExistingFields | null, now = new Date().toISOString()) {
  const publishedAt = input.publishedAt === undefined ? existing?.publishedAt ?? null : input.publishedAt;
  return {
    ...input,
    mediaAssetId: input.mediaAssetId ?? existing?.mediaAssetId ?? '',
    teaserMediaAssetId: input.teaserMediaAssetId ?? existing?.teaserMediaAssetId ?? null,
    thumbnailMediaAssetId: input.thumbnailMediaAssetId ?? existing?.thumbnailMediaAssetId ?? null,
    publishedAt: input.status === 'PUBLISHED' ? publishedAt ?? now : publishedAt,
  };
}
