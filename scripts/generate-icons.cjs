/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * ICON-FIX-1: Generate PWA icons with proper maskable safe zones.
 *
 * Why this script exists:
 *  - The previous icons had TRANSPARENT corners (alpha=0) and a green sprout
 *    blob in the middle. They were declared for both "any" AND "maskable"
 *    purpose in manifest.webmanifest. Maskable icons REQUIRE a full-bleed
 *    background (Android masks the icon into various shapes; transparent
 *    corners get filled with the manifest background_color and the icon
 *    looks broken / is rejected by some launchers).
 *  - layout.tsx referenced a data: SVG emoji for apple-touch-icon, which
 *    iOS Safari ignores (iOS requires PNG). We now ship a dedicated
 *    apple-touch-icon.png (180x180, full-bleed green bg + white sprout).
 *  - No favicon.ico existed. Browsers fall back to /favicon.ico; we now
 *    ship a multi-size ICO (16/32/48).
 *
 * Design:
 *  - "any" purpose icons (icon-192.png, icon-512.png):
 *      transparent background, green (#22c55e) Lucide-sprout stroke.
 *      Looks good in browser tabs and on Android home screen
 *      (Android supplies its own background).
 *  - "maskable" purpose icons (icon-{192,512}-maskable.png):
 *      full-bleed green (#22c55e) background, WHITE Lucide-sprout stroke,
 *      sized to ~72% of canvas with 14% padding each side -> well inside
 *      the maskable safe zone (center 80%).
 *  - apple-touch-icon.png (180x180): full-bleed green bg + white sprout.
 *      iOS applies its own corner rounding.
 *  - favicon.ico: multi-size (16, 32, 48), transparent bg + green sprout.
 *
 * Run:  node scripts/generate-icons.cjs
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');

const GREEN = '#22c55e';
const WHITE = '#ffffff';

// Lucide "sprout" icon paths (viewBox 0 0 24 24). Matches the icon used in
// the app sidebar so the home-screen icon is visually consistent with the
// in-app brand mark.
const SPROUT_PATHS = [
  'M7 20h10',
  'M10 20c5.5-2.5.8-6.4 3-10',
  'M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z',
  'M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z',
];

/**
 * Build an SVG source string for the sprout icon.
 * @param {object} opts
 * @param {string} opts.bg        Background fill, or 'transparent' to omit.
 * @param {string} opts.stroke    Stroke color for the sprout.
 * @param {number} opts.scale     Scale factor applied to the 24x24 design.
 *                                The design is centered in a 100x100 viewBox.
 * @param {number} opts.strokeWidth  Stroke width in 24-unit space (will be
 *                                scaled by `scale`).
 */
function buildSvg({ bg, stroke, scale, strokeWidth }) {
  const size = 24 * scale; // design size in 100-unit space
  const offset = (100 - size) / 2; // center
  const paths = SPROUT_PATHS.map(
    (d) => `<path d="${d}"/>`
  ).join('');
  const bgRect =
    bg && bg !== 'transparent'
      ? `<rect width="100" height="100" fill="${bg}"/>`
      : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  ${bgRect}
  <g transform="translate(${offset},${offset}) scale(${scale})" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">
    ${paths}
  </g>
</svg>`;
}

async function renderPng(svgString, size, outFile) {
  const buf = Buffer.from(svgString, 'utf8');
  await sharp(buf, { density: 384 })
    .resize(size, size, { fit: 'cover' })
    .png({ compressionLevel: 9 })
    .toFile(outFile);
  console.log(`  wrote ${path.relative(PUBLIC_DIR, outFile)} (${size}x${size})`);
}

/**
 * Build a multi-size .ico file from PNG buffers.
 * ICO format:
 *   header (6B): reserved(2)=0, type(2)=1, count(2)
 *   directory entry (16B each): w, h, palette(0), reserved(0),
 *       planes(2)=1, bpp(2)=32, size(4), offset(4)
 *   image data: PNG blobs
 */
function buildIco(pngBuffers) {
  const count = pngBuffers.length;
  const headerSize = 6;
  const dirSize = 16 * count;
  let offset = headerSize + dirSize;
  const dir = Buffer.alloc(dirSize);
  pngBuffers.forEach((png, i) => {
    // PNG dimensions are at bytes 16-19 (width/height, 4 bytes each, big-endian)
    const w = png.readUInt32BE(16);
    const h = png.readUInt32BE(20);
    dir.writeUInt8(w >= 256 ? 0 : w, i * 16 + 0);
    dir.writeUInt8(h >= 256 ? 0 : h, i * 16 + 1);
    dir.writeUInt8(0, i * 16 + 2); // color count (0 = >256 colors)
    dir.writeUInt8(0, i * 16 + 3); // reserved
    dir.writeUInt16LE(1, i * 16 + 4); // color planes
    dir.writeUInt16LE(32, i * 16 + 6); // bits per pixel
    dir.writeUInt32LE(png.length, i * 16 + 8); // image size
    dir.writeUInt32LE(offset, i * 16 + 12); // offset to image data
    offset += png.length;
  });
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type = ICO
  header.writeUInt16LE(count, 4);
  return Buffer.concat([header, dir, ...pngBuffers]);
}

async function main() {
  console.log('Generating PWA icons into', PUBLIC_DIR);

  // ── "any" purpose icons (transparent bg, green sprout) ───────────────
  // Smaller stroke so the sprout reads cleanly in browser tabs at small sizes.
  const anySvg = buildSvg({
    bg: 'transparent',
    stroke: GREEN,
    scale: 3,
    strokeWidth: 1.8,
  });
  await renderPng(anySvg, 192, path.join(PUBLIC_DIR, 'icon-192.png'));
  await renderPng(anySvg, 512, path.join(PUBLIC_DIR, 'icon-512.png'));
  // PERF-ASSETS-1 FIX-TIER1: icon-96.png removed — was for push
  // notifications, but push notifications were removed in SW v9.

  // ── "maskable" purpose icons (full-bleed green bg, white sprout) ─────
  // Content sized at ~72% of canvas (scale 3 -> 24*3=72 in 100-space,
  // 14% padding each side -> well inside the 80% safe zone).
  const maskableSvg = buildSvg({
    bg: GREEN,
    stroke: WHITE,
    scale: 3,
    strokeWidth: 1.8,
  });
  await renderPng(
    maskableSvg,
    192,
    path.join(PUBLIC_DIR, 'icon-192-maskable.png')
  );
  await renderPng(
    maskableSvg,
    512,
    path.join(PUBLIC_DIR, 'icon-512-maskable.png')
  );

  // ── Apple touch icon (180x180, green bg + white sprout) ──────────────
  // iOS Safari REQUIRES a PNG apple-touch-icon (SVG is ignored). iOS will
  // apply its own rounded-corner mask, so we ship a full-bleed square.
  await renderPng(
    maskableSvg,
    180,
    path.join(PUBLIC_DIR, 'apple-touch-icon.png')
  );

  // PERF-ASSETS-1 FIX-TIER1: badge-72.png generation block removed —
  // was for push notification badge, but push notifications were removed
  // in SW v9 (per worklog CONSOLIDATION + BUG-SCAN-2 entries). The
  // transparent-bg + white-sprout SVG was identical to `anySvg` above
  // anyway, so no `buildSvg` call needs to be retained.

  // ── favicon.ico (multi-size: 16, 32, 48) ─────────────────────────────
  // Transparent bg + green sprout, scaled to read at tiny sizes (bolder
  // stroke so it doesn't disappear at 16x16).
  const favSvg = buildSvg({
    bg: 'transparent',
    stroke: GREEN,
    scale: 3,
    strokeWidth: 2.4,
  });
  const favSizes = [16, 32, 48];
  const favPngs = [];
  for (const s of favSizes) {
    const buf = Buffer.from(favSvg, 'utf8');
    const png = await sharp(buf, { density: 384 })
      .resize(s, s, { fit: 'cover' })
      .png({ compressionLevel: 9 })
      .toBuffer();
    favPngs.push(png);
  }
  const ico = buildIco(favPngs);
  fs.writeFileSync(path.join(PUBLIC_DIR, 'favicon.ico'), ico);
  console.log(
    `  wrote favicon.ico (${favSizes.join('/')} multi-size, ${ico.length}B)`
  );

  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
