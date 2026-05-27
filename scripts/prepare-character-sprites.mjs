#!/usr/bin/env node
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

const FRAME_SIZE = 256;
const COLS = 4;

const ANIMATIONS = [
  { key: "idle_se", frames: 4, loop: true },
  { key: "walk_se", frames: 4, loop: true },
  { key: "walk_sw", frames: 4, loop: true },
  { key: "walk_ne", frames: 4, loop: true },
  { key: "walk_nw", frames: 4, loop: true },
  { key: "attack_se", frames: 4, loop: false },
  { key: "attack_sw", frames: 4, loop: false },
];

const SRC_PNG = path.join(ROOT, "assets/character/character-iso-sheet.png");
const SRC_JSON = path.join(ROOT, "assets/character/character-iso-sheet.json");
const OUT_DIR = path.join(ROOT, "public/sprites/character");
const OUT_PNG = path.join(OUT_DIR, "character-iso-sheet.png");
const OUT_JSON = path.join(OUT_DIR, "character-iso-sheet.json");
const OUT_MANIFEST = path.join(OUT_DIR, "manifest.json");

async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

function frameName(action, dir, idx) {
  const baseKey = `${action}_${dir}`;
  return `${baseKey}_${String(idx).padStart(2, "0")}`;
}

function allFrameNames() {
  const out = [];
  for (const anim of ANIMATIONS) {
    const [action, dir] = anim.key.split("_");
    for (let i = 0; i < anim.frames; i++) out.push(frameName(action, dir, i));
  }
  return out;
}

function setPixel(png, x, y, r, g, b, a = 255) {
  if (x < 0 || y < 0 || x >= png.width || y >= png.height) return;
  const idx = (png.width * y + x) << 2;
  png.data[idx] = r;
  png.data[idx + 1] = g;
  png.data[idx + 2] = b;
  png.data[idx + 3] = a;
}

function fillRect(png, x0, y0, w, h, r, g, b, a = 255) {
  for (let y = y0; y < y0 + h; y++)
    for (let x = x0; x < x0 + w; x++) setPixel(png, x, y, r, g, b, a);
}

function fillRoundedRect(png, x0, y0, w, h, radius, r, g, b, a = 255) {
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = x < radius ? radius - x : x >= w - radius ? x - (w - radius - 1) : 0;
      const dy = y < radius ? radius - y : y >= h - radius ? y - (h - radius - 1) : 0;
      if (dx * dx + dy * dy <= radius * radius) setPixel(png, x0 + x, y0 + y, r, g, b, a);
    }
  }
}

function fillTriangle(png, ax, ay, bx, by, cx, cy, r, g, b) {
  const minX = Math.min(ax, bx, cx);
  const maxX = Math.max(ax, bx, cx);
  const minY = Math.min(ay, by, cy);
  const maxY = Math.max(ay, by, cy);
  const sign = (x1, y1, x2, y2, x3, y3) =>
    (x1 - x3) * (y2 - y3) - (x2 - x3) * (y1 - y3);
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const d1 = sign(x, y, ax, ay, bx, by);
      const d2 = sign(x, y, bx, by, cx, cy);
      const d3 = sign(x, y, cx, cy, ax, ay);
      const negs = d1 < 0 || d2 < 0 || d3 < 0;
      const poss = d1 > 0 || d2 > 0 || d3 > 0;
      if (!(negs && poss)) setPixel(png, x, y, r, g, b);
    }
  }
}

