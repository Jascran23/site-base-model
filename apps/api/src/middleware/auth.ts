import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import type { RowDataPacket } from 'mysql2';
import { pool } from '../db/pool.js';
import { env } from '../config/env.js';
import { HttpError } from '../lib/errors.js';

export const COOKIE_NAME = 'sid';

export interface AuthContext {
  sessionId: string;
  csrfToken: string;
  user: { id: number; name: string; email: string; role: 'master' | 'client_admin' };
  permissions: Set<string>;
}

declare module 'express-serve-static-core' {
  interface Request { auth?: AuthContext }
}

export const hashToken = (token: string) =>
  crypto.createHmac('sha256', env.SESSION_SECRET).update(token).digest('hex');

/** Carrega a sessão (se houver) a partir do cookie. Não bloqueia a requisição. */
export async function attachSession(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.[COOKIE_NAME];
    if (typeof token !== 'string' || token.length < 32) return next();
    const sid = hashToken(token);
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT s.id, s.csrf_token, u.id AS uid, u.name, u.email, u.role, u.is_active
         FROM sessions s JOIN users u ON u.id = s.user_id
        WHERE s.id = ? AND s.expires_at > UTC_TIMESTAMP()`, [sid]);
    const row = rows[0];
    if (!row || !row.is_active) return next();

    let permissions: Set<string>;
    if (row.role === 'master') {
      permissions = new Set(['*']);
    } else {
      const [perms] = await pool.query<RowDataPacket[]>(
        'SELECT permission_key FROM user_permissions WHERE user_id = ?', [row.uid]);
      permissions = new Set(perms.map((p) => p.permission_key as string));
    }
    req.auth = {
      sessionId: row.id, csrfToken: row.csrf_token,
      user: { id: row.uid, name: row.name, email: row.email, role: row.role },
      permissions,
    };
    next();
  } catch (e) { next(e); }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (!req.auth) return next(new HttpError(401, 'Faça login para continuar.', 'UNAUTHENTICATED'));
  next();
}

export const can = (auth: AuthContext, key: string) =>
  auth.permissions.has('*') || auth.permissions.has(key);

/** Exige TODAS as permissões listadas. A validação é sempre feita aqui, no back-end. */
export const requirePermission = (...keys: string[]) => (req: Request, _res: Response, next: NextFunction) => {
  if (!req.auth) return next(new HttpError(401, 'Faça login para continuar.', 'UNAUTHENTICATED'));
  if (!keys.every((k) => can(req.auth!, k))) return next(new HttpError(403, 'Você não tem permissão para esta ação.', 'FORBIDDEN'));
  next();
};

export const requireMaster = (req: Request, _res: Response, next: NextFunction) => {
  if (!req.auth) return next(new HttpError(401, 'Faça login para continuar.', 'UNAUTHENTICATED'));
  if (req.auth.user.role !== 'master') return next(new HttpError(403, 'Acesso restrito ao desenvolvedor.', 'FORBIDDEN'));
  next();
};

/** CSRF (token por sessão enviado no header X-CSRF-Token) para métodos que alteram dados. */
export function csrfProtection(req: Request, _res: Response, next: NextFunction) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (!req.auth) return next(); // sem sessão, as rotas protegidas já respondem 401
  const sent = req.get('x-csrf-token') ?? '';
  const a = Buffer.from(sent);
  const b = Buffer.from(req.auth.csrfToken);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return next(new HttpError(403, 'Sessão inválida. Recarregue a página.', 'CSRF'));
  }
  next();
}
