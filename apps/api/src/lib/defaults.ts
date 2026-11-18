export const SECTION_TYPES = [
  ['header', 'Cabeçalho'], ['hero', 'Destaque principal'], ['about', 'Sobre'], ['services', 'Serviços'],
  ['specialties', 'Especialidades'], ['team', 'Equipe'], ['differentials', 'Diferenciais'], ['gallery', 'Galeria'],
  ['testimonials', 'Depoimentos'], ['reviews', 'Avaliações'], ['faq', 'Perguntas frequentes'], ['cta', 'Chamada para ação'],
  ['contact', 'Contato'], ['footer', 'Rodapé'],
] as const;

// Tokens do tema -> viram variáveis CSS (--color-primary etc.) no site público.
export const DEFAULT_THEME = {
  colors: {
    primary: '#1f3a5f', secondary: '#4a6fa5', accent: '#c8963e',
    background: '#ffffff', surface: '#f5f6f8', text: '#1c2330', textMuted: '#5b6573',
  },
  typography: { headingFont: 'Georgia, serif', bodyFont: 'system-ui, sans-serif', baseSize: 16 },
  button: { radius: 6, style: 'solid' },
  radius: { sm: 4, md: 8, lg: 16 },
  shadow: { sm: '0 1px 2px rgba(0,0,0,.08)', md: '0 4px 12px rgba(0,0,0,.10)' },
  spacing: { section: 80, container: 1120 },
  logoMediaId: null as number | null,
  faviconMediaId: null as number | null,
};

export const DEFAULT_SITE_SETTINGS: Record<string, unknown> = {
  business: { name: '', phone: '', email: '', whatsapp: '', address: '', hours: '' },
  social: { instagram: '', facebook: '', linkedin: '' },
};
