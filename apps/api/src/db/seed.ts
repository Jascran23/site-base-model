import { pool } from './pool.js';
import { PERMISSIONS } from '../lib/permissions.js';
import { DEFAULT_SITE_SETTINGS, DEFAULT_THEME, SECTION_TYPES } from '../lib/defaults.js';

// Seeds idempotentes e genéricos: nenhum dado de cliente.
async function main() {
  for (const p of PERMISSIONS) {
    await pool.query(
      'INSERT INTO permissions (`key`, label, group_name) VALUES (?,?,?) ON DUPLICATE KEY UPDATE label = VALUES(label), group_name = VALUES(group_name)',
      [p.key, p.label, p.group]);
  }
  for (const [type, label] of SECTION_TYPES) {
    await pool.query(
      'INSERT INTO section_types (type, label) VALUES (?,?) ON DUPLICATE KEY UPDATE label = VALUES(label)', [type, label]);
  }
  for (const kind of ['draft', 'published']) {
    await pool.query('INSERT IGNORE INTO theme_settings (kind, tokens) VALUES (?,?)', [kind, JSON.stringify(DEFAULT_THEME)]);
  }
  for (const [key, value] of Object.entries(DEFAULT_SITE_SETTINGS)) {
    await pool.query('INSERT IGNORE INTO site_settings (`key`, value) VALUES (?,?)', [key, JSON.stringify(value)]);
  }
  await pool.query('INSERT IGNORE INTO media_categories (name) VALUES (?)', ['Geral']);
  console.log('Seeds aplicados.');
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
