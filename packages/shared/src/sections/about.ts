import { z } from 'zod';
import type { SectionDefinition } from './types.js';

export const aboutSection: SectionDefinition = {
  type: 'about',
  label: 'Sobre',
  schemaVersion: 1,
  propsSchema: z.object({
    eyebrow: z.string().max(60),
    title: z.string().trim().min(1).max(150),
    body: z.string().max(1200),
    imageId: z.number().int().positive().nullable(),
    highlights: z.array(z.object({ title: z.string().min(1).max(80), description: z.string().max(240) }).strict()).max(8),
    backgroundColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  }).strict(),
  defaultProps: {
    eyebrow: 'Nossa história', title: 'Sobre', body: 'Conte a história, a experiência e os valores que representam este negócio.',
    imageId: null, highlights: [], backgroundColor: '#ffffff',
  },
  fields: [
    { type: 'text', name: 'eyebrow', label: 'Texto de apoio', maxLength: 60 },
    { type: 'text', name: 'title', label: 'Título', maxLength: 150 },
    { type: 'textarea', name: 'body', label: 'Texto', maxLength: 1200 },
    { type: 'image', name: 'imageId', label: 'Imagem' },
    { type: 'list', name: 'highlights', label: 'Destaques', itemLabel: 'Destaque', maxItems: 8, fields: [
      { type: 'text', name: 'title', label: 'Título', maxLength: 80 },
      { type: 'textarea', name: 'description', label: 'Descrição', maxLength: 240 },
    ] },
    { type: 'color', name: 'backgroundColor', label: 'Cor de fundo' },
  ],
  editableByClient: ['eyebrow', 'title', 'body', 'imageId', 'highlights'],
};
