import type { Request } from 'express';
import { pool } from '../db/pool.js';

export async function audit(
  req: Request | null, action: string, entityType?: string, entityId?: string | number, details?: unknown, userId?: number,
) {
  try {
    await pool.query(
      'INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip) VALUES (?,?,?,?,?,?)',
      [userId ?? req?.auth?.user.id ?? null, action, entityType ?? null, entityId != null ? String(entityId) : null,
       details ? JSON.stringify(details) : null, req?.ip ?? null],
    );
  } catch (e) {
    console.error('Falha ao gravar auditoria', e);
  }
}
