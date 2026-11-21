import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'vite';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../apps/web');
const { default: config } = await import(pathToFileURL(path.join(root, 'vite.config.mjs')).href);
await build({ ...config, root, configFile: false });
await build({
  ...config,
  root,
  configFile: false,
  build: { ...config.build, ssr: 'src/entry-server.tsx', outDir: 'dist/server', emptyOutDir: false },
});
