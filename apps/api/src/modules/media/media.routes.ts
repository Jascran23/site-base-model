import { Router } from 'express';
import multer from 'multer';
import { fileTypeFromBuffer } from 'file-type';
import { z } from 'zod';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import type { Request, RequestHandler } from 'express';
import { pool } from '../../db/pool.js';
import { asyncHandler, HttpError } from '../../lib/errors.js';
import { audit } from '../../lib/audit.js';
import { can, requireAuth, requirePermission } from '../../middleware/auth.js';
import { env } from '../../config/env.js';
import { processImage, removeImageFiles, supportedImageTypes } from './media.service.js';

export const mediaRouter = Router();
mediaRouter.use(requireAuth);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: env.MAX_UPLOAD_MB * 1024 * 1024, files: 1 } });
const receiveImage: RequestHandler = (req, res, next) => upload.single('file')(req, res, (error) => {
  if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') return next(new HttpError(413, `A imagem excede o limite de ${env.MAX_UPLOAD_MB} MB.`, 'UPLOAD_TOO_LARGE'));
  if (error instanceof multer.MulterError) return next(new HttpError(400, 'Envie apenas uma imagem por vez.', 'INVALID_UPLOAD'));
  next(error);
});
const idSchema = z.coerce.number().int().positive();
const categorySchema = z.object({ name: z.string().trim().min(1).max(80) }).strict();
const metadataSchema = z.object({
  alt_text: z.string().trim().max(255).nullable().optional(),
  category_id: z.union([z.coerce.number().int().positive(), z.null()]).optional(),
}).strict().refine((data) => data.alt_text !== undefined || data.category_id !== undefined, 'Informe ao menos um campo.');

function requireAnyPermission(...keys: string[]) {
  return (req: Request,
    _res: import('express').Response, next: import('express').NextFunction) => {
    if (!req.auth) return next(new HttpError(401, 'Faça login para continuar.', 'UNAUTHENTICATED'));
    if (!keys.some((key) => can(req.auth!, key))) return next(new HttpError(403, 'Você não tem permissão para esta ação.', 'FORBIDDEN'));
    next();
  };
}

async function parseImage(req: import('express').Request) {
  if (!req.file) throw new HttpError(400, 'Selecione uma imagem para enviar.', 'INVALID_UPLOAD');
  const detected = await fileTypeFromBuffer(req.file.buffer);
  if (!detected || !supportedImageTypes.has(detected.mime)) throw new HttpError(400, 'Formato de imagem inválido. Use JPEG, PNG, WebP ou GIF.', 'INVALID_IMAGE');
  return detected;
}

mediaRouter.get('/categories', requireAnyPermission('media.view', 'media.select'), asyncHandler(async (_req, res) => {
  const [categories] = await pool.query<RowDataPacket[]>(
    'SELECT c.id, c.name, COUNT(m.id) AS media_count FROM media_categories c LEFT JOIN media m ON m.category_id = c.id GROUP BY c.id, c.name ORDER BY c.name');
  res.json({ categories });
}));

mediaRouter.post('/categories', requirePermission('media.upload'), asyncHandler(async (req, res) => {
  const data = categorySchema.parse(req.body);
  const [result] = await pool.query<ResultSetHeader>('INSERT INTO media_categories (name) VALUES (?)', [data.name]);
  await audit(req, 'media.category.create', 'media_category', result.insertId, data);
  res.status(201).json({ id: result.insertId, name: data.name });
}));

mediaRouter.patch('/categories/:id', requirePermission('media.upload'), asyncHandler(async (req, res) => {
  const id = idSchema.parse(req.params.id); const data = categorySchema.parse(req.body);
  const [result] = await pool.query<ResultSetHeader>('UPDATE media_categories SET name = ? WHERE id = ?', [data.name, id]);
  if (!result.affectedRows) throw new HttpError(404, 'Categoria não encontrada.');
  await audit(req, 'media.category.update', 'media_category', id, data);
  res.json({ ok: true });
}));

mediaRouter.delete('/categories/:id', requirePermission('media.upload'), asyncHandler(async (req, res) => {
  const id = idSchema.parse(req.params.id);
  const [result] = await pool.query<ResultSetHeader>('DELETE FROM media_categories WHERE id = ?', [id]);
  if (!result.affectedRows) throw new HttpError(404, 'Categoria não encontrada.');
  await audit(req, 'media.category.delete', 'media_category', id);
  res.json({ ok: true });
}));

