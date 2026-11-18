import { pool } from './pool.js';
import { PERMISSIONS } from '../lib/permissions.js';
import { DEFAULT_SITE_SETTINGS, DEFAULT_THEME, SECTION_TYPES } from '../lib/defaults.js';
import { randomUUID } from 'node:crypto';
import { sectionRegistry, type PageDraft } from '@cms/shared';

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
  const plans = [
    ['advocacia', [['Início',['hero']],['Sobre',['about']],['Áreas de atuação',['services']],['Equipe',['about']],['Contato',['contact']]]],
    ['saude', [['Início',['hero']],['Sobre',['about']],['Especialidades',['services']],['Profissionais',['about']],['Estrutura',['about']],['Contato',['contact']]]],
    ['institucional', [['Início',['hero']],['Sobre',['about']],['Serviços',['services']],['Diferenciais',['about']],['Portfólio',['services']],['Contato',['contact']]]],
  ] as const;
  for (const [segment, templates] of plans) for (const [name, types] of templates) {
    const [existing] = await pool.query('SELECT id FROM templates WHERE segment=? AND name=? AND kind=\'page\' LIMIT 1', [segment,name]);
    if (Array.isArray(existing) && existing.length) continue;
    const content: PageDraft = { sections: types.map((type) => { const def=sectionRegistry[type as keyof typeof sectionRegistry]; return { id:randomUUID(),type,schemaVersion:def.schemaVersion,props:structuredClone(def.defaultProps) }; }) };
    await pool.query('INSERT INTO templates (segment,name,kind,content) VALUES (?, ?, \'page\', ?)', [segment,name,JSON.stringify(content)]);
  }
  console.log('Seeds aplicados.');
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
