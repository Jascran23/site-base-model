export { pageDraftSchema, sectionInstanceSchema } from './sections/index.js';
export type { PageDraft } from './sections/index.js';
export * from './sections/index.js';
export * from './theme.js';

export type PageStatus = 'draft' | 'published';
export interface PageSummary {
  id: number; title: string; slug: string; status: PageStatus; is_home: number;
  published_version_id: number | null; draft_version_id: number | null;
  seo_title: string | null; seo_description: string | null; seo_canonical: string | null;
  seo_og_image_id: number | null; seo_noindex: number; created_at: string; updated_at: string;
}
