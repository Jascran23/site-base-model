import { Router } from 'express';
import { z } from 'zod';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { pageDraftSchema, type PageDraft } from '@cms/shared';
import { pool } from '../../db/pool.js';
import { asyncHandler, HttpError } from '../../lib/errors.js';
import { audit } from '../../lib/audit.js';
import { can, requireAuth, requirePermission } from '../../middleware/auth.js';
import { syncMediaUsages } from '../media/media.service.js';
import { createPreviewToken, extractMediaIds, normalizeSlug, pageDraftFromDb, verifyPreviewToken } from './pages.service.js';

export const pagesRouter = Router();
export const previewRouter = Router();
pagesRouter.use(requireAuth);

const idSchema = z.coerce.number().int().positive();
const createSchema = z.object({
  title: z.string().trim().min(2).max(190),
  slug: z.string().trim().min(1).max(190).optional(),
}).strict();
const updateSchema = z.object({
  title: z.string().trim().min(2).max(190).optional(),
  slug: z.string().trim().min(1).max(190).optional(),
  seo_title: z.string().trim().max(190).nullable().optional(),
  seo_description: z.string().trim().max(320).nullable().optional(),
  seo_canonical: z.string().trim().url().max(255).nullable().optional(),
  seo_og_image_id: z.union([z.coerce.number().int().positive(), z.null()]).optional(),
  seo_noindex: z.boolean().optional(),
}).strict().refine((data) => Object.keys(data).length > 0, 'Informe ao menos um campo para atualizar.');
const listSchema = z.object({
  q: z.string().trim().max(120).optional(),
  status: z.enum(['all', 'draft', 'published']).default('all'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(60).default(24),
});

function requirePageAccess(req: import('express').Request, permission: string) {
  if (!req.auth) throw new HttpError(401, 'Faça login para continuar.', 'UNAUTHENTICATED');
  if (!can(req.auth, permission)) throw new HttpError(403, 'Você não tem permissão para esta ação.', 'FORBIDDEN');
}

function parsePageId(value: string) { return idSchema.parse(value); }

async function ensureMediaExists(mediaId: number, executor: typeof pool | Awaited<ReturnType<typeof pool.getConnection>>) {
  const [rows] = await executor.query<RowDataPacket[]>('SELECT id FROM media WHERE id=?', [mediaId]);
  if (!rows.length) throw new HttpError(400, 'A imagem de SEO selecionada não existe.', 'INVALID_MEDIA');
}

async function copySeoUsage(pageId: number, mediaId: number | null, executor: typeof pool | Awaited<ReturnType<typeof pool.getConnection>>) {
  await syncMediaUsages('page_seo', pageId, mediaId ? [mediaId] : [], executor, 'og_image');
}

pagesRouter.get('/', requirePermission('pages.view'), asyncHandler(async (req, res) => {
  const query = listSchema.parse(req.query);
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (query.status !== 'all') { conditions.push('p.status=?'); params.push(query.status); }
  if (query.q) { conditions.push('(p.title LIKE ? OR p.slug LIKE ?)'); params.push(`%${query.q}%`, `%${query.q}%`); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const [[count]] = await pool.query<RowDataPacket[]>(`SELECT COUNT(*) AS total FROM pages p ${where}`, params);
  const offset = (query.page - 1) * query.limit;
  const [pages] = await pool.query<RowDataPacket[]>(
    `SELECT p.*,
       (SELECT d.id FROM page_versions d WHERE d.page_id=p.id AND d.kind='draft' ORDER BY d.id DESC LIMIT 1) AS draft_version_id
       FROM pages p ${where} ORDER BY p.is_home DESC, p.updated_at DESC, p.id DESC LIMIT ? OFFSET ?`,
    [...params, query.limit, offset],
  );
  res.json({ pages, pagination: { page: query.page, limit: query.limit, total: Number(count.total), pages: Math.ceil(Number(count.total) / query.limit) } });
}));

pagesRouter.post('/', requirePermission('pages.create'), asyncHandler(async (req, res) => {
  const data = createSchema.parse(req.body);
  const slug = normalizeSlug(data.slug ?? data.title);
  const content: PageDraft = { sections: [] };
  const conn = await pool.getConnection();
  let pageId = 0;
  try {
    await conn.beginTransaction();
    const [pageResult] = await conn.query<ResultSetHeader>(
      'INSERT INTO pages (title,slug,created_by) VALUES (?,?,?)', [data.title, slug, req.auth!.user.id]);
    pageId = pageResult.insertId;
    const [draftResult] = await conn.query<ResultSetHeader>(
      'INSERT INTO page_versions (page_id,kind,content,created_by) VALUES (?,\'draft\',?,?)',
      [pageId, JSON.stringify(content), req.auth!.user.id]);
    await syncMediaUsages('page_version', draftResult.insertId, [], conn);
    await conn.commit();
  } catch (error) { await conn.rollback(); throw error; }
  finally { conn.release(); }
  await audit(req, 'page.create', 'page', pageId, { title: data.title, slug });
  res.status(201).json({ id: pageId, title: data.title, slug, status: 'draft' });
}));

pagesRouter.get('/:id/draft', requirePermission('pages.view'), asyncHandler(async (req, res) => {
  const id = parsePageId(req.params.id);
  const [pages] = await pool.query<RowDataPacket[]>('SELECT * FROM pages WHERE id=?', [id]);
  if (!pages[0]) throw new HttpError(404, 'Página não encontrada.');
  const [drafts] = await pool.query<RowDataPacket[]>(
    'SELECT id,content,created_at FROM page_versions WHERE page_id=? AND kind=\'draft\' ORDER BY id DESC LIMIT 1', [id]);
  if (!drafts[0]) throw new HttpError(404, 'Rascunho não encontrado.');
  res.json({ page: pages[0], draft: { id: drafts[0].id, content: pageDraftFromDb(drafts[0].content), created_at: drafts[0].created_at } });
}));

pagesRouter.put('/:id/draft', requirePermission('pages.edit'), asyncHandler(async (req, res) => {
  const id = parsePageId(req.params.id);
  const content = pageDraftSchema.parse(req.body);
  const mediaIds = extractMediaIds(content);
  if (mediaIds.length) requirePageAccess(req, 'media.select');
  const conn = await pool.getConnection();
  let versionId = 0;
  try {
    await conn.beginTransaction();
    const [pages] = await conn.query<RowDataPacket[]>('SELECT id,seo_og_image_id FROM pages WHERE id=? FOR UPDATE', [id]);
    if (!pages[0]) throw new HttpError(404, 'Página não encontrada.');
    const [result] = await conn.query<ResultSetHeader>(
      'INSERT INTO page_versions (page_id,kind,content,created_by) VALUES (?,\'draft\',?,?)',
      [id, JSON.stringify(content), req.auth!.user.id]);
    versionId = result.insertId;
    await syncMediaUsages('page_version', versionId, mediaIds, conn);
    await copySeoUsage(id, pages[0].seo_og_image_id ? Number(pages[0].seo_og_image_id) : null, conn);
    await conn.commit();
  } catch (error) { await conn.rollback(); throw error; }
  finally { conn.release(); }
  await audit(req, 'page.draft.save', 'page', id, { version_id: versionId, sections: content.sections.length });
  res.json({ versionId, content });
}));

pagesRouter.patch('/:id', asyncHandler(async (req, res) => {
  const id = parsePageId(req.params.id);
  const data = updateSchema.parse(req.body);
  const hasPageFields = data.title !== undefined || data.slug !== undefined;
  const hasSeoFields = data.seo_title !== undefined || data.seo_description !== undefined || data.seo_canonical !== undefined
    || data.seo_og_image_id !== undefined || data.seo_noindex !== undefined;
  if (hasPageFields) requirePageAccess(req, 'pages.edit');
  if (hasSeoFields) requirePageAccess(req, 'seo.edit');

  const values: unknown[] = [];
  const assignments: string[] = [];
  if (data.title !== undefined) { assignments.push('title=?'); values.push(data.title); }
  if (data.slug !== undefined) { assignments.push('slug=?'); values.push(normalizeSlug(data.slug)); }
  if (data.seo_title !== undefined) { assignments.push('seo_title=?'); values.push(data.seo_title || null); }
  if (data.seo_description !== undefined) { assignments.push('seo_description=?'); values.push(data.seo_description || null); }
  if (data.seo_canonical !== undefined) { assignments.push('seo_canonical=?'); values.push(data.seo_canonical || null); }
  if (data.seo_og_image_id !== undefined) { assignments.push('seo_og_image_id=?'); values.push(data.seo_og_image_id); }
  if (data.seo_noindex !== undefined) { assignments.push('seo_noindex=?'); values.push(data.seo_noindex ? 1 : 0); }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [pages] = await conn.query<RowDataPacket[]>('SELECT id,seo_og_image_id FROM pages WHERE id=? FOR UPDATE', [id]);
    if (!pages[0]) throw new HttpError(404, 'Página não encontrada.');
    const currentOgImageId = pages[0].seo_og_image_id ? Number(pages[0].seo_og_image_id) : null;
    if (data.seo_og_image_id && data.seo_og_image_id !== currentOgImageId) requirePageAccess(req, 'media.select');
    if (data.seo_og_image_id) await ensureMediaExists(data.seo_og_image_id, conn);
    await conn.query(`UPDATE pages SET ${assignments.join(', ')} WHERE id=?`, [...values, id]);
    if (hasSeoFields) {
      const mediaId = data.seo_og_image_id === undefined
        ? (pages[0].seo_og_image_id ? Number(pages[0].seo_og_image_id) : null)
        : data.seo_og_image_id;
      await copySeoUsage(id, mediaId, conn);
    }
    await conn.commit();
  } catch (error) { await conn.rollback(); throw error; }
  finally { conn.release(); }
  await audit(req, 'page.update', 'page', id, data);
  res.json({ ok: true });
}));

pagesRouter.post('/:id/duplicate', requirePermission('pages.create'), asyncHandler(async (req, res) => {
  const id = parsePageId(req.params.id);
  const conn = await pool.getConnection();
  let newId = 0;
  let newSlug = '';
  try {
    await conn.beginTransaction();
    const [sources] = await conn.query<RowDataPacket[]>('SELECT * FROM pages WHERE id=? FOR UPDATE', [id]);
    if (!sources[0]) throw new HttpError(404, 'Página não encontrada.');
    const source = sources[0];
    let [versions] = await conn.query<RowDataPacket[]>(
      'SELECT content FROM page_versions WHERE page_id=? AND kind=\'draft\' ORDER BY id DESC LIMIT 1', [id]);
    if (!versions[0] && source.published_version_id) {
      [versions] = await conn.query<RowDataPacket[]>('SELECT content FROM page_versions WHERE id=? AND page_id=?', [source.published_version_id, id]);
    }
    const content = pageDraftFromDb(versions[0]?.content ?? { sections: [] });
    const mediaIds = extractMediaIds(content);
    if ((mediaIds.length || source.seo_og_image_id) && !can(req.auth!, 'media.select')) {
      throw new HttpError(403, 'Você não tem permissão para reutilizar imagens nesta página.', 'FORBIDDEN');
    }
    const title = `${String(source.title).slice(0, 182)} (cópia)`;
    const slugBase = normalizeSlug(`${source.slug}-copia`);
    for (let suffix = 1; ; suffix++) {
      const tail = suffix === 1 ? '' : `-${suffix}`;
      newSlug = `${slugBase.slice(0, 190 - tail.length)}${tail}`;
      const [exists] = await conn.query<RowDataPacket[]>('SELECT id FROM pages WHERE slug=? LIMIT 1', [newSlug]);
      if (!exists.length) break;
      if (suffix > 1000) throw new HttpError(409, 'Não foi possível gerar um slug disponível.');
    }
    const [pageResult] = await conn.query<ResultSetHeader>(
      'INSERT INTO pages (title,slug,seo_title,seo_description,seo_og_image_id,seo_noindex,created_by) VALUES (?,?,?,?,?,?,?)',
      [title, newSlug, source.seo_title, source.seo_description, source.seo_og_image_id, source.seo_noindex ? 1 : 0, req.auth!.user.id]);
    newId = pageResult.insertId;
    const [draftResult] = await conn.query<ResultSetHeader>(
      'INSERT INTO page_versions (page_id,kind,content,created_by) VALUES (?,\'draft\',?,?)',
      [newId, JSON.stringify(content), req.auth!.user.id]);
    await syncMediaUsages('page_version', draftResult.insertId, mediaIds, conn);
    await copySeoUsage(newId, source.seo_og_image_id ? Number(source.seo_og_image_id) : null, conn);
    await conn.commit();
  } catch (error) { await conn.rollback(); throw error; }
  finally { conn.release(); }
  await audit(req, 'page.duplicate', 'page', newId, { source_id: id, slug: newSlug });
  res.status(201).json({ id: newId, slug: newSlug });
}));

pagesRouter.post('/:id/publish', requirePermission('pages.publish'), asyncHandler(async (req, res) => {
  const id = parsePageId(req.params.id);
  const conn = await pool.getConnection();
  let publishedVersionId = 0;
  try {
    await conn.beginTransaction();
    const [pages] = await conn.query<RowDataPacket[]>('SELECT id,seo_og_image_id FROM pages WHERE id=? FOR UPDATE', [id]);
    if (!pages[0]) throw new HttpError(404, 'Página não encontrada.');
    const [drafts] = await conn.query<RowDataPacket[]>(
      'SELECT id,content FROM page_versions WHERE page_id=? AND kind=\'draft\' ORDER BY id DESC LIMIT 1 FOR UPDATE', [id]);
    if (!drafts[0]) throw new HttpError(409, 'Salve um rascunho antes de publicar.');
    const content = pageDraftFromDb(drafts[0].content);
    const [result] = await conn.query<ResultSetHeader>(
      'INSERT INTO page_versions (page_id,kind,content,created_by) VALUES (?,\'published\',?,?)',
      [id, JSON.stringify(content), req.auth!.user.id]);
    publishedVersionId = result.insertId;
    await conn.query('UPDATE pages SET published_version_id=?,status=\'published\' WHERE id=?', [publishedVersionId, id]);
    await syncMediaUsages('page_version', publishedVersionId, extractMediaIds(content), conn);
    await copySeoUsage(id, pages[0].seo_og_image_id ? Number(pages[0].seo_og_image_id) : null, conn);
    await conn.commit();
  } catch (error) { await conn.rollback(); throw error; }
  finally { conn.release(); }
  await audit(req, 'page.publish', 'page', id, { published_version_id: publishedVersionId });
  res.json({ ok: true, published_version_id: publishedVersionId });
}));

pagesRouter.post('/:id/unpublish', requirePermission('pages.publish'), asyncHandler(async (req, res) => {
  const id = parsePageId(req.params.id);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [pages] = await conn.query<RowDataPacket[]>('SELECT id,status FROM pages WHERE id=? FOR UPDATE', [id]);
    if (!pages[0]) throw new HttpError(404, 'Página não encontrada.');
    if (pages[0].status !== 'published') throw new HttpError(409, 'Esta página já está em rascunho.');
    await conn.query('UPDATE pages SET status=\'draft\',published_version_id=NULL,is_home=0 WHERE id=?', [id]);
    await conn.commit();
  } catch (error) { await conn.rollback(); throw error; }
  finally { conn.release(); }
  await audit(req, 'page.unpublish', 'page', id);
  res.json({ ok: true });
}));

