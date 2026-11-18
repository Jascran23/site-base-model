import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import { env } from '../config/env.js';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations');

// Divide o arquivo em comandos (os .sql deste projeto não usam ';' dentro de strings).
function splitStatements(sql: string): string[] {
  return sql
    .split('\n')
    .filter((l) => !l.trim().startsWith('--'))
    .join('\n')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
}

async function main() {
  const conn = await mysql.createConnection({
    host: env.DB_HOST, port: env.DB_PORT, user: env.DB_USER,
    password: env.DB_PASSWORD, database: env.DB_NAME, charset: 'utf8mb4',
  });
  await conn.query(`CREATE TABLE IF NOT EXISTS _migrations (
    name VARCHAR(190) PRIMARY KEY, applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  const [rows] = await conn.query('SELECT name FROM _migrations');
  const applied = new Set((rows as { name: string }[]).map((r) => r.name));
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();

  let count = 0;
  for (const file of files) {
    if (applied.has(file)) continue;
    console.log(`> aplicando ${file}`);
    for (const stmt of splitStatements(fs.readFileSync(path.join(dir, file), 'utf8'))) {
      await conn.query(stmt);
    }
    await conn.query('INSERT INTO _migrations (name) VALUES (?)', [file]);
    count++;
  }
  console.log(count ? `Migrations aplicadas: ${count}` : 'Banco já está atualizado.');
  await conn.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
