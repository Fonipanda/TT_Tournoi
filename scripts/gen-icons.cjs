/**
 * Génère les icônes PWA + favicon à partir de l'illustration source.
 * Usage : node scripts/gen-icons.cjs <source.png>
 * sharp est résolu depuis le store pnpm (dépendance transitive de Next.js).
 */
const path = require('node:path');
const fs = require('node:fs');

const root = path.resolve(__dirname, '..');
const sharp = require(path.join(root, 'node_modules', '.pnpm', 'sharp@0.33.5', 'node_modules', 'sharp'));

const source = process.argv[2];
if (!source || !fs.existsSync(source)) {
  console.error('Source introuvable :', source);
  process.exit(1);
}

const iconsDir = path.join(root, 'apps', 'web', 'public', 'icons');
const appDir = path.join(root, 'apps', 'web', 'src', 'app');
fs.mkdirSync(iconsDir, { recursive: true });

const targets = [
  { file: path.join(iconsDir, 'icon-192.png'), size: 192 },
  { file: path.join(iconsDir, 'icon-512.png'), size: 512 },
  { file: path.join(iconsDir, 'apple-touch-icon.png'), size: 180 },
  { file: path.join(appDir, 'icon.png'), size: 256 },
  { file: path.join(appDir, 'apple-icon.png'), size: 180 },
];

(async () => {
  for (const { file, size } of targets) {
    await sharp(source).resize(size, size, { fit: 'cover' }).png({ compressionLevel: 9 }).toFile(file);
    console.log('✓', path.relative(root, file), `${size}x${size}`);
  }

  // favicon.ico multi-résolutions (16/32/48) — sharp n'écrit pas l'ICO, on l'assemble à la main.
  const sizes = [16, 32, 48];
  const pngs = [];
  for (const s of sizes) {
    pngs.push(await sharp(source).resize(s, s, { fit: 'cover' }).png({ compressionLevel: 9 }).toBuffer());
  }
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(sizes.length, 4);
  const entries = [];
  let offset = 6 + 16 * sizes.length;
  sizes.forEach((s, i) => {
    const e = Buffer.alloc(16);
    e.writeUInt8(s === 256 ? 0 : s, 0);
    e.writeUInt8(s === 256 ? 0 : s, 1);
    e.writeUInt8(0, 2);
    e.writeUInt8(0, 3);
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(pngs[i].length, 8);
    e.writeUInt32LE(offset, 12);
    offset += pngs[i].length;
    entries.push(e);
  });
  const ico = Buffer.concat([header, ...entries, ...pngs]);
  const icoPath = path.join(appDir, 'favicon.ico');
  fs.writeFileSync(icoPath, ico);
  console.log('✓', path.relative(root, icoPath), '16/32/48');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
