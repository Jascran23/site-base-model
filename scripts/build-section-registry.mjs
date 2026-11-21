import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../packages/shared/src');
const outDir = path.resolve(root, '../dist');
await build({
  configFile: false,
  root,
  esbuild: { jsx: 'automatic' },
  build: {
    emptyOutDir: false,
    lib: { entry: path.join(root, 'sections/custom-registry.ts'), formats: ['es'], fileName: 'custom-registry.vite' },
    rollupOptions: { external: ['react', 'react/jsx-runtime', 'react-dom', 'zod', 'lucide-react'] },
    outDir,
  },
});