mediaRouter.get('/', requireAnyPermission('media.view', 'media.select'), asyncHandler(async (req, res) => {
  const query = z.object({ q: z.string().trim().max(120).optional(), category_id: z.coerce.number().int().positive().optional(),
    page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(60).default(24) }).parse(req.query);
  const where: string[] = []; const params: unknown[] = [];
  if (query.q) { where.push('(m.original_name LIKE ? OR m.alt_text LIKE ?)'); params.push(`%${query.q}%`, `%${query.q}%`); }
  if (query.category_id) { where.push('m.category_id = ?'); params.push(query.category_id); }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [[count]] = await pool.query<RowDataPacket[]>(`SELECT COUNT(*) AS total FROM media m ${clause}`, params);
  const offset = (query.page - 1) * query.limit;
  const [items] = await pool.query<RowDataPacket[]>(
    `SELECT m.id, m.category_id, c.name AS category_name, m.original_name, m.stored_name, m.mime_type, m.size_bytes, m.width, m.height, m.alt_text, m.thumb_name, m.created_at
       FROM media m LEFT JOIN media_categories c ON c.id = m.category_id ${clause}
      ORDER BY m.created_at DESC, m.id DESC LIMIT ? OFFSET ?`, [...params, query.limit, offset]);
  res.json({ items, pagination: { page: query.page, limit: query.limit, total: Number(count.total), pages: Math.ceil(Number(count.total) / query.limit) } });
}));

mediaRouter.post('/', requirePermission('media.upload'), receiveImage, asyncHandler(async (req, res) => {
  await parseImage(req);
  const fields = z.object({ alt_text: z.string().trim().max(255).optional().default(''), category_id: z.union([z.coerce.number().int().positive(), z.literal('')]).optional() }).strict().parse(req.body);
  const categoryId = fields.category_id === '' ? null : fields.category_id ?? null;
  if (categoryId) {
    const [categories] = await pool.query<RowDataPacket[]>('SELECT id FROM media_categories WHERE id = ?', [categoryId]);
    if (!categories.length) throw new HttpError(400, 'Categoria inválida.');
  }
  const output = await processImage(req.file!.buffer);
  try {
    const originalName = req.file!.originalname.replace(/[\\/\0-\x1f]/g, '').slice(0, 255) || 'imagem';
    const [result] = await pool.query<ResultSetHeader>(
      'INSERT INTO media (category_id, original_name, stored_name, mime_type, size_bytes, width, height, alt_text, thumb_name, uploaded_by) VALUES (?,?,?,?,?,?,?,?,?,?)',
      [categoryId, originalName, output.storedName, 'image/webp', output.sizeBytes, output.width, output.height, fields.alt_text || null, output.thumbName, req.auth!.user.id]);
    await audit(req, 'media.upload', 'media', result.insertId, { original_name: originalName, size_bytes: output.sizeBytes });
    res.status(201).json({ id: result.insertId, ...output, original_name: originalName, mime_type: 'image/webp', alt_text: fields.alt_text || null,
      url: `/uploads/${output.storedName}`, thumbnail_url: `/uploads/${output.thumbName}` });
  } catch (error) { await removeImageFiles(output.storedName, output.thumbName); throw error; }
}));

