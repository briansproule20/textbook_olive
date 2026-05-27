#!/usr/bin/env node
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

const RAW_DIR = path.join(ROOT, "assets/raw");
const WALKS_DIR = path.join(RAW_DIR, "walks");
const OUT_ROOT = path.join(ROOT, "public/sprites");

const RAW_TILES = path.join(RAW_DIR, "tiles.png");
const CHARACTERS = [
  "poncho",
  "cat",
  "aussie",
  "collie",
  "penguin",
  "black-lab",
  "yellow-lab",
  "brown-lab",
  "pug",
  "pug-beagle",
  "wiener",
  "brown-tabby",
  "orange-tabby",
];

const TILE_NAMES = ["grass", "grass2", "dirt", "rock"];
const TILE_W = 128;
const TILE_H = 64;

const CHAR_FRAME = 256;
const CHAR_INNER = 220;
const CHAR_BASELINE_Y = 246;
const CHAR_ROWS = 4;
const CHAR_COLS = 4;
const CHAR_TARGET_HEIGHT = 200;

// Only generate unique source frames per character. SW/NW are produced at
// runtime by Phaser flipX, so the atlas is half the size and SE/SW are
// guaranteed to have identical pixel data (just mirrored). Same for NE/NW.
const ANIMATIONS = [
  { key: "idle_se",   source: { kind: "still", strip: "se" }, offsets: [0, -1, -2, -1], loop: true },
  { key: "walk_se",   source: { kind: "walk",  strip: "se" }, offsets: [0, 0, 0, 0],     loop: true },
  { key: "walk_ne",   source: { kind: "walk",  strip: "ne" }, offsets: [0, 0, 0, 0],     loop: true },
  { key: "attack_se", source: { kind: "still", strip: "se" }, offsets: [0, 0, 0, 0],     loop: false },
];

// Walk strips are 2x2 grids. Quadrant → walk frame index.
const STRIP_QUADRANTS = [
  { col: 0, row: 0 }, // frame 0
  { col: 1, row: 0 }, // frame 1
  { col: 0, row: 1 }, // frame 2
  { col: 1, row: 1 }, // frame 3
];

const BG_THRESHOLD = 232;
const BG_SOFT_PASSES = [215, 200, 185, 170, 155, 140];

async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function readPng(p) {
  const buf = await fs.readFile(p);
  return PNG.sync.read(buf);
}

function looksLikeBg(r, g, b, a, threshold) {
  if (a < 16) return true;
  return r >= threshold && g >= threshold && b >= threshold;
}

