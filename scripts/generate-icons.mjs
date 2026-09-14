// Generate paket ikon PWA Rutina — Task 56: artwork pohon botanical pengguna.
// Sumber kebenaran: public/tree/tunas.svg (tahap "Tunas" — identitas "tumbuh"
// aplikasi; artwork yang SAMA dengan kartu Pohonmu Beranda, tab Pohon, dan
// splash screen TreeMark — satu suara dari launcher → splash → dalam app).
//
// Turunan:
//   1) "any" (icon-192/512.png + logo.svg): artwork full-bleed — rx=44 sudut
//      dilepas supaya tile gelap memenuhi kanvas (sudut transparan akan
//      terlihat "lubang" di launcher/ikon tab).
//   2) maskable (icon-192/512-maskable.png): bg gradien tetap full-bleed,
//      seluruh konten (grid + glow + pohon) dikecilkan ke safe-zone 66/108
//      Android. Matematika: titik konten terjauh dari pusat = ujung ellipse
//      tanah (512±355, 865) → 500.4 unit; skala maks = 313/500.4 = 0.625 →
//      dipakai 0.62 (margin ~3 unit). Verifikasi piksel 72 sampel ring.
//   3) apple-touch-icon.png 180: full-bleed square (iOS memotong sendiri).
//   4) favicon.ico 16/32/48: full-bleed square — tile gelap + tunas hijau
//      terbaca di tab bar terang maupun gelap.
//
// Filter SVG: tunas.svg hanya memakai feGaussianBlur (#xglow) — didukung
// librsvg sharp; TIDAK ada feDropShadow (yang notorius tidak didukung).
//
// REGRESI-GUARD (pelajaran Task 35): logo.svg wajib bisa dirender sharp —
// ikon manifest yang gagal parse XML membuat Chrome menolak install PWA.

import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'fs';

const PUBLIC = 'public';

const ART = readFileSync(`${PUBLIC}/tree/tunas.svg`, 'utf8');

// Surgery string — bg rect persis dari generator artwork (fail-fast kalau
// aset berubah struktur, jangan diam-diam render ikon rusak).
const BG_RECT_RX = '<rect width="1024" height="1024" rx="44" fill="url(#xbg)"/>';
const BG_RECT_FULL = '<rect width="1024" height="1024" fill="url(#xbg)"/>';
if (!ART.includes(BG_RECT_RX)) {
  throw new Error('tunas.svg berubah struktur (bg rect rx=44 tidak ketemu) — perbarui surgery string generate-icons.mjs!');
}

// 1) Square full-bleed — sudut rx dilepas, sisanya identik.
const squareSvg = ART.replace(BG_RECT_RX, BG_RECT_FULL);

// 2) Maskable — konten dalam safe-zone, bg gradien tetap full kanvas.
const SAFE_SCALE = 0.62;
const translate = (512 * (1 - SAFE_SCALE)).toFixed(2); // 194.56
const maskableSvg = squareSvg
  .replace(BG_RECT_FULL, `${BG_RECT_FULL}<g transform="translate(${translate} ${translate}) scale(${SAFE_SCALE})">`)
  .replace(/<\/svg>\s*$/, '</g></svg>');

