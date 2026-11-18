import { Router } from 'express';
import { z } from 'zod';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { pool } from '../../db/pool.js';
import { asyncHandler, HttpError } from '../../lib/errors.js';
import { audit } from '../../lib/audit.js';
import { GRANTABLE_KEYS, PERMISSIONS } from '../../lib/permissions.js';
import { hashPassword, passwordSchema } from '../../lib/password.js';
import { requireAuth, requirePermission } from '../../middleware/auth.js';

export const usersRouter = Router();
usersRouter.use(requireAuth, requirePermission('users.manage')); // só o master possui '*'

const permissionList = z.array(z.string()).refine(
  (list) => list.every((k) => GRANTABLE_KEYS.includes(k)),
  'Lista contém permissões inexistentes ou exclusivas do desenvolvedor.',
);

const createSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().email().max(190).transform((v) => v.toLowerCase()),
  password: passwordSchema,
  permissions: permissionList.default([]),
});

const updateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  is_active: z.boolean().optional(),
  password: passwordSchema.optional(),
  permissions: permissionList.optional(),
});

usersRouter.get('/permissions', (_req, res) => {
  res.json({ permissions: PERMISSIONS.filter((p) => !p.masterOnly) });
});

usersRouter.get('/', asyncHandler(async (_req, res) => {
  const [users] = await pool.query<RowDataPacket[]>(
    'SELECT id, name, email, role, is_active, last_login_at, created_at FROM users ORDER BY role, name');
  const [perms] = await pool.query<RowDataPacket[]>('SELECT user_id, permission_key FROM user_permissions');
  const byUser = new Map<number, string[]>();
  for (const p of perms) byUser.set(p.user_id, [...(byUser.get(p.user_id) ?? []), p.permission_key]);
  res.json({ users: users.map((u) => ({ ...u, permissions: byUser.get(u.id) ?? [] })) });
}));

usersRouter.post('/', asyncHandler(async (req, res) => {
  const data = createSchema.parse(req.body);
  const [exists] = await pool.query<RowDataPacket[]>('SELECT id FROM users WHERE email = ?', [data.email]);
  if (exists.length) throw new HttpError(409, 'Já existe um usuário com este e-mail.');

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [r] = await conn.query<ResultSetHeader>(
      "INSERT INTO users (name, email, password_hash, role) VALUES (?,?,?, 'client_admin')",
      [data.name, data.email, await hashPassword(data.password)]);
    for (const key of data.permissions) {
      await conn.query('INSERT INTO user_permissions (user_id, permission_key) VALUES (?,?)', [r.insertId, key]);
    }
    await conn.commit();
    await audit(req, 'user.create', 'user', r.insertId, { email: data.email, permissions: data.permissions });
    res.status(201).json({ id: r.insertId });
  } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
}));

usersRouter.patch('/:id', asyncHandler(async (req, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const data = updateSchema.parse(req.body);
  const [rows] = await pool.query<RowDataPacket[]>('SELECT id, role FROM users WHERE id = ?', [id]);
  const target = rows[0];
  if (!target) throw new HttpError(404, 'Usuário não encontrado.');
  if (target.role === 'master' && id !== req.auth!.user.id) throw new HttpError(403, 'O usuário master não pode ser alterado por aqui.');
  if (id === req.auth!.user.id && data.is_active === false) throw new HttpError(400, 'Você não pode desativar a si mesmo.');

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    if (data.name !== undefined) await conn.query('UPDATE users SET name = ? WHERE id = ?', [data.name, id]);
    if (data.is_active !== undefined) await conn.query('UPDATE users SET is_active = ? WHERE id = ?', [data.is_active ? 1 : 0, id]);
    if (data.password) await conn.query('UPDATE users SET password_hash = ? WHERE id = ?', [await hashPassword(data.password), id]);
    if (data.permissions && target.role !== 'master') {
      await conn.query('DELETE FROM user_permissions WHERE user_id = ?', [id]);
      for (const key of data.permissions) {
        await conn.query('INSERT INTO user_permissions (user_id, permission_key) VALUES (?,?)', [id, key]);
      }
    }
    if (data.is_active === false || data.password) await conn.query('DELETE FROM sessions WHERE user_id = ?', [id]);
    await conn.commit();
  } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }

  await audit(req, 'user.update', 'user', id, { ...data, password: data.password ? '***' : undefined });
  res.json({ ok: true });
}));
