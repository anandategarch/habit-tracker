/**
 * make-growth-marks.mjs — Task 58: aset sekuens pertumbuhan untuk splash.
 *
 * Sumber: public/tree/{tunas,pohon-muda,pohon-dewasa,berbunga}.svg (1024×1024,
 * gaya IKON dengan latar teal kotak — Task 57: latar itulah yang bikin splash
 * tampak "kotak"). Skrip ini mengekstrak HANYA artwork pohon (grup
 * <g transform="translate(0 10)">) lalu menulis 4 file mark TRANSPARAN:
 *
 *   grow-1-tunas.svg → grow-4-berbunga.svg
 *
 * Sistem viewBox SUPAYA TAHAP-TAHAP MENYATU SAAT CROSSFADE (animasi tumbuh):
 * - Lebar & rentang-x SAMA untuk semua: viewBox x=152 w=720 (menutup penuh
 *   elips bayangan x157-867) → skala px-per-unit identik → lebar gundukan
 *   tanah sama besar di semua tahap.
 * - Batas bawah SAMA: y=966 (akar terdalam berbunga: 947.5+10 translate+4
 *   stroke=961.5) → garis tanah jatuh di posisi layar yang SAMA saat semua
 *   image di-bottom-align → tahap baru tampak TUMBUH dari tanah yang sama,
 *   bukan berpindah.
 * - Batas atas per tahap: mengikuti puncak artwork + ~20 unit padding
 *   (semakin dewasa semakin tinggi kanvasnya) → tunas tampil kecil, pohon
 *   berbunga memenuhi kotak.
 * - Bayangan tanah opacity .75 → .16 (konsisten keputusan Task 57 supaya
 *   tidak menempel gelap di background terang aplikasi).
 * - Defs: hanya gradient yang benar-benar dirujuk artwork (xleaf/xleafDark/
 *   xwood). Bunga memakai warna solid (#F1A2C5 dll) — tidak perlu xgold.
 *
 * Jalankan: node scripts/make-growth-marks.mjs  (atau: bun scripts/...)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const SRC_DIR = join(ROOT, 'public', 'tree');
const OUT_DIR = SRC_DIR;

/** Sistem koordinat bersama (lihat header). */
const VB = { x: 152, w: 720, bottom: 966 };

/** Tahap + batas atas viewBox (artwork sudah termasuk translate(0 10)).
 *  Top dihitung dari elemen tertinggi tiap tahap -20 unit padding:
 *  tunas   : ujung batang y=623  → top 603
 *  muda    : ujung daun  y=367  → top 347
 *  dewasa  : ujung daun  y=268  → top 248
 *  berbunga: ujung daun  y=202  → top 182 */
const STAGES = [
  { src: 'tunas.svg', out: 'grow-1-tunas.svg', top: 603 },
  { src: 'pohon-muda.svg', out: 'grow-2-muda.svg', top: 347 },
  { src: 'pohon-dewasa.svg', out: 'grow-3-dewasa.svg', top: 248 },
  { src: 'berbunga.svg', out: 'grow-4-berbunga.svg', top: 182 },
];

for (const { src, out, top } of STAGES) {
  const svg = readFileSync(join(SRC_DIR, src), 'utf8');

  // Ambil HANYA grup artwork (setelah 3 layer latar), sampai </g></svg> terakhir.
  const artMatch = svg.match(/<g transform="translate\(0 10\)">([\s\S]*)<\/g><\/svg>/);
  if (!artMatch) throw new Error(`${src}: grup artwork tidak ditemukan`);
  let art = artMatch[1];

  // Bayangan tanah dilerengkan .75 → .16 (keputusan Task 57).
  art = art.replace(
    /<ellipse cx="512" cy="865" rx="355" ry="52" fill="#020706" opacity="\.75"\/>/,
    '<ellipse cx="512" cy="865" rx="355" ry="52" fill="#020706" opacity=".16"/>'
  );

  // Defs: hanya gradient yang dirujuk artwork.
  const used = [...new Set((art.match(/url\(#x\w+\)/g) ?? []).map((u) => u.slice(5, -1)))];
  const defs = used
    .map((id) => {
      const m = svg.match(new RegExp(`<linearGradient id="${id}"[\\s\\S]*?</linearGradient>`));
      if (!m) throw new Error(`${src}: def gradient ${id} tidak ditemukan`);
      return `  ${m[0]}`;
    })
    .join('\n');

  const h = VB.bottom - top;
  const doc =
`<svg xmlns="http://www.w3.org/2000/svg" width="${VB.w}" height="${h}" viewBox="${VB.x} ${top} ${VB.w} ${h}">
<defs>
${defs}
 </defs>
<g transform="translate(0 10)">${art}</g>
</svg>
`;
  writeFileSync(join(OUT_DIR, out), doc);
  console.log(`✓ ${out}  viewBox="${VB.x} ${top} ${VB.w} ${h}"  (${used.join(', ')})  ${doc.length} bytes`);
}
