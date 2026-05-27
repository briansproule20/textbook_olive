#!/usr/bin/env node
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

const inPath = process.argv[2] || "public/sprites/characters/cat/cat.png";
const outPath = process.argv[3] || "/tmp/cat-debug.png";

const buf = await fs.readFile(path.join(ROOT, inPath));
const src = PNG.sync.read(buf);
const dst = new PNG({ width: src.width, height: src.height });
for (let y = 0; y < src.height; y++) {
  for (let x = 0; x < src.width; x++) {
    const i = (y * src.width + x) * 4;
    const a = src.data[i + 3];
    if (a < 16) {
      dst.data[i] = 255;
      dst.data[i + 1] = 0;
      dst.data[i + 2] = 255;
      dst.data[i + 3] = 255;
    } else {
      dst.data[i] = src.data[i];
      dst.data[i + 1] = src.data[i + 1];
      dst.data[i + 2] = src.data[i + 2];
      dst.data[i + 3] = 255;
    }
  }
}
const outBuf = PNG.sync.write(dst);
await fs.writeFile(outPath, outBuf);
console.log(`wrote ${outPath}`);
