export type StoreProduct = {
  id: string; workspaceId: string; mediaAssetId: string; teaserMediaAssetId: string | null;
  thumbnailMediaAssetId: string | null; title: string; slug: string; description: string;
  priceCents: number; currency: string; category: string; featured: boolean; status: string;
  publishedAt: string | null; createdAt: string; updatedAt: string;
};
export type StoreMedia = { id: string; originalFileName: string; mediaType: string; contentType: string; durationSeconds: number | null };
