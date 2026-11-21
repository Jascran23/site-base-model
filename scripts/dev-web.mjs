import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createServer } from 'vite';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../apps/web');
const { default: config } = await import(pathToFileURL(path.join(root, 'vite.config.mjs')).href);
const server = await createServer({ ...config, root, configFile: false });
await server.listen();
server.printUrls();

const close = async () => {
  await server.close();
  process.exit(0);
};
process.once('SIGINT', close);
process.once('SIGTERM', close);