function buildBgMask(src) {
  const { width: w, height: h } = src;
  const mask = new Uint8Array(w * h);
  const queue = [];
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const idx = y * w + x;
    if (mask[idx]) return;
    const i = idx * 4;
    if (!looksLikeBg(src.data[i], src.data[i + 1], src.data[i + 2], src.data[i + 3], BG_THRESHOLD)) return;
    mask[idx] = 1;
    queue.push(idx);
  };
  for (let x = 0; x < w; x++) {
    push(x, 0);
    push(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    push(0, y);
    push(w - 1, y);
  }
  while (queue.length) {
    const idx = queue.pop();
    const x = idx % w;
    const y = (idx - x) / w;
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }
  // Iterative soft expansion: each pass marks pixels adjacent to current bg
  // that pass a progressively lower lightness threshold. This eats anti-aliased
  // rims and soft dropshadows without consuming high-contrast interior detail
  // (eye whites, blaze, highlights) that isn't connected to the bg gradient.
  let current = mask;
  for (const threshold of BG_SOFT_PASSES) {
    const next = new Uint8Array(current);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        if (current[idx]) continue;
        const i = idx * 4;
        if (!looksLikeBg(src.data[i], src.data[i + 1], src.data[i + 2], src.data[i + 3], threshold)) continue;
        const neighbors =
          (x > 0 && current[idx - 1]) ||
          (x < w - 1 && current[idx + 1]) ||
          (y > 0 && current[idx - w]) ||
          (y < h - 1 && current[idx + w]);
        if (neighbors) next[idx] = 1;
      }
    }
    current = next;
  }

  // Find interior enclosed pockets of unmarked pixels. If a connected component
  // does NOT touch the image edge AND its average color is near-white (looks
  // like the AI's background bleeding through gaps in the character — like the
  // space between a cat's legs), mark the whole component as background.
  // Color check keeps colorful interior shapes (eyes, mouth, markings) opaque.
  const visited = new Uint8Array(w * h);
  const final = new Uint8Array(current);
  const stack = new Int32Array(w * h);
  const comp = new Int32Array(w * h);
  for (let startY = 0; startY < h; startY++) {
    for (let startX = 0; startX < w; startX++) {
      const startIdx = startY * w + startX;
      if (current[startIdx] || visited[startIdx]) continue;
      let top = 0;
      let compLen = 0;
      stack[top++] = startIdx;
      visited[startIdx] = 1;
      let touchesEdge = false;
      let sumR = 0, sumG = 0, sumB = 0, sumMin = 0;
      let brightCount = 0;
      while (top > 0) {
        const idx = stack[--top];
        comp[compLen++] = idx;
        const x = idx % w;
        const y = (idx - x) / w;
        if (x === 0 || y === 0 || x === w - 1 || y === h - 1) touchesEdge = true;
        const i = idx * 4;
        sumR += src.data[i];
        sumG += src.data[i + 1];
        sumB += src.data[i + 2];
        const minRGB = Math.min(src.data[i], src.data[i + 1], src.data[i + 2]);
        sumMin += minRGB;
        if (minRGB >= 220) brightCount += 1;
        const neighbors = [idx - 1, idx + 1, idx - w, idx + w];
        const xs = [x - 1, x + 1, x, x];
        const ys = [y, y, y - 1, y + 1];
        for (let k = 0; k < 4; k++) {
          const nx = xs[k];
          const ny = ys[k];
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const nIdx = neighbors[k];
          if (visited[nIdx] || current[nIdx]) continue;
          visited[nIdx] = 1;
          stack[top++] = nIdx;
        }
      }
      if (touchesEdge) continue;
      const avgMin = sumMin / compLen;
      const brightFrac = brightCount / compLen;
      // A near-white interior pocket is either:
      //   (a) small and mostly bright — typical "white gap between cat legs",
      //   (b) any size but VERY pure white — pure bg leakage,
      //   (c) modest size with a majority of pixels in the bright range.
      // Larger components are mostly real character markings (aussie blaze /
      // chest / penguin belly) and stay opaque.
      const isPocket =
        (compLen < 250 && avgMin >= 180) ||
        avgMin >= 235 ||
        (compLen < 600 && brightFrac >= 0.75);
      if (!isPocket) continue;
      for (let i = 0; i < compLen; i++) final[comp[i]] = 1;
    }
  }

  // Two-stage cleanup of remaining interior bg leakage:
  //
  // Stage 1: mark any unmarked pixel whose color is essentially pure white
  // (>=250) as background. This catches isolated white pockets the connected-
  // component pass missed because anti-aliased rim pixels bridged the pocket
  // to the character body, making the whole thing read as one component.
  //
  // Stage 2: erosion-style edge expansion. Anti-aliased pixels just inside
  // a pure-white pocket sit at ~235-249 brightness. Repeatedly mark any
  // unmarked pixel adjacent to an already-marked bg pixel if its min(RGB)
  // is >= 225. This eats the soft sliver around the pocket without touching
  // mid-bright character pixels (cat fur, copper trim, etc.).
  for (let i = 0; i < w * h; i++) {
    if (final[i]) continue;
    const j = i * 4;
    if (Math.min(src.data[j], src.data[j + 1], src.data[j + 2]) >= 250) final[i] = 1;
  }
  for (let pass = 0; pass < 3; pass++) {
    const before = new Uint8Array(final);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        if (before[idx]) continue;
        const j = idx * 4;
        if (Math.min(src.data[j], src.data[j + 1], src.data[j + 2]) < 225) continue;
        const hasMarked =
          (x > 0 && before[idx - 1]) ||
          (x < w - 1 && before[idx + 1]) ||
          (y > 0 && before[idx - w]) ||
          (y < h - 1 && before[idx + w]);
        if (hasMarked) final[idx] = 1;
      }
    }
  }

  return final;
}

