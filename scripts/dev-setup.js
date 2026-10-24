import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const devHtmlPath = path.join(rootDir, 'index.dev.html');
const indexHtmlPath = path.join(rootDir, 'index.html');

if (fs.existsSync(devHtmlPath)) {
  fs.copyFileSync(devHtmlPath, indexHtmlPath);
  console.log('✓ Restored dev index.html for local Vite development');
} else {
  console.warn('! index.dev.html not found, keeping existing index.html');
}
