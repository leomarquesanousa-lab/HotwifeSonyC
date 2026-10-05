export type VideoProduct = {
  id: string;
  slug: string;
  title: string;
  description: string;
  priceCents: number;
  currency: string;
  category: string;
  duration: string;
  thumbnail: string;
  featured: boolean;
  publishedAt: string;
  badge?: string;
  tags: string[];
  teaser: { source: string | null };
};
export const creator = {
  name: 'Sony C',
  subtitle: 'One vision. Endless stories.',
  bio: 'I’m Sony C. I turn light, movement, and everyday moments into visual stories. This is where I share a closer look at my world through a creative, personal lens.',
  initials: 'SC',
};
export const priceLabel = (priceCents: number, currency = 'USD') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(priceCents / 100);