function getPx(src, x, y) {
  const i = (y * src.width + x) * 4;
  return [src.data[i], src.data[i + 1], src.data[i + 2], src.data[i + 3]];
}

function setPx(dst, x, y, r, g, b, a) {
  if (x < 0 || y < 0 || x >= dst.width || y >= dst.height) return;
  const i = (y * dst.width + x) * 4;
  dst.data[i] = r;
  dst.data[i + 1] = g;
  dst.data[i + 2] = b;
  dst.data[i + 3] = a;
}

function bboxInQuadrant(src, mask, qx, qy, qw, qh) {
  let minX = qw, minY = qh, maxX = -1, maxY = -1;
  for (let y = 0; y < qh; y++) {
    for (let x = 0; x < qw; x++) {
      const mi = (qy + y) * src.width + (qx + x);
      if (mask[mi]) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return null;
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

function extractCrop(src, mask, qx, qy, bbox) {
  const out = new PNG({ width: bbox.w, height: bbox.h });
  for (let y = 0; y < bbox.h; y++) {
    for (let x = 0; x < bbox.w; x++) {
      const sx = qx + bbox.x + x;
      const sy = qy + bbox.y + y;
      const mi = sy * src.width + sx;
      const di = (y * out.width + x) * 4;
      const si = mi * 4;
      if (mask[mi]) {
        out.data[di] = 0;
        out.data[di + 1] = 0;
        out.data[di + 2] = 0;
        out.data[di + 3] = 0;
      } else {
        out.data[di] = src.data[si];
        out.data[di + 1] = src.data[si + 1];
        out.data[di + 2] = src.data[si + 2];
        out.data[di + 3] = 255;
      }
    }
  }
  return out;
}

// Downscale src to fit within maxW x maxH preserving aspect using a box-average filter.
function downscaleFit(src, maxW, maxH) {
  const scale = Math.min(maxW / src.width, maxH / src.height, 1);
  const dw = Math.max(1, Math.round(src.width * scale));
  const dh = Math.max(1, Math.round(src.height * scale));
  const out = new PNG({ width: dw, height: dh });
  for (let y = 0; y < dh; y++) {
    const sy0 = Math.floor((y * src.height) / dh);
    const sy1 = Math.max(sy0 + 1, Math.floor(((y + 1) * src.height) / dh));
    for (let x = 0; x < dw; x++) {
      const sx0 = Math.floor((x * src.width) / dw);
      const sx1 = Math.max(sx0 + 1, Math.floor(((x + 1) * src.width) / dw));
      let r = 0, g = 0, b = 0, a = 0, ar = 0, count = 0;
      for (let yy = sy0; yy < sy1 && yy < src.height; yy++) {
        for (let xx = sx0; xx < sx1 && xx < src.width; xx++) {
          const i = (yy * src.width + xx) * 4;
          const sa = src.data[i + 3];
          r += src.data[i] * sa;
          g += src.data[i + 1] * sa;
          b += src.data[i + 2] * sa;
          a += sa;
          ar += 1;
          count += sa;
        }
      }
      const di = (y * dw + x) * 4;
      if (ar === 0 || count === 0) {
        out.data[di] = 0;
        out.data[di + 1] = 0;
        out.data[di + 2] = 0;
        out.data[di + 3] = 0;
      } else {
        out.data[di] = Math.round(r / count);
        out.data[di + 1] = Math.round(g / count);
        out.data[di + 2] = Math.round(b / count);
        out.data[di + 3] = Math.round(a / ar);
      }
    }
  }
  return out;
}

// Downscale src to exact target dimensions (stretches aspect if needed),
// using box-average sampling. Used for tiles where every tile must be the
// same diamond size so they tile edge-to-edge without visual elevation steps.
function downscaleExact(src, dw, dh) {
  const out = new PNG({ width: dw, height: dh });
  for (let y = 0; y < dh; y++) {
    const sy0 = Math.floor((y * src.height) / dh);
    const sy1 = Math.max(sy0 + 1, Math.floor(((y + 1) * src.height) / dh));
    for (let x = 0; x < dw; x++) {
      const sx0 = Math.floor((x * src.width) / dw);
      const sx1 = Math.max(sx0 + 1, Math.floor(((x + 1) * src.width) / dw));
      let r = 0, g = 0, b = 0, a = 0, ar = 0, count = 0;
      for (let yy = sy0; yy < sy1 && yy < src.height; yy++) {
        for (let xx = sx0; xx < sx1 && xx < src.width; xx++) {
          const i = (yy * src.width + xx) * 4;
          const sa = src.data[i + 3];
          r += src.data[i] * sa;
          g += src.data[i + 1] * sa;
          b += src.data[i + 2] * sa;
          a += sa;
          ar += 1;
          count += sa;
        }
      }
      const di = (y * dw + x) * 4;
      if (ar === 0 || count === 0) {
        out.data[di] = 0; out.data[di + 1] = 0; out.data[di + 2] = 0; out.data[di + 3] = 0;
      } else {
        out.data[di] = Math.round(r / count);
        out.data[di + 1] = Math.round(g / count);
        out.data[di + 2] = Math.round(b / count);
        out.data[di + 3] = Math.round(a / ar);
      }
    }
  }
  return out;
}

// Force a tile image to a mathematically exact 2:1 diamond shape. Pixels
// outside the diamond inscribed in the rectangle are set to fully transparent
// so adjacent tiles tile pixel-perfectly without sub-pixel seams or overlap.
function clipToDiamond(img) {
  const w = img.width;
  const h = img.height;
  // Use w/2 and h/2 as BOTH center and half-extent so the diamond edge falls
  // on pixel-perfect positions that adjacent tiles share. Inclusive boundary
  // (<= 1) means two neighbors overlap exactly at the shared edge with no gap.
  const cx = w / 2;
  const cy = h / 2;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      // Sample at pixel center (x+0.5, y+0.5).
      const dx = Math.abs(x + 0.5 - cx) / (w / 2);
      const dy = Math.abs(y + 0.5 - cy) / (h / 2);
      if (dx + dy > 1) {
        img.data[i] = 0;
        img.data[i + 1] = 0;
        img.data[i + 2] = 0;
        img.data[i + 3] = 0;
      } else {
        img.data[i + 3] = 255;
      }
    }
  }
}

// AI-painted tiles include cel-shading: a darker rim along the diamond edges
// that creates visible grid lines / drop shadows when many tiles are tiled
// together across a map. This pass equalizes brightness in two phases:
//   - GLOBAL lift: any opaque pixel darker than ~85% of interior median gets
//     scaled up to ~92% (preserves bulk texture variation).
//   - EDGE FLATTEN: pixels near the diamond perimeter (the dark outline ring)
//     get pushed all the way to the interior median, with their hue preserved
//     by blending toward the median COLOR. This removes the per-tile shadow
//     line so tiled grass reads as a continuous flat plane.
function flattenTileLighting(img) {
  const w = img.width;
  const h = img.height;
  const interiorLums = [];
  let sumR = 0, sumG = 0, sumB = 0, count = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (img.data[i + 3] < 128) continue;
      const dx = Math.abs(x + 0.5 - w / 2) / (w / 2);
      const dy = Math.abs(y + 0.5 - h / 2) / (h / 2);
      if (dx + dy > 0.5) continue;
      interiorLums.push((img.data[i] + img.data[i + 1] + img.data[i + 2]) / 3);
      sumR += img.data[i];
      sumG += img.data[i + 1];
      sumB += img.data[i + 2];
      count += 1;
    }
  }
  if (count === 0) return;
  interiorLums.sort((a, b) => a - b);
  const median = interiorLums[Math.floor(interiorLums.length / 2)];
  const meanR = sumR / count;
  const meanG = sumG / count;
  const meanB = sumB / count;
  const targetMin = median * 0.92;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (img.data[i + 3] < 128) continue;
      const dx = Math.abs(x + 0.5 - w / 2) / (w / 2);
      const dy = Math.abs(y + 0.5 - h / 2) / (h / 2);
      const edgeT = dx + dy;
      const lum = (img.data[i] + img.data[i + 1] + img.data[i + 2]) / 3;

      // Edge band: replace the painted dark rim with the interior MEAN color
      // so adjacent tiles meet with identical brightness, eliminating grid
      // lines/drop shadows. The band starts at 50% from center and ramps to
      // FULL replacement (t=1) at the diamond perimeter.
      if (edgeT > 0.5) {
        const t = Math.min(1, (edgeT - 0.5) / 0.5);
        img.data[i]     = Math.round(img.data[i]     * (1 - t) + meanR * t);
        img.data[i + 1] = Math.round(img.data[i + 1] * (1 - t) + meanG * t);
        img.data[i + 2] = Math.round(img.data[i + 2] * (1 - t) + meanB * t);
        continue;
      }

      // Interior: just lift very dark pixels a little so the bulk texture
      // variation stays but the AI's painted shading doesn't dominate.
      if (lum >= targetMin) continue;
      const scale = targetMin / Math.max(1, lum);
      img.data[i] = Math.min(255, Math.round(img.data[i] * scale));
      img.data[i + 1] = Math.min(255, Math.round(img.data[i + 1] * scale));
      img.data[i + 2] = Math.min(255, Math.round(img.data[i + 2] * scale));
    }
  }
}

