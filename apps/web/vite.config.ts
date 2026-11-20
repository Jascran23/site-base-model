import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  css: { postcss: { plugins: [tailwindcss({ config: path.join(webRoot, 'tailwind.config.js') }), autoprefixer()] } },
  server: { port: 5173, proxy: { '/api': 'http://localhost:3001', '/uploads': 'http://localhost:3001', '/sitemap.xml': 'http://localhost:3001', '/robots.txt': 'http://localhost:3001' } },
});
