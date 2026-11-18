import { z } from 'zod';

export const THEME_GROUPS = ['colors', 'typography', 'button', 'radius', 'shadow', 'spacing', 'assets'] as const;
export type ThemeGroup = typeof THEME_GROUPS[number];
export const SYSTEM_FONTS = [
  'system-ui, sans-serif', 'Arial, sans-serif', 'Verdana, sans-serif', 'Georgia, serif',
  '"Trebuchet MS", sans-serif', '"Times New Roman", serif',
] as const;

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
} satisfies z.infer<typeof themeSchema>;

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Informe uma cor hexadecimal no formato #RRGGBB.');
const shadow = z.string().max(80).regex(/^0 (?:[0-9]|[1-9][0-9])px (?:[0-9]|[1-9][0-9])px rgba\((?:[0-9]{1,3}),\s*(?:[0-9]{1,3}),\s*(?:[0-9]{1,3}),\s*0?\.[0-9]{1,2}\)$/);
const mediaId = z.number().int().positive().nullable();

export const themeSchema = z.object({
  colors: z.object({ primary:hex, secondary:hex, accent:hex, background:hex, surface:hex, text:hex, textMuted:hex }).strict(),
  typography: z.object({ headingFont:z.enum(SYSTEM_FONTS), bodyFont:z.enum(SYSTEM_FONTS), baseSize:z.number().int().min(14).max(20) }).strict(),
  button: z.object({ radius:z.number().int().min(0).max(32), style:z.enum(['solid','outline']) }).strict(),
  radius: z.object({ sm:z.number().int().min(0).max(32), md:z.number().int().min(0).max(40), lg:z.number().int().min(0).max(64) }).strict(),
  shadow: z.object({ sm:shadow, md:shadow }).strict(),
  spacing: z.object({ section:z.number().int().min(24).max(160), container:z.number().int().min(720).max(1440) }).strict(),
  logoMediaId:mediaId, faviconMediaId:mediaId,
}).strict();

export type ThemeTokens = z.infer<typeof themeSchema>;
export const themeClientGroupsSchema = z.array(z.enum(THEME_GROUPS)).max(THEME_GROUPS.length);
export type ThemeClientGroups = ThemeGroup[];

export function themeToCssVars(input: ThemeTokens | unknown): Record<string,string> {
  const theme=themeSchema.parse(input);
  return {
    '--color-primary':theme.colors.primary,'--color-secondary':theme.colors.secondary,'--color-accent':theme.colors.accent,
    '--color-background':theme.colors.background,'--color-surface':theme.colors.surface,'--color-text':theme.colors.text,'--color-text-muted':theme.colors.textMuted,
    '--font-heading':theme.typography.headingFont,'--font-body':theme.typography.bodyFont,'--font-size-base':`${theme.typography.baseSize}px`,
    '--button-radius':`${theme.button.radius}px`,'--button-style':theme.button.style,
    '--radius-sm':`${theme.radius.sm}px`,'--radius-md':`${theme.radius.md}px`,'--radius-lg':`${theme.radius.lg}px`,
    '--shadow-sm':theme.shadow.sm,'--shadow-md':theme.shadow.md,
    '--space-section':`${theme.spacing.section}px`,'--container-width':`${theme.spacing.container}px`,
  };
}