function flipHorizontal(src) {
  const out = new PNG({ width: src.width, height: src.height });
  for (let y = 0; y < src.height; y++) {
    for (let x = 0; x < src.width; x++) {
      const si = (y * src.width + (src.width - 1 - x)) * 4;
      const di = (y * src.width + x) * 4;
      out.data[di] = src.data[si];
      out.data[di + 1] = src.data[si + 1];
      out.data[di + 2] = src.data[si + 2];
      out.data[di + 3] = src.data[si + 3];
    }
  }
  return out;
}

function blit(dst, src, dx, dy) {
  for (let y = 0; y < src.height; y++) {
    for (let x = 0; x < src.width; x++) {
      const si = (y * src.width + x) * 4;
      const a = src.data[si + 3];
      if (a === 0) continue;
      setPx(dst, dx + x, dy + y, src.data[si], src.data[si + 1], src.data[si + 2], a);
    }
  }
}

async function writePng(png, outPath) {
  await new Promise((resolve, reject) => {
    const chunks = [];
    png
      .pack()
      .on("data", (c) => chunks.push(c))
      .on("end", async () => {
        try {
          await fs.writeFile(outPath, Buffer.concat(chunks));
          resolve();
        } catch (e) {
          reject(e);
        }
      })
      .on("error", reject);
  });
}

