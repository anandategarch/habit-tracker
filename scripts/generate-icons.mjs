// Generate paket ikon PWA (Opsi L1) dari desain logo.svg yang sudah ada.
// Varian:
//  1. "any"       → tampilan asli (rounded square + stroke + Z), PNG 192 & 512.
//  2. "maskable"  → background full-bleed #2D2D2D + Z diperkecil ke safe-zone
//                   Android adaptive icon (lingkaran 66/108 dp), PNG 192 & 512.
//  3. "apple"     → background full-bleed opaque + Z skala 0.85, PNG 180
//                   (iOS memotong sudut sendiri; SVG tidak didukung).
// Animasi z-breathe (opacity) dibuang — ikon statis harus full-opacity.
// Matematika safe-zone: glyph Z memiliki titik terjauh dari pusat ≈ 12.204
// unit (viewBox 30). Radius safe-zone = 33/108 × 30 ≈ 9.167 unit.
// Skala 0.72 → 12.204 × 0.72 ≈ 8.79 unit ✓ (margin 0.38 unit).

import sharp from 'sharp';

const BG_PATH =
  'M24.51,28.51H5.49c-2.21,0-4-1.79-4-4V5.49c0-2.21,1.79-4,4-4h19.03c2.21,0,4,1.79,4,4v19.03C28.51,26.72,26.72,28.51,24.51,28.51z';
const Z_TOP =
  'M15.47,7.1l-1.3,1.85c-0.2,0.29-0.54,0.47-0.9,0.47h-7.1V7.09C6.16,7.1,15.47,7.1,15.47,7.1z';
const Z_POLY = '24.3,7.1 13.14,22.91 5.7,22.91 16.86,7.1';
const Z_BOTTOM =
  'M14.53,22.91l1.31-1.86c0.2-0.29,0.54-0.47,0.9-0.47h7.09v2.33H14.53z';
const GLYPH_CENTER = { x: 15.0, y: 15.005 };

function zGlyph(scale) {
  const t =
    scale === 1
      ? ''
      : ` transform="translate(${GLYPH_CENTER.x},${GLYPH_CENTER.y}) scale(${scale}) translate(${-GLYPH_CENTER.x},${-GLYPH_CENTER.y})"`;
  return `<g fill="#FFFFFF"${t}><path d="${Z_TOP}"/><polygon points="${Z_POLY}"/><path d="${Z_BOTTOM}"/></g>`;
}

function anySvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 30">
  <path d="${BG_PATH}" fill="#2D2D2D" stroke="#FFFFFF" stroke-width="0.6317" stroke-miterlimit="10"/>
  ${zGlyph(1)}
</svg>`;
}

function fullBleedSvg(glyphScale) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 30">
  <rect width="30" height="30" fill="#2D2D2D"/>
  ${zGlyph(glyphScale)}
</svg>`;
}

async function render(svg, size, file) {
  const buf = Buffer.from(svg);
  await sharp(buf, { density: (size / 30) * 72 }).png().toFile(file);
  const meta = await sharp(file).metadata();
  if (meta.width !== size || meta.height !== size) {
    throw new Error(`${file}: expected ${size}x${size}, got ${meta.width}x${meta.height}`);
  }
  console.log(`✓ ${file} (${meta.width}x${meta.height})`);
}

await render(anySvg(), 192, 'public/icon-192.png');
await render(anySvg(), 512, 'public/icon-512.png');
await render(fullBleedSvg(0.72), 192, 'public/icon-192-maskable.png');
await render(fullBleedSvg(0.72), 512, 'public/icon-512-maskable.png');
await render(fullBleedSvg(0.85), 180, 'public/apple-touch-icon.png');
console.log('Selesai — 5 ikon dibuat.');
