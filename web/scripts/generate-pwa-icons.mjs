/**
 * Renders PNG install icons from public/favicon.svg for the PWA manifest.
 * Run: node scripts/generate-pwa-icons.mjs
 */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const svg = await readFile(join(root, 'public', 'favicon.svg'));

const sizes = [192, 512];
for (const size of sizes) {
  const out = join(root, 'public', `pwa-${size}x${size}.png`);
  await sharp(svg).resize(size, size).png().toFile(out);
  console.log(`wrote ${out}`);
}

// Maskable icon: same artwork with extra padding so Android safe-zone crops cleanly.
const maskable = 512;
const inner = 384;
const padded = await sharp(svg)
  .resize(inner, inner)
  .extend({
    top: (maskable - inner) / 2,
    bottom: (maskable - inner) / 2,
    left: (maskable - inner) / 2,
    right: (maskable - inner) / 2,
    background: { r: 11, g: 14, b: 20, alpha: 1 }
  })
  .png()
  .toBuffer();
const maskableOut = join(root, 'public', 'pwa-maskable-512x512.png');
await writeFile(maskableOut, padded);
console.log(`wrote ${maskableOut}`);