function emptyPng(w, h) {
  const p = new PNG({ width: w, height: h });
  p.data.fill(0);
  return p;
}

async function prepareTiles() {
  const src = await readPng(RAW_TILES);
  if (src.width !== 1024 || src.height !== 1024) {
    throw new Error(`tiles.png must be 1024x1024, got ${src.width}x${src.height}`);
  }
  const mask = buildBgMask(src);
  const quadrants = [
    { name: "grass", qx: 0, qy: 0 },
    { name: "dirt", qx: 512, qy: 0 },
    { name: "grass2", qx: 0, qy: 512 },
    { name: "rock", qx: 512, qy: 512 },
  ];

  const sheet = emptyPng(TILE_W * 4, TILE_H);
  const frames = {};
  const sizes = [];
  const standaloneTiles = [];

  for (let idx = 0; idx < quadrants.length; idx++) {
    const q = quadrants[idx];
    const bbox = bboxInQuadrant(src, mask, q.qx, q.qy, 512, 512);
    if (!bbox) throw new Error(`empty quadrant for tile ${q.name}`);
    const cropped = extractCrop(src, mask, q.qx, q.qy, bbox);
    const scaled = downscaleExact(cropped, TILE_W, TILE_H);
    clipToDiamond(scaled);
    flattenTileLighting(scaled);
    const cellX = idx * TILE_W;
    blit(sheet, scaled, cellX, 0);
    frames[q.name] = {
      frame: { x: cellX, y: 0, w: TILE_W, h: TILE_H },
      rotated: false,
      trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w: TILE_W, h: TILE_H },
      sourceSize: { w: TILE_W, h: TILE_H },
    };
    sizes.push({ name: q.name, scaled: { w: scaled.width, h: scaled.height } });
    standaloneTiles.push({ name: q.name, png: scaled });
  }

  const outDir = path.join(OUT_ROOT, "tiles");
  await fs.mkdir(outDir, { recursive: true });
  // Standalone single-tile PNGs (grass.png, dirt.png, etc.) so the welcome
  // screen can use them as a repeating CSS background without needing to
  // slice the atlas at runtime.
  for (const { name, png } of standaloneTiles) {
    await writePng(png, path.join(outDir, `${name}.png`));
  }
  const outPng = path.join(outDir, "tiles.png");
  const outJson = path.join(outDir, "tiles.json");
  const outManifest = path.join(outDir, "manifest.json");
  await writePng(sheet, outPng);
  await fs.writeFile(
    outJson,
    JSON.stringify(
      {
        frames,
        meta: {
          app: "prepare-assets",
          image: "tiles.png",
          format: "RGBA8888",
          size: { w: sheet.width, h: sheet.height },
          scale: "1",
        },
      },
      null,
      2
    )
  );
  await fs.writeFile(
    outManifest,
    JSON.stringify(
      {
        source: path.relative(ROOT, RAW_TILES),
        output: { png: path.relative(ROOT, outPng), json: path.relative(ROOT, outJson) },
        tiles: TILE_NAMES,
        generated_at: new Date().toISOString(),
      },
      null,
      2
    )
  );

  return { outPng, outJson, sheetW: sheet.width, sheetH: sheet.height, sizes };
}

