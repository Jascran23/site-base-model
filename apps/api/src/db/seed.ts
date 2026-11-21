import { pool } from './pool.js';
import { PERMISSIONS } from '../lib/permissions.js';
import { DEFAULT_SITE_SETTINGS, DEFAULT_THEME, SECTION_TYPES } from '../lib/defaults.js';
import { randomUUID } from 'node:crypto';
import { sectionRegistry, type PageDraft } from '@cms/shared/section-registry';

// Seeds idempotentes e genéricos: nenhum dado de cliente.
async function main() {
  for (const p of PERMISSIONS) {
    await pool.query(
      'INSERT INTO permissions (`key`, label, group_name) VALUES (?,?,?) ON DUPLICATE KEY UPDATE label = VALUES(label), group_name = VALUES(group_name)',
      [p.key, p.label, p.group]);
  }
  await pool.query("DELETE FROM user_permissions WHERE permission_key='sections.manage'");
  const sectionTypes = new Map<string, { label: string; schemaVersion: number }>(SECTION_TYPES.map(([type, label]) => [type, { label, schemaVersion: 1 }]));
  for (const definition of Object.values(sectionRegistry)) sectionTypes.set(definition.type, { label: definition.label, schemaVersion: definition.schemaVersion });
  for (const [type, definition] of sectionTypes) {
    await pool.query(
      'INSERT INTO section_types (type, label, schema_version) VALUES (?,?,?) ON DUPLICATE KEY UPDATE label = VALUES(label), schema_version = VALUES(schema_version)',
      [type, definition.label, definition.schemaVersion]);
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
