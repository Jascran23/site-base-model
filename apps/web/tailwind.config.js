import path from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = path.dirname(fileURLToPath(import.meta.url));
/** @type {import('tailwindcss').Config} */
export default {
  content: [path.join(webRoot, 'index.html'), path.join(webRoot, 'src/**/*.{ts,tsx}')],
  theme: {
    extend: {
      colors: {
        // Cores do PAINEL (fixas). O tema do SITE público usa variáveis CSS (--color-primary etc.).
        ink: { 900: '#141c28', 800: '#1b2535', 700: '#2a3750', 500: '#5d6b82', 300: '#b5bfcf', 100: '#e7ebf2', 50: '#f4f6fa' },
        brand: { DEFAULT: '#2f6f6b', dark: '#245a56', soft: '#e3f0ef' },
      },
    },
  },
  plugins: [],
};
