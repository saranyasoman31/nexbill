import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');

if (!fs.existsSync(distDir)) {
  console.error('✗ dist directory does not exist. Run vite build first.');
  process.exit(1);
}

// 1. Copy dist/assets to ./assets at root
const rootAssetsDir = path.join(rootDir, 'assets');
const distAssetsDir = path.join(distDir, 'assets');

if (fs.existsSync(distAssetsDir)) {
  if (fs.existsSync(rootAssetsDir)) {
    fs.rmSync(rootAssetsDir, { recursive: true, force: true });
  }
  fs.mkdirSync(rootAssetsDir, { recursive: true });
  
  const assetFiles = fs.readdirSync(distAssetsDir);
  for (const file of assetFiles) {
    fs.copyFileSync(path.join(distAssetsDir, file), path.join(rootAssetsDir, file));
  }
  console.log(`✓ Copied ${assetFiles.length} production assets to ./assets/`);
}

// 2. Copy .htaccess to root
const distHtaccess = path.join(distDir, '.htaccess');
const rootHtaccess = path.join(rootDir, '.htaccess');
if (fs.existsSync(distHtaccess)) {
  fs.copyFileSync(distHtaccess, rootHtaccess);
  console.log('✓ Copied .htaccess to repository root');
}

// 3. Copy SVG icons to root if present
for (const icon of ['favicon.svg', 'icons.svg']) {
  const distIcon = path.join(distDir, icon);
  const rootIcon = path.join(rootDir, icon);
  if (fs.existsSync(distIcon)) {
    fs.copyFileSync(distIcon, rootIcon);
  }
}

// 4. Copy dist/index.html to ./index.html
const distIndex = path.join(distDir, 'index.html');
const rootIndex = path.join(rootDir, 'index.html');
if (fs.existsSync(distIndex)) {
  fs.copyFileSync(distIndex, rootIndex);
  console.log('✓ Copied production index.html to repository root');
}

console.log('✓ Production deployment files ready at repository root for Hostinger Git!');