// Load a 2x2 walk strip (1024x1024 PNG) and return 4 cropped raw images + bboxes.
// Cells are NOT yet scaled — scaling happens after we know the global max bbox
// across the whole character so every frame uses the same scale factor and the
// character doesn't change size when walking or turning.
async function loadWalkStripRaw(stripPath, label) {
  const src = await readPng(stripPath);
  if (src.width !== 1024 || src.height !== 1024) {
    throw new Error(`${label} must be 1024x1024, got ${src.width}x${src.height}`);
  }
  const mask = buildBgMask(src);
  const crops = [];
  for (let i = 0; i < STRIP_QUADRANTS.length; i++) {
    const { col, row } = STRIP_QUADRANTS[i];
    const qx = col * 512;
    const qy = row * 512;
    const bbox = bboxInQuadrant(src, mask, qx, qy, 512, 512);
    if (!bbox) throw new Error(`empty quadrant ${i} for ${label}`);
    const cropped = extractCrop(src, mask, qx, qy, bbox);
    crops.push(cropped);
  }
  return crops;
}

function bakeCellsAtScale(crops, scale) {
  return crops.map((cropped) => {
    const dw = Math.max(1, Math.round(cropped.width * scale));
    const dh = Math.max(1, Math.round(cropped.height * scale));
    const scaled = downscaleExact(cropped, dw, dh);
    const cell = emptyPng(CHAR_FRAME, CHAR_FRAME);
    const dx = Math.floor((CHAR_FRAME - scaled.width) / 2);
    const dy = CHAR_BASELINE_Y - scaled.height;
    blit(cell, scaled, dx, dy);
    return cell;
  });
}

