import { Router } from 'express';
import type { RowDataPacket } from 'mysql2';
import { pool } from '../../db/pool.js';
import { asyncHandler } from '../../lib/errors.js';
import { can, requireAuth } from '../../middleware/auth.js';

export const dashboardRouter = Router();

dashboardRouter.get('/', requireAuth, asyncHandler(async (req, res) => {
  const [[counts]] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS total, SUM(status='published') AS published, SUM(status='draft') AS draft FROM pages`) as [RowDataPacket[], unknown];
  const [recentPages] = await pool.query<RowDataPacket[]>(
    'SELECT id, title, slug, status, updated_at FROM pages ORDER BY updated_at DESC LIMIT 5');

  let activity: RowDataPacket[] = [];
  if (can(req.auth!, 'audit.view')) {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT a.id, a.action, a.entity_type, a.entity_id, a.created_at, u.name AS user_name
         FROM audit_logs a LEFT JOIN users u ON u.id = a.user_id
        ORDER BY a.id DESC LIMIT 10`);
    activity = rows;
  }
  res.json({
    pages: { total: Number(counts.total ?? 0), published: Number(counts.published ?? 0), draft: Number(counts.draft ?? 0) },
    recentPages, activity,
  });
}));