pagesRouter.post('/:id/set-home', requirePermission('pages.publish'), asyncHandler(async (req, res) => {
  const id = parsePageId(req.params.id);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [pages] = await conn.query<RowDataPacket[]>('SELECT id,status FROM pages WHERE id=? FOR UPDATE', [id]);
    if (!pages[0]) throw new HttpError(404, 'Página não encontrada.');
    if (pages[0].status !== 'published') throw new HttpError(409, 'Publique a página antes de defini-la como inicial.');
    await conn.query('SELECT id FROM pages ORDER BY id FOR UPDATE');
    await conn.query('UPDATE pages SET is_home=0 WHERE is_home=1 AND id<>?', [id]);
    await conn.query('UPDATE pages SET is_home=1 WHERE id=?', [id]);
    await conn.commit();
  } catch (error) { await conn.rollback(); throw error; }
  finally { conn.release(); }
  await audit(req, 'page.set_home', 'page', id);
  res.json({ ok: true });
}));

pagesRouter.post('/:id/preview-token', requirePermission('pages.view'), asyncHandler(async (req, res) => {
  const id = parsePageId(req.params.id);
  const [drafts] = await pool.query<RowDataPacket[]>(
    'SELECT id FROM page_versions WHERE page_id=? AND kind=\'draft\' ORDER BY id DESC LIMIT 1', [id]);
  if (!drafts[0]) throw new HttpError(404, 'Rascunho não encontrado.');
  const expiresAt = Math.floor(Date.now() / 1000) + 15 * 60;
  const token = createPreviewToken({ pageId: id, versionId: Number(drafts[0].id), exp: expiresAt });
  await audit(req, 'page.preview.create', 'page', id, { version_id: drafts[0].id, expires_at: expiresAt });
  res.json({ token, expiresAt: new Date(expiresAt * 1000).toISOString(), url: `/api/preview/${token}` });
}));

