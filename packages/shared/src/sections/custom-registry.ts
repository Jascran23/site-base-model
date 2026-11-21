/// <reference types="vite/client" />
import { z } from 'zod';
import { sectionRegistry as builtInRegistry } from './index.js';
import type { FieldDescriptor, SectionDefinition, SectionInstance } from './types.js';

type CustomModule = {
  type: string; label: string; schemaVersion: number; propsSchema: z.ZodTypeAny;
  defaultProps: Record<string, unknown>; fields: SectionDefinition['fields']; clientCanHide?: boolean;
  PublicSection: NonNullable<SectionDefinition['component']>;
};

const modules = import.meta.glob('./custom/**/*.tsx', { eager: true }) as Record<string, CustomModule>;
const customEntries = Object.values(modules).map((module) => {
  if (!module.type || !module.label || !Number.isInteger(module.schemaVersion) || module.schemaVersion < 1 || !module.propsSchema || !Array.isArray(module.fields) || typeof module.PublicSection !== 'function' || typeof module.clientCanHide !== 'boolean') throw new Error('Definição de seção custom inválida.');
  const validateFields = (fields: FieldDescriptor[]) => { for (const field of fields) {
    if (typeof field.editableByClient !== 'boolean') throw new Error(`Campo ${field.name} de ${module.type} precisa declarar editableByClient.`);
    if (field.type === 'list') {
      if (field.min == null || field.max == null || field.min < 0 || field.max < field.min || typeof field.clientCanAdd !== 'boolean' || typeof field.clientCanRemove !== 'boolean' || typeof field.clientCanReorder !== 'boolean' || !field.itemSchema) throw new Error(`Lista ${field.name} de ${module.type} precisa declarar schema, limites e flags válidos.`);
      validateFields(field.fields);
    }
  } };
  validateFields(module.fields);
  const defaultResult = module.propsSchema.safeParse(module.defaultProps);
  if (!defaultResult.success) throw new Error(`defaultProps inválido em ${module.type}: ${defaultResult.error.issues.map((issue) => issue.path.join('.')).join(', ')}`);
  const definition: SectionDefinition = {
    type: module.type, label: module.label, schemaVersion: module.schemaVersion,
    propsSchema: module.propsSchema, defaultProps: module.defaultProps, fields: module.fields,
    clientCanHide: module.clientCanHide, component: module.PublicSection,
  };
  return [definition.type, definition] as const;
});
if (new Set(customEntries.map(([type]) => type)).size !== customEntries.length) throw new Error('Tipos de seção custom duplicados.');

export const sectionRegistry: Record<string, SectionDefinition> = { ...builtInRegistry, ...Object.fromEntries(customEntries) };
export const sectionTypes = Object.keys(sectionRegistry);
export const getSectionDefinition = (type: string) => sectionRegistry[type];

const baseSection = z.object({
  id: z.string().uuid(), type: z.string().min(1).max(64), schemaVersion: z.number().int().positive(),
  props: z.record(z.unknown()), hidden: z.boolean().optional(), visible: z.boolean().optional(),
}).strict();

export const sectionInstanceSchema = baseSection.superRefine((section, ctx) => {
  const definition = getSectionDefinition(section.type);
  if (!definition) { ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['type'], message: 'Tipo de seção desconhecido.' }); return; }
  if (section.schemaVersion !== definition.schemaVersion) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['schemaVersion'], message: 'Versão de seção incompatível.' });
  const parsed = definition.propsSchema.safeParse(section.props);
  if (!parsed.success) for (const issue of parsed.error.issues) ctx.addIssue({ ...issue, path: ['props', ...issue.path] });
  for (const field of definition.fields) if (field.type === 'list') {
    const list = section.props[field.name];
    if (!Array.isArray(list)) continue;
    const min = field.min ?? field.minItems ?? 0; const max = field.max ?? field.maxItems ?? 100;
    if (list.length < min || list.length > max) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['props', field.name], message: `A lista precisa ter entre ${min} e ${max} itens.` });
    const ids = new Set<string>();
    list.forEach((item, index) => {
      const itemResult = field.itemSchema.safeParse(item);
      if (!itemResult.success) for (const issue of itemResult.error.issues) ctx.addIssue({ ...issue, path: ['props', field.name, index, ...issue.path] });
      const itemId = item && typeof item === 'object' ? (item as { id?: unknown }).id : undefined;
      if (typeof itemId === 'string') { if (ids.has(itemId)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['props', field.name, index, 'id'], message: 'O ID do item precisa ser único.' }); ids.add(itemId); }
    });
  }
});
export const pageDraftSchema = z.object({ sections: z.array(sectionInstanceSchema).max(100).superRefine((sections, ctx) => {
  const ids = new Set<string>();
  sections.forEach((section, index) => { if (ids.has(section.id)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [index, 'id'], message: 'O ID da seção precisa ser único.' }); ids.add(section.id); });
}) }).strict();
export type PageDraft = { sections: SectionInstance[] };
