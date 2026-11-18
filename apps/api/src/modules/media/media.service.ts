import { randomUUID } from 'node:crypto';
import { mkdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import type { Pool, PoolConnection } from 'mysql2/promise';
import { env } from '../../config/env.js';
import { HttpError } from '../../lib/errors.js';

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
export const supportedImageTypes = IMAGE_TYPES;

export interface ProcessedImage { storedName: string; thumbName: string; width: number; height: number; sizeBytes: number }

export async function processImage(buffer: Buffer): Promise<ProcessedImage> {
  await mkdir(env.storageDir, { recursive: true });
  const storedName = `${randomUUID()}.webp`;
  const thumbName = `${randomUUID()}.webp`;
  const mainPath = path.join(env.storageDir, storedName);
  const thumbPath = path.join(env.storageDir, thumbName);
  try {
    const image = sharp(buffer, { limitInputPixels: 40_000_000, animated: true }).rotate();
    const metadata = await image.metadata();
    if (!metadata.width || !metadata.height) throw new Error('Imagem sem dimensões válidas.');
    await image.clone().resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 84, effort: 4 }).toFile(mainPath);
    await sharp(buffer, { limitInputPixels: 40_000_000 }).rotate()
      .resize({ width: 400, height: 400, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 78, effort: 4 }).toFile(thumbPath);
    const output = await sharp(mainPath).metadata();
    const file = await stat(mainPath);
    return { storedName, thumbName, width: output.width ?? metadata.width, height: output.height ?? metadata.height, sizeBytes: file.size };
  } catch (error) {
    await Promise.all([rm(mainPath, { force: true }), rm(thumbPath, { force: true })]);
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, 'Não foi possível processar esta imagem. Envie um arquivo de imagem válido.', 'INVALID_IMAGE');
  }
}

export async function removeImageFiles(storedName: string, thumbName: string | null) {
  const names = [storedName, thumbName].filter((name): name is string => !!name);
  await Promise.all(names.map((name) => rm(path.join(env.storageDir, name), { force: true })));
}

export async function syncMediaUsages(
  entityType: 'page_version' | 'page_seo' | 'theme' | 'setting', entityId: number, mediaIds: number[],
  executor: Pool | PoolConnection,
) {
  const ids = [...new Set(mediaIds)];
  if (ids.length) {
    const [rows] = await executor.query('SELECT id FROM media WHERE id IN (?)', [ids]);
    if ((rows as { id: number }[]).length !== ids.length) throw new HttpError(400, 'Uma ou mais imagens não existem.', 'INVALID_MEDIA');
  }
  await executor.query('DELETE FROM media_usages WHERE entity_type = ? AND entity_id = ?', [entityType, entityId]);
  for (const mediaId of ids) {
    await executor.query('INSERT INTO media_usages (media_id, entity_type, entity_id) VALUES (?,?,?)', [mediaId, entityType, entityId]);
  }
}
