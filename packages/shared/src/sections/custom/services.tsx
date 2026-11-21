import { BriefcaseBusiness, Heart, ShieldCheck, Sparkles, Star } from 'lucide-react';
import { z } from 'zod';
import type { FieldDescriptor, SectionInstance } from '../types.js';

const iconNames = ['briefcase', 'heart', 'shield', 'sparkles', 'star'] as const;
const itemSchema = z.object({
  id: z.string().uuid(),
  icon: z.enum(iconNames),
  imageId: z.number().int().positive().nullable(),
  title: z.string().trim().min(1).max(100),
  description: z.string().max(320),
}).strict();

export const type = 'services';
export const label = 'Serviços';
export const schemaVersion = 2;
export const propsSchema = z.object({
  eyebrow: z.string().max(60),
  title: z.string().trim().min(1).max(150),
  subtitle: z.string().max(600),
  items: z.array(itemSchema).min(1).max(12),
  backgroundColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
}).strict();
export const defaultProps = {
  eyebrow: 'O que fazemos', title: 'Serviços', subtitle: 'Soluções pensadas para você.',
  items: [{ id: 'f7675542-bfee-4bac-8cf8-8d27ea540cf5', icon: 'briefcase', imageId: null, title: 'Serviço principal', description: 'Descreva este serviço de forma clara e objetiva.' }],
  backgroundColor: '#f4f6fa',
};
export const fields: FieldDescriptor[] = [
  { type: 'text', name: 'eyebrow', label: 'Texto de apoio', maxLength: 60, editableByClient: true },
  { type: 'text', name: 'title', label: 'Título', maxLength: 150, editableByClient: true },
  { type: 'textarea', name: 'subtitle', label: 'Subtítulo', maxLength: 600, editableByClient: true },
  {
    type: 'list', name: 'items', label: 'Serviços', itemLabel: 'Serviço', min: 1, max: 12,
    minItems: 1, maxItems: 12, clientCanAdd: true, clientCanRemove: true, clientCanReorder: true,
    itemSchema, defaultItem: { id: '', icon: 'briefcase', imageId: null, title: 'Novo serviço', description: '' }, editableByClient: true,
    fields: [
      { type: 'text', name: 'icon', label: 'Ícone (briefcase, heart, shield, sparkles ou star)', editableByClient: true },
      { type: 'image', name: 'imageId', label: 'Imagem do serviço', editableByClient: true },
      { type: 'text', name: 'title', label: 'Nome', maxLength: 100, editableByClient: true },
      { type: 'textarea', name: 'description', label: 'Descrição', maxLength: 320, editableByClient: true },
    ],
  },
  { type: 'color', name: 'backgroundColor', label: 'Cor de fundo', editableByClient: false },
];
export const clientCanHide = true;

const iconComponents = { briefcase: BriefcaseBusiness, heart: Heart, shield: ShieldCheck, sparkles: Sparkles, star: Star };
export function PublicSection({ section, mediaUrls = {} }: { section: SectionInstance; mediaUrls?: Record<number, string> }) {
  if (section.visible === false || section.hidden) return null;
  const props = section.props as z.infer<typeof propsSchema>;
  return <section className="px-6 py-12 md:px-12" style={{ backgroundColor: props.backgroundColor, color: 'var(--color-text)' }}>
    <div className="mx-auto max-w-6xl">
      <p className="text-sm uppercase tracking-widest" style={{ color: 'var(--color-secondary)' }}>{props.eyebrow}</p>
      <h2 className="mt-2 text-3xl font-bold" style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-primary)' }}>{props.title}</h2>
      <p className="mt-3 max-w-3xl">{props.subtitle}</p>
      <div className="mt-6 grid gap-4 md:grid-cols-3">{props.items.map((item) => {
        const Icon = iconComponents[item.icon];
        return <article key={item.id} className="rounded-xl p-5" style={{ backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)' }}>
          {item.imageId && mediaUrls[item.imageId] ? <img src={mediaUrls[item.imageId]} alt="" className="mb-3 max-h-36 w-full rounded-lg object-cover" loading="lazy" /> : <Icon aria-hidden="true" size={24} style={{ color: 'var(--color-secondary)' }} />}
          <h3 className="mt-3 font-semibold" style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-primary)' }}>{item.title}</h3>
          <p className="mt-2">{item.description}</p>
        </article>;
      })}</div>
    </div>
  </section>;
}