async function prepareCharacter(charId) {
  const walkDir = path.join(WALKS_DIR, charId);
  const sePath = path.join(walkDir, "se.png");
  const nePath = path.join(walkDir, "ne.png");
  if (!(await exists(sePath))) throw new Error(`missing walk strip: assets/raw/walks/${charId}/se.png`);
  if (!(await exists(nePath))) throw new Error(`missing walk strip: assets/raw/walks/${charId}/ne.png`);

  const rawCrops = {
    se: await loadWalkStripRaw(sePath, `walks/${charId}/se.png`),
    ne: await loadWalkStripRaw(nePath, `walks/${charId}/ne.png`),
  };

  // One global scale per character normalizing the character's CANONICAL
  // BOUNDING BOX (max of width/height across ALL frames in both directions)
  // to CHAR_TARGET_HEIGHT. This makes character-vs-character sizes comparable:
  // a chunky wide penguin fits the same 200x200 box as a tall slender dog,
  // and within a character SE and NE use the same scale so there is no
  // size jump when the player turns.
  const allCrops = [...rawCrops.se, ...rawCrops.ne];
  const globalMaxDim = Math.max(...allCrops.map((c) => Math.max(c.width, c.height)));
  const scale = Math.min(CHAR_TARGET_HEIGHT / globalMaxDim, 1);

  const strips = {
    se: bakeCellsAtScale(rawCrops.se, scale),
    ne: bakeCellsAtScale(rawCrops.ne, scale),
  };

  const sheetW = CHAR_COLS * CHAR_FRAME;
  const sheetH = CHAR_ROWS * CHAR_FRAME;
  const sheet = emptyPng(sheetW, sheetH);
  const frames = {};

  for (let r = 0; r < ANIMATIONS.length; r++) {
    const anim = ANIMATIONS[r];
    const stripCells = strips[anim.source.strip];
    for (let c = 0; c < CHAR_COLS; c++) {
      const base = anim.source.kind === "walk" ? stripCells[c] : stripCells[0];
      const dx = c * CHAR_FRAME;
      const dy = r * CHAR_FRAME;
      const yShift = anim.offsets[c];
      blit(sheet, base, dx, dy + yShift);
      const name = `${anim.key}_${String(c).padStart(2, "0")}`;
      frames[name] = {
        frame: { x: dx, y: dy, w: CHAR_FRAME, h: CHAR_FRAME },
        rotated: false,
        trimmed: false,
        spriteSourceSize: { x: 0, y: 0, w: CHAR_FRAME, h: CHAR_FRAME },
        sourceSize: { w: CHAR_FRAME, h: CHAR_FRAME },
      };
    }
  }

  const outDir = path.join(OUT_ROOT, "characters", charId);
  await fs.mkdir(outDir, { recursive: true });
  const outPng = path.join(outDir, `${charId}.png`);
  const outJson = path.join(outDir, `${charId}.json`);
  await writePng(sheet, outPng);
  await fs.writeFile(
    outJson,
    JSON.stringify(
      {
        frames,
        meta: {
          app: "prepare-assets",
          image: `${charId}.png`,
          format: "RGBA8888",
          size: { w: sheetW, h: sheetH },
          scale: "1",
        },
      },
      null,
      2
    )
  );

  return { outPng, outJson, sheetW, sheetH, frameCount: Object.keys(frames).length };
}

