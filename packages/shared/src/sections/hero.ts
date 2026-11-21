import { z } from 'zod';
import type { SectionDefinition } from './types.js';

const safeHref = z.string().max(255).refine(
  (value) => value === '' || value.startsWith('#') || value.startsWith('/') && !value.startsWith('//') || /^(https?:\/\/|mailto:|tel:)/i.test(value),
  'Use um link relativo ou uma URL http(s), mailto ou tel.',
);

export const heroSection: SectionDefinition = {
  type: 'hero',
  label: 'Destaque principal',
  schemaVersion: 1,
  propsSchema: z.object({
    eyebrow: z.string().max(60),
    title: z.string().trim().min(1).max(150),
    body: z.string().max(600),
    imageId: z.number().int().positive().nullable(),
    primaryButton: z.object({ label: z.string().max(60), url: safeHref }).strict(),
    backgroundColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  }).strict(),
  defaultProps: {
    eyebrow: 'Bem-vindo', title: 'Título principal', body: 'Apresente em poucas palavras o que torna este site relevante.',
    imageId: null, primaryButton: { label: 'Saiba mais', url: '#sobre' }, backgroundColor: '#f4f6fa',
  },
  fields: [
    { type: 'text', name: 'eyebrow', label: 'Texto de apoio', maxLength: 60, editableByClient: true },
    { type: 'text', name: 'title', label: 'Título', maxLength: 150, editableByClient: true },
    { type: 'textarea', name: 'body', label: 'Descrição', maxLength: 600, editableByClient: true },
    { type: 'image', name: 'imageId', label: 'Imagem', editableByClient: true },
    { type: 'button', name: 'primaryButton', label: 'Botão principal', editableByClient: true },
    { type: 'color', name: 'backgroundColor', label: 'Cor de fundo' },
  ],
  editableByClient: ['eyebrow', 'title', 'body', 'imageId', 'primaryButton'], clientCanHide: true,
};
