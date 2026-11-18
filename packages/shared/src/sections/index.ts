import { z } from 'zod';
import { aboutSection } from './about.js';
import { contactSection } from './contact.js';
import { heroSection } from './hero.js';
import { servicesSection } from './services.js';
import type { SectionDefinition, SectionInstance } from './types.js';

export * from './types.js';
export { aboutSection, contactSection, heroSection, servicesSection };
export const sectionRegistry = { hero: heroSection, about: aboutSection, services: servicesSection, contact: contactSection } as const;
export const sectionTypes = Object.keys(sectionRegistry) as (keyof typeof sectionRegistry)[];
export function getSectionDefinition(type: string): SectionDefinition | undefined {
  return sectionRegistry[type as keyof typeof sectionRegistry];
}

const base = z.object({
  id: z.string().uuid(), type: z.string().min(1).max(64), schemaVersion: z.number().int().positive(),
  props: z.record(z.unknown()), hidden: z.boolean().optional(),
}).strict();

export const sectionInstanceSchema = base.superRefine((section, ctx) => {
  const definition = getSectionDefinition(section.type);
  if (!definition) { ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['type'], message: 'Tipo de seção desconhecido.' }); return; }
  if (section.schemaVersion !== definition.schemaVersion) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['schemaVersion'], message: 'Versão de seção incompatível.' });
  const parsed = definition.propsSchema.safeParse(section.props);
  if (!parsed.success) for (const issue of parsed.error.issues) ctx.addIssue({ ...issue, path: ['props', ...issue.path] });
});

export const pageDraftSchema = z.object({ sections: z.array(sectionInstanceSchema).max(100) }).strict();
export type PageDraft = { sections: SectionInstance[] };