async function main() {
  const missing = [];
  if (!(await exists(RAW_TILES))) missing.push("assets/raw/tiles.png");
  for (const id of CHARACTERS) {
    const seP = path.join(WALKS_DIR, id, "se.png");
    const neP = path.join(WALKS_DIR, id, "ne.png");
    if (!(await exists(seP))) missing.push(`assets/raw/walks/${id}/se.png`);
    if (!(await exists(neP))) missing.push(`assets/raw/walks/${id}/ne.png`);
  }
  if (missing.length) {
    console.error(`[prep] missing required raw assets:\n  ${missing.join("\n  ")}`);
    process.exit(1);
  }

  await fs.mkdir(OUT_ROOT, { recursive: true });

  console.log("[prep] tiles...");
  const tileResult = await prepareTiles();
  console.log(`[prep] tiles sheet: ${tileResult.sheetW}x${tileResult.sheetH}`);
  for (const s of tileResult.sizes) {
    console.log(`        ${s.name}: scaled ${s.scaled.w}x${s.scaled.h}`);
  }

  const charResults = {};
  for (const id of CHARACTERS) {
    console.log(`[prep] character ${id}...`);
    const res = await prepareCharacter(id);
    console.log(`        sheet: ${res.sheetW}x${res.sheetH}, frames: ${res.frameCount}`);
    console.log(`        png:  ${path.relative(ROOT, res.outPng)}`);
    console.log(`        json: ${path.relative(ROOT, res.outJson)}`);
    charResults[id] = res;
  }

  // Static object sprites (trees, etc.) — copy raw assets directly to public/.
  // No frame/animation processing; the game loads them as plain Image textures.
  const objectsRawDir = path.join(RAW_DIR, "objects");
  const objectsOutDir = path.join(OUT_ROOT, "objects");
  if (await exists(objectsRawDir)) {
    await fs.mkdir(objectsOutDir, { recursive: true });
    const objectFiles = await fs.readdir(objectsRawDir);
    for (const fname of objectFiles) {
      if (!fname.toLowerCase().endsWith(".png")) continue;
      const srcPath = path.join(objectsRawDir, fname);
      const destPath = path.join(objectsOutDir, fname);
      // Reuse the character bg-mask pass to strip near-white / faintly-alpha
      // backgrounds that GPT-Image-2 sometimes leaves behind. This also clears
      // soft anti-aliased rim pixels so the object reads as a clean cutout.
      const srcPng = await readPng(srcPath);
      const mask = buildBgMask(srcPng);
      const cleaned = emptyPng(srcPng.width, srcPng.height);
      cleaned.data.set(srcPng.data);
      for (let i = 0; i < mask.length; i++) {
        if (mask[i]) {
          const j = i * 4;
          cleaned.data[j] = 0;
          cleaned.data[j + 1] = 0;
          cleaned.data[j + 2] = 0;
          cleaned.data[j + 3] = 0;
        }
      }
      await writePng(cleaned, destPath);
      console.log(`[prep] object: ${path.relative(ROOT, destPath)} (bg-cleaned)`);
    }
  }

  const topManifest = {
    tiles: TILE_NAMES,
    characters: CHARACTERS,
    animations: ANIMATIONS.map((a) => ({ key: a.key, frames: CHAR_COLS, loop: a.loop })),
    generated_at: new Date().toISOString(),
  };
  const topManifestPath = path.join(OUT_ROOT, "manifest.json");
  await fs.writeFile(topManifestPath, JSON.stringify(topManifest, null, 2));
  console.log(`[prep] manifest: ${path.relative(ROOT, topManifestPath)}`);
  console.log("[prep] done.");
}

main().catch((err) => {
  console.error("[prep] failed:", err);
  process.exit(1);
});