pagesRouter.delete('/:id', requirePermission('pages.delete'), asyncHandler(async (req, res) => {
  const id = parsePageId(req.params.id);
  const conn = await pool.getConnection();
  let title = '';
  try {
    await conn.beginTransaction();
    const [pages] = await conn.query<RowDataPacket[]>('SELECT id,title FROM pages WHERE id=? FOR UPDATE', [id]);
    if (!pages[0]) throw new HttpError(404, 'Página não encontrada.');
    title = pages[0].title;
    const [versions] = await conn.query<RowDataPacket[]>('SELECT id FROM page_versions WHERE page_id=?', [id]);
    const versionIds = versions.map((row) => Number(row.id));
    if (versionIds.length) {
      await conn.query('DELETE FROM media_usages WHERE entity_type=\'page_version\' AND entity_id IN (?)', [versionIds]);
    }
    await conn.query('DELETE FROM media_usages WHERE entity_type=\'page_seo\' AND entity_id=?', [id]);
    await conn.query('DELETE FROM pages WHERE id=?', [id]);
    await conn.commit();
  } catch (error) { await conn.rollback(); throw error; }
  finally { conn.release(); }
  await audit(req, 'page.delete', 'page', id, { title });
  res.json({ ok: true });
}));

previewRouter.get('/:token', asyncHandler(async (req, res) => {
  const tokenSchema = z.string().min(20).max(1024);
  const payload = verifyPreviewToken(tokenSchema.parse(req.params.token));
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT p.id,p.title,p.slug,p.seo_title,p.seo_description,p.seo_canonical,p.seo_og_image_id,p.seo_noindex,
            v.id AS version_id,v.content,v.created_at AS draft_created_at
       FROM pages p JOIN page_versions v ON v.page_id=p.id
      WHERE p.id=? AND v.id=? AND v.kind='draft'`, [payload.pageId, payload.versionId]);
  if (!rows[0]) throw new HttpError(404, 'Rascunho não encontrado.');
  res.setHeader('Cache-Control', 'no-store');
  res.json({ page: rows[0], content: pageDraftFromDb(rows[0].content), expiresAt: new Date(payload.exp * 1000).toISOString() });
}));
