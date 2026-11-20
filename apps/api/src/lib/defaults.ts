import { DEFAULT_THEME } from '@cms/shared';

export { DEFAULT_THEME };
export const SECTION_TYPES = [
  ['header', 'Cabeçalho'], ['hero', 'Destaque principal'], ['about', 'Sobre'], ['services', 'Serviços'],
  ['specialties', 'Especialidades'], ['team', 'Equipe'], ['differentials', 'Diferenciais'], ['gallery', 'Galeria'],
  ['testimonials', 'Depoimentos'], ['reviews', 'Avaliações'], ['faq', 'Perguntas frequentes'], ['cta', 'Chamada para ação'],
  ['contact', 'Contato'], ['footer', 'Rodapé'],
] as const;

export const DEFAULT_SITE_SETTINGS: Record<string, unknown> = {
  business: { name: '', segment: 'institutional', phone: '', email: '', whatsapp: '', address: '', hours: '' },
  social: { instagram: '', facebook: '', linkedin: '' },
  technical: { submissionRetentionDays: 365 },
  theme_client_groups: [],
};
