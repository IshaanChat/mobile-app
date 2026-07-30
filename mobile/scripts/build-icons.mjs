/**
 * Build the iOS icon and splash assets from the brand artwork.
 *
 *   node scripts/build-icons.mjs
 *
 * Source: assets/brand/logo.png — the composed square as supplied, 1254x1254,
 * a lavender V on a near-black rounded rectangle with a light border.
 *
 * Why this exists rather than dropping the artwork in as-is:
 *
 *   1. The supplied square has a rounded rectangle and a border baked in. iOS
 *      applies its own squircle mask, so shipping it would round the corners a
 *      SECOND time — clipping inside the existing radius and slicing the border
 *      off all four edges. Icons must be full-bleed: background to every edge,
 *      no radius of their own.
 *   2. App Store icons must have no alpha channel at all. (The source happens
 *      to be fully opaque already, but the output is written as RGB regardless
 *      so this cannot regress.)
 *   3. The splash needs the V *alone* on a transparent background, so it can be
 *      composited over the splash colour at whatever size, rather than being a
 *      pre-composed square with visible edges.
 *
 * Outputs:
 *   assets/images/icon.png         1024x1024, full-bleed, opaque
 *   assets/images/splash-icon.png  1024x1024, V only, transparent
 *
 * Android is deliberately not built — the project is iOS-only.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { PNG } from 'pngjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');

const SRC = join(ROOT, 'assets/brand/logo.png');
const OUT_ICON = join(ROOT, 'assets/images/icon.png');
const OUT_SPLASH = join(ROOT, 'assets/images/splash-icon.png');

const SIZE = 1024;

/** Sampled from the source, not chosen. See src/constants/theme.ts. */
const BG = [0x12, 0x0e, 0x1b];

const src = PNG.sync.read(readFileSync(SRC));
const lum = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

/**
 * Which source pixels are *outside* the artwork's dark ground.
 *
 * A uniform inset does not work, and the first version of this script was wrong
 * for exactly that reason: the border is a thin stroke, so measuring inward
 * along the middle row suggests ~13px — but at the corners the rounded radius
 * pushes the near-white hundreds of pixels in. Cropping 16px left the rim and
 * all four white corners intact.
 *
 * So: flood fill inward from every edge pixel, travelling only through light
 * pixels. That crosses the white margin and the pale border, then stops dead at
 * the dark ground. The V never touches the frame, so it cannot be reached and
 * cannot be damaged — which is what makes this safe where a brightness
 * threshold alone would eat the mark.
 *
 * Then dilate by a few pixels to swallow the antialiased seam between border
 * and ground, which is mid-luminance and would otherwise survive as a fringe.
 */
function outsideMask(image, lightAbove = 55, dilate = 3) {
  const { width: W, height: H, data } = image;
  const out = new Uint8Array(W * H);
  const stack = [];
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const k = y * W + x;
    if (out[k]) return;
    const i = k * 4;
    if (lum(data[i], data[i + 1], data[i + 2]) <= lightAbove) return;
    out[k] = 1;
    stack.push(x, y);
  };
  for (let x = 0; x < W; x++) {
    push(x, 0);
    push(x, H - 1);
  }
  for (let y = 0; y < H; y++) {
    push(0, y);
    push(W - 1, y);
  }
  while (stack.length) {
    const y = stack.pop();
    const x = stack.pop();
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }
  for (let pass = 0; pass < dilate; pass++) {
    const grown = out.slice();
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (out[y * W + x]) continue;
        if (
          (x > 0 && out[y * W + x - 1]) ||
          (x < W - 1 && out[y * W + x + 1]) ||
          (y > 0 && out[(y - 1) * W + x]) ||
          (y < H - 1 && out[(y + 1) * W + x])
        ) {
          grown[y * W + x] = 1;
        }
      }
    }
    out.set(grown);
  }
  return out;
}

const OUTSIDE = outsideMask(src);

/**
 * Bilinear sample of the source, with every outside-the-artwork pixel treated
 * as the flat brand background. Doing the substitution here rather than after
 * scaling matters: interpolating across the border first would smear pale
 * values inward and leave a halo that no amount of later filling removes.
 */
