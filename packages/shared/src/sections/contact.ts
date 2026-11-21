import { z } from 'zod';
import type { SectionDefinition } from './types.js';

const safeHref = z.string().max(255).refine(
  (value) => value === '' || value.startsWith('#') || value.startsWith('/') && !value.startsWith('//') || /^(https?:\/\/|mailto:|tel:)/i.test(value),
  'Use um link relativo ou uma URL http(s), mailto ou tel.',
);

export const contactSection: SectionDefinition = {
  type: 'contact',
  label: 'Contato',
  schemaVersion: 1,
  propsSchema: z.object({
    eyebrow: z.string().max(60),
    title: z.string().trim().min(1).max(150),
    body: z.string().max(600),
    button: z.object({ label: z.string().max(60), url: safeHref }).strict(),
    contactEmail: z.string().email().nullable(),
    backgroundColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  }).strict(),
  defaultProps: {
    eyebrow: 'Fale conosco', title: 'Entre em contato', body: 'Convide a pessoa a entrar em contato para saber mais.',
    button: { label: 'Enviar mensagem', url: 'mailto:contato@exemplo.com' }, contactEmail: null, backgroundColor: '#ffffff',
  },
  fields: [
    { type: 'text', name: 'eyebrow', label: 'Texto de apoio', maxLength: 60, editableByClient: true },
    { type: 'text', name: 'title', label: 'Título', maxLength: 150, editableByClient: true },
    { type: 'textarea', name: 'body', label: 'Texto', maxLength: 600, editableByClient: true },
    { type: 'button', name: 'button', label: 'Botão de contato', editableByClient: true },
    { type: 'text', name: 'contactEmail', label: 'E-mail de contato', maxLength: 190 },
    { type: 'color', name: 'backgroundColor', label: 'Cor de fundo' },
  ],
  editableByClient: ['eyebrow', 'title', 'body', 'button'], clientCanHide: true,
};
