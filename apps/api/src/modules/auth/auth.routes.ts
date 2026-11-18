import crypto from 'node:crypto';
import { Router } from 'express';
import argon2 from 'argon2';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import type { RowDataPacket } from 'mysql2';
import { pool } from '../../db/pool.js';
import { env } from '../../config/env.js';
import { asyncHandler, HttpError } from '../../lib/errors.js';
import { audit } from '../../lib/audit.js';
import { COOKIE_NAME, hashToken, requireAuth } from '../../middleware/auth.js';

export const authRouter = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Muitas tentativas. Aguarde alguns minutos.' },
});

const loginSchema = z.object({ email: z.string().email().max(190), password: z.string().min(1).max(200) });

const MAX_FAILS = 5;
const LOCK_MINUTES = 15;
let dummyHash: string | null = null; // evita revelar se o e-mail existe pelo tempo de resposta

const cookieOptions = () => ({
  httpOnly: true, sameSite: 'lax' as const, secure: env.isProd, path: '/',
  maxAge: env.SESSION_TTL_HOURS * 3600 * 1000,
});

authRouter.post('/login', loginLimiter, asyncHandler(async (req, res) => {
  const { email, password } = loginSchema.parse(req.body);
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT *, (locked_until IS NOT NULL AND locked_until > UTC_TIMESTAMP()) AS is_locked FROM users WHERE email = ?',
    [email.toLowerCase()]);
  const user = rows[0];

  if (!user) {
    dummyHash ??= await argon2.hash('dummy-password', { type: argon2.argon2id });
    await argon2.verify(dummyHash, password).catch(() => false);
    throw new HttpError(401, 'E-mail ou senha incorretos.');
  }
  if (user.is_locked) throw new HttpError(429, 'Conta temporariamente bloqueada. Tente novamente em alguns minutos.');

  const ok = user.is_active && (await argon2.verify(user.password_hash, password).catch(() => false));
  if (!ok) {
    await pool.query(
      `UPDATE users SET failed_logins = failed_logins + 1,
         locked_until = IF(failed_logins + 1 >= ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? MINUTE), locked_until),
         failed_logins = IF(failed_logins + 1 >= ?, 0, failed_logins + 1) WHERE id = ?`,
      [MAX_FAILS, LOCK_MINUTES, MAX_FAILS, user.id]);
    await audit(req, 'auth.login_failed', 'user', user.id, null, user.id);
    throw new HttpError(401, 'E-mail ou senha incorretos.');
  }

  const token = crypto.randomBytes(32).toString('hex');
  const csrf = crypto.randomBytes(32).toString('hex');
  await pool.query('DELETE FROM sessions WHERE expires_at < UTC_TIMESTAMP()');
  await pool.query(
    `INSERT INTO sessions (id, user_id, csrf_token, ip, user_agent, expires_at)
     VALUES (?,?,?,?,?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? HOUR))`,
    [hashToken(token), user.id, csrf, req.ip ?? null, (req.get('user-agent') ?? '').slice(0, 255), env.SESSION_TTL_HOURS]);
  await pool.query('UPDATE users SET failed_logins = 0, locked_until = NULL, last_login_at = UTC_TIMESTAMP() WHERE id = ?', [user.id]);
  await audit(req, 'auth.login', 'user', user.id, null, user.id);

  res.cookie(COOKIE_NAME, token, cookieOptions());
  res.json({ csrfToken: csrf, ...(await profile(user.id)) });
}));

authRouter.get('/me', requireAuth, asyncHandler(async (req, res) => {
  res.json({ csrfToken: req.auth!.csrfToken, ...(await profile(req.auth!.user.id)) });
}));

authRouter.post('/logout', requireAuth, asyncHandler(async (req, res) => {
  await pool.query('DELETE FROM sessions WHERE id = ?', [req.auth!.sessionId]);
  await audit(req, 'auth.logout', 'user', req.auth!.user.id);
  res.clearCookie(COOKIE_NAME, { path: '/' });
  res.json({ ok: true });
}));

async function profile(userId: number) {
  const [users] = await pool.query<RowDataPacket[]>('SELECT id, name, email, role FROM users WHERE id = ?', [userId]);
  const user = users[0];
  let permissions: string[];
  if (user.role === 'master') {
    const [all] = await pool.query<RowDataPacket[]>('SELECT `key` FROM permissions');
    permissions = all.map((p) => p.key as string);
  } else {
    const [p] = await pool.query<RowDataPacket[]>('SELECT permission_key FROM user_permissions WHERE user_id = ?', [userId]);
    permissions = p.map((x) => x.permission_key as string);
  }
  return { user: { id: user.id, name: user.name, email: user.email, role: user.role }, permissions };
}