function drawFrame(png, frameX, frameY, action, dir, frameIdx) {
  const cx = frameX + 128;
  const baselineY = frameY + 246;
  const bob = frameIdx % 4;
  const yOffset = -bob;

  const bodyW = 60;
  const bodyH = 90;
  const bodyX = cx - bodyW / 2;
  const bodyY = baselineY - bodyH + yOffset;

  let r = 80,
    g = 140,
    b = 220;
  if (action === "attack" && (frameIdx === 1 || frameIdx === 2)) {
    r = 240;
    g = 180;
    b = 60;
  }

  fillRoundedRect(png, bodyX, bodyY, bodyW, bodyH, 12, r, g, b);
  fillRoundedRect(png, cx - 22, bodyY - 28, 44, 40, 14, 250, 215, 180);

  const ay = bodyY + 18;
  const tipLen = 30;
  let tipX = cx, tipY = ay + 14;
  if (dir === "se") {
    tipX = cx + tipLen;
    tipY = ay + tipLen * 0.5;
  } else if (dir === "sw") {
    tipX = cx - tipLen;
    tipY = ay + tipLen * 0.5;
  } else if (dir === "ne") {
    tipX = cx + tipLen;
    tipY = ay - tipLen * 0.5;
  } else if (dir === "nw") {
    tipX = cx - tipLen;
    tipY = ay - tipLen * 0.5;
  }
  fillTriangle(png, cx, ay - 6, cx, ay + 6, tipX, tipY, 20, 20, 30);

  fillRect(png, cx - 28, baselineY, 56, 4, 0, 0, 0, 90);

  fillRect(png, frameX, frameY, FRAME_SIZE, 1, 60, 60, 70);
  fillRect(png, frameX, frameY + FRAME_SIZE - 1, FRAME_SIZE, 1, 60, 60, 70);
  fillRect(png, frameX, frameY, 1, FRAME_SIZE, 60, 60, 70);
  fillRect(png, frameX + FRAME_SIZE - 1, frameY, 1, FRAME_SIZE, 60, 60, 70);
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

function buildFramesList() {
  const list = [];
  for (const anim of ANIMATIONS) {
    const [action, dir] = anim.key.split("_");
    for (let i = 0; i < anim.frames; i++) list.push({ action, dir, name: frameName(action, dir, i) });
  }
  return list;
}

async function generatePlaceholder() {
  const frames = buildFramesList();
  const rows = Math.ceil(frames.length / COLS);
  const width = COLS * FRAME_SIZE;
  const height = rows * FRAME_SIZE;
  const png = new PNG({ width, height });

  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = 30;
    png.data[i + 1] = 32;
    png.data[i + 2] = 40;
    png.data[i + 3] = 0;
  }

  const atlasFrames = {};
  frames.forEach((f, idx) => {
    const col = idx % COLS;
    const row = Math.floor(idx / COLS);
    const x = col * FRAME_SIZE;
    const y = row * FRAME_SIZE;
    const frameIdx = Number(f.name.slice(-2));
    drawFrame(png, x, y, f.action, f.dir, frameIdx);
    atlasFrames[f.name] = {
      frame: { x, y, w: FRAME_SIZE, h: FRAME_SIZE },
      rotated: false,
      trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w: FRAME_SIZE, h: FRAME_SIZE },
      sourceSize: { w: FRAME_SIZE, h: FRAME_SIZE },
    };
  });

  await fs.mkdir(OUT_DIR, { recursive: true });
  await writePng(png, OUT_PNG);

  const atlasJson = {
    frames: atlasFrames,
    meta: {
      app: "prepare-character-sprites",
      version: "1.0",
      image: "character-iso-sheet.png",
      format: "RGBA8888",
      size: { w: width, h: height },
      scale: "1",
    },
  };
  await fs.writeFile(OUT_JSON, JSON.stringify(atlasJson, null, 2));
  return { placeholder: true, width, height, frameCount: frames.length };
}

async function copyReal() {
  const pngBuf = await fs.readFile(SRC_PNG);
  const meta = PNG.sync.read(pngBuf);
  const jsonStr = await fs.readFile(SRC_JSON, "utf8");
  const atlas = JSON.parse(jsonStr);
  const framesField = atlas.frames;
  if (!framesField) throw new Error("atlas JSON missing frames");

  const present = Array.isArray(framesField)
    ? new Set(framesField.map((f) => f.filename))
    : new Set(Object.keys(framesField));

  const required = allFrameNames();
  const missing = required.filter((n) => !present.has(n));
  if (missing.length) throw new Error(`missing frames in source atlas: ${missing.join(", ")}`);

  const checkSize = (w, h) => {
    if (w !== FRAME_SIZE || h !== FRAME_SIZE)
      throw new Error(`frame size must be ${FRAME_SIZE}x${FRAME_SIZE}, got ${w}x${h}`);
  };
  if (Array.isArray(framesField)) {
    for (const f of framesField) checkSize(f.frame.w, f.frame.h);
  } else {
    for (const k of Object.keys(framesField)) checkSize(framesField[k].frame.w, framesField[k].frame.h);
  }

  await fs.mkdir(OUT_DIR, { recursive: true });
  await fs.writeFile(OUT_PNG, pngBuf);
  await fs.writeFile(OUT_JSON, jsonStr);
  return { placeholder: false, width: meta.width, height: meta.height, frameCount: required.length };
}

async function main() {
  const hasPng = await exists(SRC_PNG);
  const hasJson = await exists(SRC_JSON);
  let result;
  if (hasPng && hasJson) {
    console.log("[prep] found source atlas, validating and copying");
    result = await copyReal();
  } else {
    console.log("[prep] source atlas not found, generating placeholder");
    result = await generatePlaceholder();
  }

  const manifest = {
    source: { png: path.relative(ROOT, SRC_PNG), json: path.relative(ROOT, SRC_JSON) },
    output: {
      png: path.relative(ROOT, OUT_PNG),
      json: path.relative(ROOT, OUT_JSON),
    },
    frameSize: { w: FRAME_SIZE, h: FRAME_SIZE },
    directions: ["se", "sw", "ne", "nw"],
    animations: ANIMATIONS,
    mirrored: {
      attack_ne: { source: "attack_sw", flipX: true },
      attack_nw: { source: "attack_se", flipX: true },
    },
    placeholder: result.placeholder,
    generated_at: new Date().toISOString(),
    notes: result.placeholder
      ? "placeholder generated; replace assets/character/* with real atlas"
      : "real atlas copied",
  };
  await fs.writeFile(OUT_MANIFEST, JSON.stringify(manifest, null, 2));

  console.log(
    `[prep] wrote ${path.relative(ROOT, OUT_PNG)} (${result.width}x${result.height}), ${result.frameCount} frames`
  );
  console.log(`[prep] wrote ${path.relative(ROOT, OUT_JSON)}`);
  console.log(`[prep] wrote ${path.relative(ROOT, OUT_MANIFEST)} placeholder=${result.placeholder}`);
}

main().catch((err) => {
  console.error("[prep] failed:", err);
  process.exit(1);
});