mediaRouter.get('/:id/usages', requirePermission('media.view'), asyncHandler(async (req, res) => {
  const id = idSchema.parse(req.params.id);
  const [media] = await pool.query<RowDataPacket[]>('SELECT id FROM media WHERE id=?', [id]);
  if (!media.length) throw new HttpError(404, 'Imagem não encontrada.');
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT u.entity_type, u.entity_id, u.context, p.title AS page_title, p.slug AS page_slug
       FROM media_usages u LEFT JOIN page_versions v ON u.entity_type='page_version' AND v.id=u.entity_id
       LEFT JOIN pages p ON (p.id=v.page_id OR (u.entity_type='page_seo' AND p.id=u.entity_id))
      WHERE u.media_id=? ORDER BY u.id DESC`, [id]);
  res.json({ usages: rows });
}));

mediaRouter.get('/:id', requireAnyPermission('media.view', 'media.select'), asyncHandler(async (req, res) => {
  const id = idSchema.parse(req.params.id);
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT m.*, c.name AS category_name FROM media m LEFT JOIN media_categories c ON c.id=m.category_id WHERE m.id=?', [id]);
  if (!rows[0]) throw new HttpError(404, 'Imagem não encontrada.');
  res.json({ item: { ...rows[0], url: `/uploads/${rows[0].stored_name}`, thumbnail_url: rows[0].thumb_name ? `/uploads/${rows[0].thumb_name}` : null } });
}));

mediaRouter.patch('/:id', requirePermission('media.upload'), asyncHandler(async (req, res) => {
  const id = idSchema.parse(req.params.id); const data = metadataSchema.parse(req.body);
  if (data.category_id) {
    const [categories] = await pool.query<RowDataPacket[]>('SELECT id FROM media_categories WHERE id=?', [data.category_id]);
    if (!categories.length) throw new HttpError(400, 'Categoria inválida.');
  }
  const fields: string[] = []; const values: unknown[] = [];
  if (data.alt_text !== undefined) { fields.push('alt_text=?'); values.push(data.alt_text || null); }
  if (data.category_id !== undefined) { fields.push('category_id=?'); values.push(data.category_id); }
  const [result] = await pool.query<ResultSetHeader>(`UPDATE media SET ${fields.join(', ')} WHERE id=?`, [...values, id]);
  if (!result.affectedRows) throw new HttpError(404, 'Imagem não encontrada.');
  await audit(req, 'media.update', 'media', id, data);
  res.json({ ok: true });
}));

mediaRouter.post('/:id/replace', requirePermission('media.upload'), receiveImage, asyncHandler(async (req, res) => {
  const id = idSchema.parse(req.params.id); await parseImage(req);
  const [rows] = await pool.query<RowDataPacket[]>('SELECT stored_name, thumb_name FROM media WHERE id=?', [id]);
  if (!rows[0]) throw new HttpError(404, 'Imagem não encontrada.');
  const output = await processImage(req.file!.buffer);
  try {
    const originalName = req.file!.originalname.replace(/[\\/\0-\x1f]/g, '').slice(0, 255) || 'imagem';
    await pool.query('UPDATE media SET original_name=?, stored_name=?, mime_type=?, size_bytes=?, width=?, height=?, thumb_name=? WHERE id=?',
      [originalName, output.storedName, 'image/webp', output.sizeBytes, output.width, output.height, output.thumbName, id]);
    await removeImageFiles(rows[0].stored_name, rows[0].thumb_name);
    await audit(req, 'media.replace', 'media', id, { original_name: originalName });
    res.json({ ok: true, ...output, url: `/uploads/${output.storedName}`, thumbnail_url: `/uploads/${output.thumbName}` });
  } catch (error) { await removeImageFiles(output.storedName, output.thumbName); throw error; }
}));

mediaRouter.delete('/:id', requirePermission('media.delete'), asyncHandler(async (req, res) => {
  const id = idSchema.parse(req.params.id); const conn = await pool.getConnection();
  let storedName = ''; let thumbName: string | null = null;
  try {
    await conn.beginTransaction();
    const [items] = await conn.query<RowDataPacket[]>('SELECT stored_name, thumb_name FROM media WHERE id=? FOR UPDATE', [id]);
    if (!items[0]) throw new HttpError(404, 'Imagem não encontrada.');
    storedName = items[0].stored_name; thumbName = items[0].thumb_name;
    const [usages] = await conn.query<RowDataPacket[]>('SELECT id FROM media_usages WHERE media_id=? LIMIT 1 FOR UPDATE', [id]);
    if (usages.length) throw new HttpError(409, 'Esta imagem está em uso e não pode ser excluída.', 'MEDIA_IN_USE');
    await conn.query('DELETE FROM media WHERE id=?', [id]);
    await conn.commit();
  } catch (error) { await conn.rollback(); throw error; } finally { conn.release(); }
  await removeImageFiles(storedName, thumbName);
  await audit(req, 'media.delete', 'media', id);
  res.json({ ok: true });
}));