function sample(x, y) {
  const x0 = Math.max(0, Math.min(src.width - 1, Math.floor(x)));
  const y0 = Math.max(0, Math.min(src.height - 1, Math.floor(y)));
  const x1 = Math.min(src.width - 1, x0 + 1);
  const y1 = Math.min(src.height - 1, y0 + 1);
  const fx = x - x0;
  const fy = y - y0;
  const px = (xx, yy) => {
    if (OUTSIDE[yy * src.width + xx]) return BG;
    const i = (yy * src.width + xx) * 4;
    return [src.data[i], src.data[i + 1], src.data[i + 2]];
  };
  const a = px(x0, y0);
  const b = px(x1, y0);
  const c = px(x0, y1);
  const d = px(x1, y1);
  return [0, 1, 2].map((k) => {
    const top = a[k] + (b[k] - a[k]) * fx;
    const bot = c[k] + (d[k] - c[k]) * fx;
    return top + (bot - top) * fy;
  });
}

/**
 * A small inset is still taken, but only to trim the outermost row or two where
 * the dilated mask meets the frame — not to remove the border, which the mask
 * already handled.
 */
const INSET = 4;
const inner = { x: INSET, y: INSET, w: src.width - INSET * 2, h: src.height - INSET * 2 };

// ---- the icon: opaque, full-bleed -----------------------------------------
const icon = new PNG({ width: SIZE, height: SIZE, colorType: 2 }); // 2 = RGB, no alpha
for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    const [r, g, b] = sample(inner.x + (x / SIZE) * inner.w, inner.y + (y / SIZE) * inner.h);
    const i = (y * SIZE + x) * 4;
    icon.data[i] = Math.round(r);
    icon.data[i + 1] = Math.round(g);
    icon.data[i + 2] = Math.round(b);
    icon.data[i + 3] = 255;
  }
}
writeFileSync(OUT_ICON, PNG.sync.write(icon, { colorType: 2 }));

// ---- the splash mark: the V alone, transparent ----------------------------
//
// The V is light on a near-black ground, so brightness *is* the mask. Using the
// normalised brightness as alpha rather than a hard threshold keeps the tapered
// tips smooth — a binary cut leaves them visibly jagged, and those points are
// the most recognisable part of the mark.
//
// Colour is forced to the flat brand lavender instead of carrying the source's
// gradient: the source's shading reads as depth against its own dark square and
// as dirt against anything else.
const LAV = [0xd0, 0xb8, 0xf0];
const FLOOR = lum(...BG) + 6; // just above the background's own noise
const CEIL = 200; // where the V is unambiguously itself

const splash = new PNG({ width: SIZE, height: SIZE });
for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    const [r, g, b] = sample(inner.x + (x / SIZE) * inner.w, inner.y + (y / SIZE) * inner.h);
    const l = lum(r, g, b);
    const a = Math.max(0, Math.min(1, (l - FLOOR) / (CEIL - FLOOR)));
    const i = (y * SIZE + x) * 4;
    splash.data[i] = LAV[0];
    splash.data[i + 1] = LAV[1];
    splash.data[i + 2] = LAV[2];
    splash.data[i + 3] = Math.round(a * 255);
  }
}
writeFileSync(OUT_SPLASH, PNG.sync.write(splash));

// ---- report ---------------------------------------------------------------
function describe(path) {
  const p = PNG.sync.read(readFileSync(path));
  let nonOpaque = 0;
  for (let i = 3; i < p.data.length; i += 4) if (p.data[i] < 255) nonOpaque++;
  return `${p.width}x${p.height}  colorType=${p.colorType}  non-opaque=${(
    (100 * nonOpaque) / (p.width * p.height)
  ).toFixed(1)}%`;
}
console.log(`source        ${src.width}x${src.height}`);
console.log(`icon.png      ${describe(OUT_ICON)}   <- must be 0.0% non-opaque`);
console.log(`splash-icon   ${describe(OUT_SPLASH)}`);
