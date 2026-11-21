import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { HttpError } from '../../lib/errors.js';
import { pageDraftSchema, sectionRegistry, type PageDraft } from '@cms/shared/section-registry';

const RESERVED_SLUGS = new Set(['admin', 'api', 'uploads', 'sitemap.xml', 'robots.txt', 'sitemapxml', 'robotstxt']);
const previewPayloadSchema = z.object({ pageId: z.number().int().positive(), versionId: z.number().int().positive(), exp: z.number().int().positive() }).strict();
export type PreviewPayload = z.infer<typeof previewPayloadSchema>;

export function normalizeSlug(value: string) {
  const raw = value.trim().toLowerCase();
  if (RESERVED_SLUGS.has(raw)) throw new HttpError(400, 'Este slug é reservado e não pode ser usado.', 'RESERVED_SLUG');
  const slug = raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 190);
  if (!slug) throw new HttpError(400, 'Informe um slug válido.', 'INVALID_SLUG');
  if (RESERVED_SLUGS.has(slug)) throw new HttpError(400, 'Este slug é reservado e não pode ser usado.', 'RESERVED_SLUG');
  return slug;
}

function deterministicUuid(seed: string) {
  const hex = createHash('sha256').update(seed).digest('hex').slice(0, 32).split('');
  hex[12] = '5'; hex[16] = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  const value = hex.join('');
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

function normalizeLegacyContent(value: unknown) {
  let content = value;
  if (typeof content === 'string') {
    try { content = JSON.parse(content); }
    catch { throw new HttpError(500, 'O rascunho salvo está inválido.', 'INVALID_STORED_DRAFT'); }
  }
  if (!content || typeof content !== 'object' || !Array.isArray((content as { sections?: unknown }).sections)) return content;
  const sections = (content as { sections: unknown[] }).sections;
  const legacyKey = createHash('sha256').update(JSON.stringify(content)).digest('hex');
  const normalized = sections.map((raw, sectionIndex) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return raw;
    const section = { ...(raw as Record<string, unknown>) };
    const type = String(section.type ?? '');
    const sectionId = typeof section.id === 'string' && z.string().uuid().safeParse(section.id).success
      ? section.id : deterministicUuid(`${legacyKey}:section:${sectionIndex}:${type}`);
    const props = section.props && typeof section.props === 'object' && !Array.isArray(section.props)
      ? { ...(section.props as Record<string, unknown>) } : {};
    if (type === 'services' && Number(section.schemaVersion ?? 1) < 2) {
      const oldItems = Array.isArray(props.items) ? props.items : [];
      props.subtitle = typeof props.intro === 'string' ? props.intro : '';
      delete props.intro;
      props.items = oldItems.map((item, itemIndex) => {
        const old = item && typeof item === 'object' ? item as Record<string, unknown> : {};
        return { ...old, id: old.id ?? deterministicUuid(`${legacyKey}:${sectionId}:items:${itemIndex}`), icon: old.icon ?? 'briefcase', imageId: old.imageId ?? null };
      });
      section.schemaVersion = 2;
    }
    const definition = sectionRegistry[type];
    for (const field of definition?.fields ?? []) if (field.type === 'list' && Array.isArray(props[field.name])) {
      props[field.name] = (props[field.name] as unknown[]).map((item, itemIndex) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) return item;
        const row = item as Record<string, unknown>;
        return { ...row, id: typeof row.id === 'string' && z.string().uuid().safeParse(row.id).success
          ? row.id : deterministicUuid(`${legacyKey}:${sectionId}:${field.name}:${itemIndex}`) };
      });
    }
    const result: Record<string, unknown> = { ...section, id: sectionId, props };
    if (result.visible === undefined && typeof section.hidden === 'boolean') result.visible = !section.hidden;
    delete result.hidden;
    return result;
  });
  return { ...(content as Record<string, unknown>), sections: normalized };
}

export function pageDraftFromDb(value: unknown): PageDraft {
  const parsed = pageDraftSchema.safeParse(normalizeLegacyContent(value));
  if (!parsed.success) throw new HttpError(500, 'O rascunho salvo está inválido.', 'INVALID_STORED_DRAFT');
  return parsed.data;
}

export function clonePageDraftWithNewIds(content: PageDraft): PageDraft {
  return { sections: content.sections.map((section) => {
    const definition = sectionRegistry[section.type];
    const props = structuredClone(section.props);
    for (const field of definition?.fields ?? []) if (field.type === 'list' && Array.isArray(props[field.name])) {
      props[field.name] = (props[field.name] as Record<string, unknown>[]).map((item) => ({ ...item, id: randomUUID() }));
    }
    return { ...section, id: randomUUID(), props };
  }) };
}

function numericMediaId(value: unknown): number | null {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) return value;
  if (typeof value === 'string' && /^[1-9]\d*$/.test(value)) {
    const id = Number(value);
    return Number.isSafeInteger(id) ? id : null;
  }
  return null;
}

export function extractMediaIds(content: PageDraft): number[] {
  const ids = new Set<number>();
  const visit = (value: unknown, parentKey = '') => {
    if (Array.isArray(value)) {
      if (/^(?:media|image)_?ids?$/i.test(parentKey)) {
        for (const item of value) { const id = numericMediaId(item); if (id) ids.add(id); }
      }
      for (const item of value) visit(item);
      return;
    }
    if (!value || typeof value !== 'object') return;
    for (const [key, item] of Object.entries(value)) {
      if (/^(?:media|image)_?id$/i.test(key) || (key.toLowerCase() === 'image' && typeof item !== 'object')) {
        const id = numericMediaId(item);
        if (id) ids.add(id);
      }
      visit(item, key);
    }
  };
  visit(content);
  return [...ids];
}

export function createPreviewToken(payload: PreviewPayload) {
  const serialized = Buffer.from(JSON.stringify(previewPayloadSchema.parse(payload))).toString('base64url');
  const signature = createHmac('sha256', env.SESSION_SECRET).update(serialized).digest('base64url');
  return `${serialized}.${signature}`;
}

export function verifyPreviewToken(token: string): PreviewPayload {
  if (token.length > 1024) throw new HttpError(404, 'Preview não encontrado.');
  const parts = token.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) throw new HttpError(404, 'Preview não encontrado.');
  const [payload, sentSignature] = parts;
  const expected = createHmac('sha256', env.SESSION_SECRET).update(payload).digest();
  let actual: Buffer;
  try { actual = Buffer.from(sentSignature, 'base64url'); }
  catch { throw new HttpError(404, 'Preview não encontrado.'); }
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new HttpError(404, 'Preview não encontrado.');
  let parsed: unknown;
  try { parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')); }
  catch { throw new HttpError(404, 'Preview não encontrado.'); }
  const result = previewPayloadSchema.safeParse(parsed);
  if (!result.success) throw new HttpError(404, 'Preview não encontrado.');
  if (result.data.exp <= Math.floor(Date.now() / 1000)) throw new HttpError(410, 'Este preview expirou. Gere um novo link.', 'PREVIEW_EXPIRED');
  return result.data;
}