// Render artwork SVG (intrinsik 1024×1024) → PNG ukuran berapa pun.
async function renderArt(svg, size, file) {
  await sharp(Buffer.from(svg)).resize(size, size, { fit: 'fill' }).png({ compressionLevel: 9 }).toFile(file);
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

// Safe-zone maskable: 72 sampel pada lingkaran r=33/108. Sampel boleh berupa
// bg gelap/gradien/grid samar (toleransi 25/255 per kanal vs referensi sudut)
// — grid hanya ~5.5% opacity, glow 7%; yang DILARANG: konten terang (daun,
// batang, stroke tanah #2A241B) menembus ring.
async function verifyMaskableSafeZone(file, size) {
  const R = (33 / 108) * size;
  const c = size / 2;
  const bg = await pixel(file, 2, 2);
  let violations = 0;
  for (let a = 0; a < 360; a += 5) {
    const rad = (a * Math.PI) / 180;
    const p = await pixel(file, Math.round(c + R * Math.cos(rad)), Math.round(c + R * Math.sin(rad)));
    if (p[3] > 200 && (Math.abs(p[0] - bg[0]) > 25 || Math.abs(p[1] - bg[1]) > 25 || Math.abs(p[2] - bg[2]) > 25)) {
      violations++;
    }
  }
  if (violations > 0) {
    throw new Error(`${file}: ${violations} sampel konten menembus lingkaran safe-zone 66/108!`);
  }
  console.log(`  ✓ ${file}: 0 konten di luar safe-zone (72 sampel, bg ref rgb(${bg.slice(0, 3)}))`);
}

console.log('Generasi ikon Rutina — artwork tunas botanical pengguna (Task 56)...');

// "any" + logo.svg: full-bleed square.
await renderArt(squareSvg, 192, `${PUBLIC}/icon-192.png`);
await renderArt(squareSvg, 512, `${PUBLIC}/icon-512.png`);
writeFileSync(`${PUBLIC}/logo.svg`, squareSvg);
console.log('  ✓ public/logo.svg (square full-bleed, ditulis statis)');

// maskable: bg full + konten 62% dalam safe-zone.
await renderArt(maskableSvg, 192, `${PUBLIC}/icon-192-maskable.png`);
await renderArt(maskableSvg, 512, `${PUBLIC}/icon-512-maskable.png`);

// apple-touch-icon: 180 opaque full-bleed (iOS memotong sudut sendiri).
await renderArt(squareSvg, 180, `${PUBLIC}/apple-touch-icon.png`);

// favicon.ico: 16/32/48.
const favPngs = [];
for (const s of [16, 32, 48]) {
  favPngs.push(await sharp(Buffer.from(squareSvg)).resize(s, s, { fit: 'fill' }).png().toBuffer());
}
writeFileSync(`${PUBLIC}/favicon.ico`, buildIco(favPngs));
console.log('  ✓ public/favicon.ico (16/32/48)');

// ── Verifikasi piksel ────────────────────────────────────────────────────
await verifyMaskableSafeZone(`${PUBLIC}/icon-512-maskable.png`, 512);

const corner = await pixel(`${PUBLIC}/icon-512-maskable.png`, 2, 2);
console.log(`  ✓ maskable sudut: rgb(${corner.slice(0, 3)}) ${corner[3] === 255 ? 'opaque' : 'TRANSPARAN?!'}`);

// Konten pohon benar-benar ter-render: batang artwork (x≈515, y≈720, stroke
// xwood coklat lebar 16) → maskable scaled 0.62 di 512 raster ≈ (257, 320).
// Guard anti "bg polos tanpa pohon" (mis. filter gagal → render kosong).
const bgRef = await pixel(`${PUBLIC}/icon-512-maskable.png`, 2, 2);
const trunkM = await pixel(`${PUBLIC}/icon-512-maskable.png`, 257, 320);
const deltaM = Math.abs(trunkM[0] - bgRef[0]) + Math.abs(trunkM[1] - bgRef[1]) + Math.abs(trunkM[2] - bgRef[2]);
if (deltaM < 60) {
  throw new Error(`pohon tidak terdeteksi di maskable (delta rgb ${deltaM}) — artwork mungkin gagal render!`);
}
console.log(`  ✓ maskable batang terdeteksi (delta rgb ${deltaM} vs bg)`);

const trunkAny = await pixel(`${PUBLIC}/icon-512.png`, 258, 360);
const deltaAny = Math.abs(trunkAny[0] - bgRef[0]) + Math.abs(trunkAny[1] - bgRef[1]) + Math.abs(trunkAny[2] - bgRef[2]);
if (deltaAny < 60) {
  throw new Error(`pohon tidak terdeteksi di icon-512 (delta rgb ${deltaAny}) — artwork mungkin gagal render!`);
}
console.log(`  ✓ any batang terdeteksi (delta rgb ${deltaAny} — coklat kayu = tunas ada)`);

// REGRESI-GUARD: logo.svg HARUS SVG valid yang bisa dirender (XML komentar
// tidak boleh mengandung minus ganda — bug Task 35 yang sempat merusak
// installability PWA karena Chrome gagal parse ikon manifest).
try {
  const md = await sharp(`${PUBLIC}/logo.svg`).metadata();
  console.log(`  ✓ logo.svg valid & ter-render (${md.format}, ${md.width}x${md.height})`);
} catch (e) {
  throw new Error(`logo.svg RUSAK — Chrome akan gagal parse: ${e.message}`);
}
console.log('Selesai — 6 file ikon artwork tunas pengguna.');
