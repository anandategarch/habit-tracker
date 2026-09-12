// Generate paket ikon PWA Rutina — desain TUNAS (sprout) Lucide, warna teal.
// Opsi R2 (Task 34): logo asli Rutina dipulihkan dari sejarah git, di-recolor
// dari hijau #22c55e → teal #3eb59e agar senada tema Aurora saat ini (warna
// --primary yang benar-benar dirender browser, diverifikasi via canvas).
//
// Matematika safe-zone maskable (standar Android adaptive icon):
//   lingkaran aman = radius 33/108 dari kanvas (diameter 66/108 ≈ 61%).
//   Glyph tunas: bbox 24-space ≈ x[4.5..19.5], y[1.5..20] (+stroke 1) → titik
//   terjauh dari pusat glyph ≈ 12.5 unit / 24. Skala k (24×k dari 100 kanvas):
//   jarak maks = 12.5k/100 kanvas → aman bila ≤ 33/108 → k ≤ 2.44.
//   Maskable pakai k=2.4 → verifikasi piksel otomatis di bawah (harus 0
//   pelanggaran). Generator lama (125af1f) memakai k=3 dengan asumsi
//   "safe zone 80%" yang keliru — daun bisa terpotong launcher lingkaran.
//
// Output (nama file sama dengan yang dipakai manifest/layout — tanpa perubahan
// referensi): icon-192.png, icon-512.png (any), icon-192-maskable.png,
// icon-512-maskable.png, apple-touch-icon.png, favicon.ico (16/32/48).
// logo.svg ditulis terpisah sebagai file statis.

import sharp from 'sharp';

const PUBLIC = 'public';
// teal persis seperti --primary yang dirender aplikasi (oklch 0.7 0.11 178)
const TEAL = '#3eb59e';
const WHITE = '#ffffff';

// Lucide "sprout" — ikon yang sampai hari ini dipakai di sidebar aplikasi.
const SPROUT_PATHS = [
  'M7 20h10',
  'M10 20c5.5-2.5.8-6.4 3-10',
  'M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z',
  'M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z',
];

// k = faktor skala: 24×k unit di kanvas 100 (k=3 → glyph 72% kanvas).
function buildSvg({ bg, stroke, k, sw }) {
  const size = 24 * k;
  const offset = (100 - size) / 2;
  const bgRect = bg ? `<rect width="100" height="100" fill="${bg}"/>` : '';
  const paths = SPROUT_PATHS.map((d) => `<path d="${d}"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  ${bgRect}
  <g transform="translate(${offset},${offset}) scale(${k})" fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">
    ${paths}
  </g>
</svg>`;
}

async function renderPng(svg, size, file) {
  await sharp(Buffer.from(svg), { density: (size / 100) * 72 })
    .png({ compressionLevel: 9 })
    .toFile(file);
  const meta = await sharp(file).metadata();
  if (meta.width !== size || meta.height !== size) {
    throw new Error(`${file}: expected ${size}x${size}, got ${meta.width}x${meta.height}`);
  }
  console.log(`  ✓ ${file} (${size}x${size})`);
}

// ICO multi-size: header + direktori + blob PNG (didukung semua browser modern).
function buildIco(pngBuffers) {
  const count = pngBuffers.length;
  const dirSize = 16 * count;
  let offset = 6 + dirSize;
  const dir = Buffer.alloc(dirSize);
  pngBuffers.forEach((png, i) => {
    const w = png.readUInt32BE(16);
    const h = png.readUInt32BE(20);
    dir.writeUInt8(w >= 256 ? 0 : w, i * 16 + 0);
    dir.writeUInt8(h >= 256 ? 0 : h, i * 16 + 1);
    dir.writeUInt16LE(1, i * 16 + 4);
    dir.writeUInt16LE(32, i * 16 + 6);
    dir.writeUInt32LE(png.length, i * 16 + 8);
    dir.writeUInt32LE(offset, i * 16 + 12);
    offset += png.length;
  });
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(count, 4);
  return Buffer.concat([header, dir, ...pngBuffers]);
}

async function pixel(file, x, y) {
  const { data, info } = await sharp(file).raw().toBuffer({ resolveWithObject: true });
  const i = (y * info.width + x) * info.channels;
  return [data[i], data[i + 1], data[i + 2], data[i + 3]];
}

async function verifyMaskableSafeZone(file, size) {
  const R = (33 / 108) * size;
  const c = size / 2;
  let violations = 0;
  for (let a = 0; a < 360; a += 5) {
    const rad = (a * Math.PI) / 180;
    const p = await pixel(file, Math.round(c + R * Math.cos(rad)), Math.round(c + R * Math.sin(rad)));
    if (p[3] > 200 && Math.abs(p[0] - 62) > 25) violations++; // bukan bg teal → glyph
  }
  if (violations > 0) {
    throw new Error(`${file}: ${violations} sampel glyph di luar lingkaran safe-zone 66/108!`);
  }
  console.log(`  ✓ ${file}: 0 piksel glyph di luar lingkaran safe-zone (72 sampel)`);
}

console.log('Generasi ikon Rutina — tunas teal #3eb59e (Opsi R2)...');

// "any": transparan + tunas teal (tab browser, desktop, splash).
const anySvg = buildSvg({ bg: null, stroke: TEAL, k: 3.4, sw: 1.9 });
await renderPng(anySvg, 192, `${PUBLIC}/icon-192.png`);
await renderPng(anySvg, 512, `${PUBLIC}/icon-512.png`);

// "maskable": bg teal full-bleed + tunas putih, k=2.4 (safe-zone 66/108 benar).
const maskSvg = buildSvg({ bg: TEAL, stroke: WHITE, k: 2.4, sw: 2 });
await renderPng(maskSvg, 192, `${PUBLIC}/icon-192-maskable.png`);
await renderPng(maskSvg, 512, `${PUBLIC}/icon-512-maskable.png`);

// apple-touch-icon: bg teal full-bleed opaque + tunas putih (iOS potong sendiri).
await renderPng(buildSvg({ bg: TEAL, stroke: WHITE, k: 2.7, sw: 2 }), 180, `${PUBLIC}/apple-touch-icon.png`);

// favicon.ico: 16/32/48 transparan + tunas teal bold.
const favSvg = buildSvg({ bg: null, stroke: TEAL, k: 3.6, sw: 2.4 });
const favPngs = [];
for (const s of [16, 32, 48]) {
  favPngs.push(await sharp(Buffer.from(favSvg), { density: (s / 100) * 72 }).png().toBuffer());
}
const { writeFileSync } = await import('fs');
writeFileSync(`${PUBLIC}/favicon.ico`, buildIco(favPngs));
console.log('  ✓ public/favicon.ico (16/32/48)');

// Verifikasi piksel: maskable safe-zone + sudut + glyph ada.
await verifyMaskableSafeZone(`${PUBLIC}/icon-512-maskable.png`, 512);
const corner = await pixel(`${PUBLIC}/icon-512-maskable.png`, 2, 2);
console.log(`  ✓ maskable sudut: rgb(${corner.slice(0, 3)}) ${corner[3] === 255 ? 'opaque' : 'TRANSPARAN?!'}`);
const anyCorner = await pixel(`${PUBLIC}/icon-512.png`, 2, 2);
console.log(`  ✓ any sudut alpha: ${anyCorner[3]} (0 = transparan)`);
const glyph = await pixel(`${PUBLIC}/icon-512-maskable.png`, 256, 256);
console.log(`  ✓ maskable pusat: rgb(${glyph.slice(0, 3)}) (putih = tunas ada)`);
console.log('Selesai — 6 file ikon tunas teal.');
