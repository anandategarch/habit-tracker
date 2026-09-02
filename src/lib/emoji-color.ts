/**
 * Emoji Color Extraction Utility
 *
 * Extracts the dominant color from an emoji using Canvas API, then resolves
 * conflicts with existing colors (adjusts hue/lightness if too similar).
 *
 * Used by: Finance category forms, Habit forms, Habit group forms.
 * Replaces manual color picker — color is auto-derived from emoji.
 */

// ── Color conversion helpers ─────────────────────────────────────────────

interface HSL {
  h: number; // 0-360
  s: number; // 0-100
  l: number; // 0-100
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const cleaned = hex.replace('#', '');
  if (cleaned.length !== 6) return null;
  const r = parseInt(cleaned.slice(0, 2), 16);
  const g = parseInt(cleaned.slice(2, 4), 16);
  const b = parseInt(cleaned.slice(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
  return { r, g, b };
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function rgbToHsl(r: number, g: number, b: number): HSL {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));

  if (d !== 0) {
    switch (max) {
      case r: h = ((g - b) / d) % 6; break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h *= 60;
    if (h < 0) h += 360;
  }

  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  s /= 100; l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;

  if (h < 60) { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }

  return {
    r: (r + m) * 255,
    g: (g + m) * 255,
    b: (b + m) * 255,
  };
}

function hslToHex(h: number, s: number, l: number): string {
  const { r, g, b } = hslToRgb(h, s, l);
  return rgbToHex(r, g, b);
}

function hexToHsl(hex: string): HSL | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  return rgbToHsl(rgb.r, rgb.g, rgb.b);
}

// ── Hue difference (circular, 0-180) ─────────────────────────────────────

function hueDiff(h1: number, h2: number): number {
  const diff = Math.abs(h1 - h2) % 360;
  return diff > 180 ? 360 - diff : diff;
}

// ── Dominant color extraction via Canvas ─────────────────────────────────

// Cache extracted colors — same emoji always produces same color, no need
// to re-render to canvas every time. Cache is module-level (survives across
// components, cleared on page reload).
const colorCache = new Map<string, string>();

/**
 * Extract the dominant color from an emoji.
 *
 * Strategy:
 * 1. Render emoji to a small canvas (48×48 — fast, enough pixels for color)
 * 2. Read all pixels via getImageData
 * 3. Filter out: transparent, near-white, near-black, near-gray (low saturation)
 * 4. Score remaining pixels by saturation (vibrant colors score higher)
 * 5. Return the highest-scoring color as hex
 *
 * Fallback: if emoji is monochrome (all gray/black/white), return a default
 * slate color (#64748b).
 *
 * @param emoji - single emoji character (e.g. "🍎", "🚗")
 * @returns hex color string (e.g. "#ef4444")
 */
function extractDominantColor(emoji: string): string {
  // Check cache first
  const cached = colorCache.get(emoji);
  if (cached) return cached;

  // SSR guard — canvas is browser-only
  if (typeof document === 'undefined') {
    return '#64748b'; // slate-500 fallback
  }

  try {
    const size = 48;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return '#64748b';

    // Render emoji centered, large enough to fill most of the canvas
    ctx.font = `${Math.floor(size * 0.8)}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emoji, size / 2, size / 2);

    const imageData = ctx.getImageData(0, 0, size, size);
    const pixels = imageData.data;

    // Collect color scores: weight by saturation (vibrant colors preferred)
    const colorScores = new Map<string, number>();
    let hasColor = false;

    for (let i = 0; i < pixels.length; i += 4) {
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];
      const a = pixels[i + 3];

      // Skip transparent
      if (a < 128) continue;

      const hsl = rgbToHsl(r, g, b);

      // Skip near-white (l > 90) and near-black (l < 10)
      if (hsl.l > 90 || hsl.l < 10) continue;

      // Skip low-saturation (gray) — we want vibrant colors
      if (hsl.s < 20) continue;

      hasColor = true;

      // Quantize to reduce noise: round hue to nearest 10°, sat to 5%, light to 5%
      const hKey = Math.round(hsl.h / 10) * 10;
      const sKey = Math.round(hsl.s / 5) * 5;
      const lKey = Math.round(hsl.l / 5) * 5;
      const key = `${hKey}-${sKey}-${lKey}`;

      // Score: saturation * (1 - |lightness - 50|/50) — prefer vibrant mid-tone
      const score = hsl.s * (1 - Math.abs(hsl.l - 50) / 50);
      colorScores.set(key, (colorScores.get(key) ?? 0) + score);
    }

    if (!hasColor) {
      // Monochrome emoji — cache + return fallback
      colorCache.set(emoji, '#64748b');
      return '#64748b';
    }

    // Find the highest-scoring color bucket
    let bestKey = '';
    let bestScore = -1;
    for (const [key, score] of colorScores) {
      if (score > bestScore) {
        bestScore = score;
        bestKey = key;
      }
    }

    // Parse the winning bucket back to HSL → hex
    const [h, s, l] = bestKey.split('-').map(Number);
    // Clamp lightness to 40-65 range for good visibility on both light/dark mode
    const clampedL = Math.max(40, Math.min(65, l));
    const result = hslToHex(h, s, clampedL);

    colorCache.set(emoji, result);
    return result;
  } catch {
    return '#64748b';
  }
}

// ── Conflict resolution ──────────────────────────────────────────────────

/**
 * Resolve color conflicts: if the proposed color's hue is within `threshold`
 * degrees of any existing color, adjust the proposed color until it's unique.
 *
 * Strategy (try in order, up to 5 attempts):
 * 1. Darken by 10% (lower lightness)
 * 2. Lighten by 10% (raise lightness)
 * 3. Shift hue +15°
 * 4. Shift hue −15°
 * 5. Darken by 20%
 *
 * If still conflicting after 5 attempts, return the last attempt (best effort).
 *
 * @param color - proposed hex color
 * @param existingColors - array of existing hex colors to avoid
 * @param threshold - hue difference threshold in degrees (default 15)
 * @returns adjusted hex color (may equal input if no conflict)
 */
function resolveColorConflict(
  color: string,
  existingColors: string[],
  threshold: number = 15
): string {
  const proposed = hexToHsl(color);
  if (!proposed) return color;

  // If no existing colors, no conflict
  if (existingColors.length === 0) return color;

  // Check if proposed color conflicts with any existing
  const existingHsl = existingColors
    .map(hexToHsl)
    .filter((h): h is HSL => h !== null);

  const hasConflict = (test: HSL): boolean => {
    return existingHsl.some((ex) => {
      // Only compare hue if BOTH colors have meaningful saturation (>20%).
      // Two grays with different hues are NOT a conflict.
      if (test.s < 20 && ex.s < 20) {
        // Both gray — compare lightness instead. Conflict if lightness within 10%.
        return Math.abs(test.l - ex.l) < 10;
      }
      if (test.s < 20 || ex.s < 20) return false; // one gray, one colored — no conflict
      return hueDiff(test.h, ex.h) < threshold;
    });
  };

  if (!hasConflict(proposed)) return color;

  // Try adjustments
  const attempts: HSL[] = [
    { ...proposed, l: Math.max(30, proposed.l - 10) },           // darker
    { ...proposed, l: Math.min(75, proposed.l + 10) },           // lighter
    { ...proposed, h: (proposed.h + 15) % 360 },                  // hue shift +
    { ...proposed, h: (proposed.h + 360 - 15) % 360 },           // hue shift −
    { ...proposed, l: Math.max(25, proposed.l - 20) },           // much darker
  ];

  for (const attempt of attempts) {
    if (!hasConflict(attempt)) {
      return hslToHex(attempt.h, attempt.s, attempt.l);
    }
  }

  // All attempts conflicted — return the darker variant (best effort)
  return hslToHex(attempts[0].h, attempts[0].s, attempts[0].l);
}

/**
 * Convenience: extract color from emoji + resolve conflicts in one call.
 *
 * @param emoji - emoji character
 * @param existingColors - existing hex colors to avoid duplicating
 * @param threshold - hue difference threshold (default 15°)
 * @returns unique hex color
 */
export function deriveColorFromEmoji(
  emoji: string,
  existingColors: string[],
  threshold: number = 15
): string {
  const base = extractDominantColor(emoji);
  return resolveColorConflict(base, existingColors, threshold);
}
