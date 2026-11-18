import { pool } from '../db/pool.js';
import { env } from '../config/env.js';
import { hashPassword, passwordSchema } from '../lib/password.js';
import { audit } from '../lib/audit.js';
import type { RowDataPacket } from 'mysql2';

// Procedimento de instalação: cria o desenvolvedor master a partir do .env. Não há cadastro público.
async function main() {
  const { MASTER_NAME, MASTER_EMAIL, MASTER_PASSWORD } = env;
  if (!MASTER_EMAIL || !MASTER_PASSWORD) {
    console.error('Defina MASTER_EMAIL e MASTER_PASSWORD no .env antes de executar.');
    process.exit(1);
  }
  const check = passwordSchema.safeParse(MASTER_PASSWORD);
  if (!check.success) { console.error(check.error.issues[0].message); process.exit(1); }

  const [rows] = await pool.query<RowDataPacket[]>("SELECT id FROM users WHERE role = 'master' LIMIT 1");
  if (rows.length) {
    console.log('Já existe um usuário master. Nada a fazer.');
  } else {
    const [r] = await pool.query(
      "INSERT INTO users (name, email, password_hash, role) VALUES (?,?,?, 'master')",
      [MASTER_NAME || 'Desenvolvedor', MASTER_EMAIL.toLowerCase(), await hashPassword(MASTER_PASSWORD)]);
    await audit(null, 'install.master_created', 'user', (r as { insertId: number }).insertId);
    console.log(`Master criado: ${MASTER_EMAIL}`);
    console.log('IMPORTANTE: remova MASTER_PASSWORD do .env agora.');
  }
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
