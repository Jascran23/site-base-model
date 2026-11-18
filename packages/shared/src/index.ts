import { z } from 'zod';

/** Etapa 5 mantém as seções genéricas; a Etapa 6 valida cada tipo no registry. */
export const pageSectionDraftSchema = z.record(z.unknown());
export const pageDraftSchema = z.object({
  sections: z.array(pageSectionDraftSchema).max(100),
}).strict();

export type PageDraft = z.infer<typeof pageDraftSchema>;
export type PageStatus = 'draft' | 'published';

export interface PageSummary {
  id: number;
  title: string;
  slug: string;
  status: PageStatus;
  is_home: number;
  published_version_id: number | null;
  draft_version_id: number | null;
  seo_title: string | null;
  seo_description: string | null;
  seo_canonical: string | null;
  seo_og_image_id: number | null;
  seo_noindex: number;
  created_at: string;
  updated_at: string;
}
