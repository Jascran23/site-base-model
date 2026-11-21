import { z } from 'zod';
import type { SectionDefinition } from './types.js';

export const servicesSection: SectionDefinition = {
  type: 'services',
  label: 'Serviços',
  schemaVersion: 1,
  propsSchema: z.object({
    eyebrow: z.string().max(60),
    title: z.string().trim().min(1).max(150),
    intro: z.string().max(600),
    items: z.array(z.object({ id: z.string().uuid(), title: z.string().min(1).max(100), description: z.string().max(320) }).strict()).min(1).max(12),
    backgroundColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  }).strict(),
  defaultProps: {
    eyebrow: 'O que fazemos', title: 'Serviços', intro: 'Apresente as principais formas como você pode ajudar.',
    items: [{ id: 'f7675542-bfee-4bac-8cf8-8d27ea540cf5', title: 'Serviço principal', description: 'Descreva este serviço de forma clara e objetiva.' }], backgroundColor: '#f4f6fa',
  },
  fields: [
    { type: 'text', name: 'eyebrow', label: 'Texto de apoio', maxLength: 60, editableByClient: true },
    { type: 'text', name: 'title', label: 'Título', maxLength: 150, editableByClient: true },
    { type: 'textarea', name: 'intro', label: 'Introdução', maxLength: 600, editableByClient: true },
    { type: 'list', name: 'items', label: 'Serviços', itemLabel: 'Serviço', min: 1, max: 12, minItems: 1, maxItems: 12, clientCanAdd: true, clientCanRemove: true, clientCanReorder: true, itemSchema: z.object({ id: z.string().uuid(), title: z.string().min(1).max(100), description: z.string().max(320) }).strict(), editableByClient: true, fields: [
      { type: 'text', name: 'title', label: 'Nome', maxLength: 100, editableByClient: true },
      { type: 'textarea', name: 'description', label: 'Descrição', maxLength: 320, editableByClient: true },
    ] },
    { type: 'color', name: 'backgroundColor', label: 'Cor de fundo' },
  ],
  editableByClient: ['eyebrow', 'title', 'intro', 'items'], clientCanHide: true,
};
