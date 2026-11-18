import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT_DIR = path.resolve(here, '../../../..');
dotenv.config({ path: path.join(ROOT_DIR, '.env') });

const schema = z.object({
  PROJECT_NAME: z.string().default('Site Institucional'),
  SITE_URL: z.string().url().default('http://localhost:5173'),
  API_PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DB_HOST: z.string().default('127.0.0.1'),
  DB_PORT: z.coerce.number().default(3306),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().default(''),
  DB_NAME: z.string().min(1),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET precisa ter ao menos 32 caracteres'),
  SESSION_TTL_HOURS: z.coerce.number().default(12),
  MASTER_NAME: z.string().optional(),
  MASTER_EMAIL: z.string().email().optional(),
  MASTER_PASSWORD: z.string().optional(),
  STORAGE_DIR: z.string().default('./storage/uploads'),
  MAX_UPLOAD_MB: z.coerce.number().default(5),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Configuração inválida (.env):');
  for (const issue of parsed.error.issues) console.error(` - ${issue.path.join('.')}: ${issue.message}`);
  process.exit(1);
}

export const env = {
  ...parsed.data,
  isProd: parsed.data.NODE_ENV === 'production',
  storageDir: path.resolve(ROOT_DIR, parsed.data.STORAGE_DIR),
};
