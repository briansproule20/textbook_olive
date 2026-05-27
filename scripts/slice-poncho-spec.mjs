// One-shot: slice assets/reference/poncho-spec.png (1024x1792, 4x7 grid of
// 256-px cells) into the prep pipeline's 2x2 walk-strip format.
//
// Source rows we use:
//   row 1: SE walk (head down-right) → assets/raw/walks/poncho/se.png
//   row 3: NW walk (head up-left)    → horizontally flipped → assets/raw/walks/poncho/ne.png
//
// The sheet only contains NW back-view art, so NE is produced by flipping NW.
// The engine then runtime-mirrors NE→NW and SE→SW so all four diagonals show
// the right direction.

import { PNG } from "pngjs";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const REF = path.join(ROOT, "assets/reference/poncho-spec.png");
const OUT_SE = path.join(ROOT, "assets/raw/walks/poncho/se.png");
const OUT_NE = path.join(ROOT, "assets/raw/walks/poncho/ne.png");

const SRC_CELL = 256;
const OUT_CELL = 512; // upscale 2x so the 2x2 grid is 1024x1024 (prep expects this)
const SCALE = OUT_CELL / SRC_CELL;
const COLS = 4;
const src = PNG.sync.read(await fs.readFile(REF));

function makeGrid(srcRow, { flipX = false } = {}) {
  const out = new PNG({ width: OUT_CELL * 2, height: OUT_CELL * 2 });
  out.data.fill(0);
  const srcY0 = srcRow * SRC_CELL;
  const dest = [
    { dx: 0, dy: 0 },
    { dx: OUT_CELL, dy: 0 },
    { dx: 0, dy: OUT_CELL },
    { dx: OUT_CELL, dy: OUT_CELL },
  ];
  for (let f = 0; f < COLS; f++) {
    const srcX0 = f * SRC_CELL;
    const { dx, dy } = dest[f];
    for (let yy = 0; yy < OUT_CELL; yy++) {
      for (let xx = 0; xx < OUT_CELL; xx++) {
        // Nearest-neighbour upscale to preserve pixel-art crispness
        const syy = Math.floor(yy / SCALE);
        const sxxBase = Math.floor(xx / SCALE);
        const sx = flipX ? SRC_CELL - 1 - sxxBase : sxxBase;
        const si = ((srcY0 + syy) * src.width + (srcX0 + sx)) * 4;
        const di = ((dy + yy) * out.width + (dx + xx)) * 4;
        let r = src.data[si];
        let g = src.data[si + 1];
        let b = src.data[si + 2];
        let a = src.data[si + 3];
        // Black background → transparent
        if (r < 16 && g < 16 && b < 16) {
          a = 0;
          r = g = b = 0;
        }
        out.data[di] = r;
        out.data[di + 1] = g;
        out.data[di + 2] = b;
        out.data[di + 3] = a;
      }
    }
  }
  return out;
}

const se = makeGrid(1);
const ne = makeGrid(3, { flipX: true });
await fs.writeFile(OUT_SE, PNG.sync.write(se));
await fs.writeFile(OUT_NE, PNG.sync.write(ne));
console.log("wrote", path.relative(ROOT, OUT_SE), "and", path.relative(ROOT, OUT_NE));
