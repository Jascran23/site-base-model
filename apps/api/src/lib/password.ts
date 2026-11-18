import argon2 from 'argon2';
import { z } from 'zod';

export const hashPassword = (plain: string) => argon2.hash(plain, { type: argon2.argon2id });

export const passwordSchema = z.string()
  .min(10, 'A senha precisa ter ao menos 10 caracteres.')
  .max(200)
  .regex(/[a-zA-Z]/, 'A senha precisa ter letras.')
  .regex(/[0-9]/, 'A senha precisa ter números.');
