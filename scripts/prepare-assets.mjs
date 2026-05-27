#!/usr/bin/env node
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

const RAW_DIR = path.join(ROOT, "assets/raw");
const OUT_ROOT = path.join(ROOT, "public/sprites");

const RAW_TILES = path.join(RAW_DIR, "tiles.png");
const RAW_CAT = path.join(RAW_DIR, "cat.png");
const RAW_AUSSIE = path.join(RAW_DIR, "aussie.png");

const TILE_NAMES = ["grass", "dirt", "sand", "farm"];
const TILE_CELL = 128;
const TILE_MAX = 128;

const CHAR_FRAME = 256;
const CHAR_INNER = 220;
const CHAR_BASELINE_Y = 246;
const CHAR_ROWS = 7;
const CHAR_COLS = 4;

const ANIMATIONS = [
  { key: "idle_se", facing: "se", bob: false, loop: true },
  { key: "walk_se", facing: "se", bob: true, loop: true },
  { key: "walk_sw", facing: "sw", bob: true, loop: true },
  { key: "walk_ne", facing: "ne", bob: true, loop: true },
  { key: "walk_nw", facing: "nw", bob: true, loop: true },
  { key: "attack_se", facing: "se", bob: false, loop: false },
  { key: "attack_sw", facing: "sw", bob: false, loop: false },
];

// Quadrant -> facing mapping per spec.
// TL = se, TR = sw, BL = ne, BR = nw
const QUADRANT_FACING = {
  se: { col: 0, row: 0 },
  sw: { col: 1, row: 0 },
  ne: { col: 0, row: 1 },
  nw: { col: 1, row: 1 },
};

const BG_THRESHOLD = 232;
const BG_EDGE_SOFT = 200;

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
  // soft edge pass: pixels adjacent to bg that are also near-white get marked,
  // smoothing rim anti-aliasing without eating interior highlights.
  const soft = new Uint8Array(mask);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      if (mask[idx]) continue;
      const i = idx * 4;
      if (!looksLikeBg(src.data[i], src.data[i + 1], src.data[i + 2], src.data[i + 3], BG_EDGE_SOFT)) continue;
      const neighbors =
        (x > 0 && mask[idx - 1]) ||
        (x < w - 1 && mask[idx + 1]) ||
        (y > 0 && mask[idx - w]) ||
        (y < h - 1 && mask[idx + w]);
      if (neighbors) soft[idx] = 1;
    }
  }
  return soft;
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
    { name: "sand", qx: 0, qy: 512 },
    { name: "farm", qx: 512, qy: 512 },
  ];

  const sheet = emptyPng(TILE_CELL * 4, TILE_CELL);
  const frames = {};
  const sizes = [];

  for (let idx = 0; idx < quadrants.length; idx++) {
    const q = quadrants[idx];
    const bbox = bboxInQuadrant(src, mask, q.qx, q.qy, 512, 512);
    if (!bbox) throw new Error(`empty quadrant for tile ${q.name}`);
    const cropped = extractCrop(src, mask, q.qx, q.qy, bbox);
    const scaled = downscaleFit(cropped, TILE_MAX, TILE_MAX);
    const cellX = idx * TILE_CELL;
    const dx = cellX + Math.floor((TILE_CELL - scaled.width) / 2);
    const dy = TILE_CELL - scaled.height;
    blit(sheet, scaled, dx, dy);
    frames[q.name] = {
      frame: { x: cellX, y: 0, w: TILE_CELL, h: TILE_CELL },
      rotated: false,
      trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w: TILE_CELL, h: TILE_CELL },
      sourceSize: { w: TILE_CELL, h: TILE_CELL },
    };
    sizes.push({ name: q.name, scaled: { w: scaled.width, h: scaled.height } });
  }

  const outDir = path.join(OUT_ROOT, "tiles");
  await fs.mkdir(outDir, { recursive: true });
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

async function prepareCharacter(charId, rawPath) {
  const src = await readPng(rawPath);
  if (src.width !== 1024 || src.height !== 1024) {
    throw new Error(`${charId}.png must be 1024x1024, got ${src.width}x${src.height}`);
  }
  const mask = buildBgMask(src);
  // build per-facing baseline cell of 256x256
  const facingCells = {};
  for (const facing of Object.keys(QUADRANT_FACING)) {
    const { col, row } = QUADRANT_FACING[facing];
    const qx = col * 512;
    const qy = row * 512;
    const bbox = bboxInQuadrant(src, mask, qx, qy, 512, 512);
    if (!bbox) throw new Error(`empty quadrant for ${charId}/${facing}`);
    const cropped = extractCrop(src, mask, qx, qy, bbox);
    const scaled = downscaleFit(cropped, CHAR_INNER, CHAR_INNER);
    const cell = emptyPng(CHAR_FRAME, CHAR_FRAME);
    const dx = Math.floor((CHAR_FRAME - scaled.width) / 2);
    const dy = CHAR_BASELINE_Y - scaled.height;
    blit(cell, scaled, dx, dy);
    facingCells[facing] = cell;
  }

  const sheetW = CHAR_COLS * CHAR_FRAME;
  const sheetH = CHAR_ROWS * CHAR_FRAME;
  const sheet = emptyPng(sheetW, sheetH);
  const frames = {};

  for (let r = 0; r < ANIMATIONS.length; r++) {
    const anim = ANIMATIONS[r];
    const base = facingCells[anim.facing];
    for (let c = 0; c < CHAR_COLS; c++) {
      const dx = c * CHAR_FRAME;
      const dy = r * CHAR_FRAME;
      const yShift = anim.bob && (c === 1 || c === 3) ? -6 : 0;
      // blit base into sheet at (dx, dy + yShift)
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
  if (!(await exists(RAW_CAT))) missing.push("assets/raw/cat.png");
  if (!(await exists(RAW_AUSSIE))) missing.push("assets/raw/aussie.png");
  if (missing.length) {
    console.error(`[prep] missing required raw assets: ${missing.join(", ")}`);
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
  for (const [id, raw] of [
    ["cat", RAW_CAT],
    ["aussie", RAW_AUSSIE],
  ]) {
    console.log(`[prep] character ${id}...`);
    const res = await prepareCharacter(id, raw);
    console.log(`        sheet: ${res.sheetW}x${res.sheetH}, frames: ${res.frameCount}`);
    console.log(`        png:  ${path.relative(ROOT, res.outPng)}`);
    console.log(`        json: ${path.relative(ROOT, res.outJson)}`);
    charResults[id] = res;
  }

  const topManifest = {
    tiles: TILE_NAMES,
    characters: ["cat", "aussie"],
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
