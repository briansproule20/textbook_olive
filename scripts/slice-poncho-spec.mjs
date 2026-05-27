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

const CELL = 256;
const COLS = 4;
const src = PNG.sync.read(await fs.readFile(REF));

function makeGrid(srcRow, { flipX = false } = {}) {
  const out = new PNG({ width: CELL * 2, height: CELL * 2 });
  out.data.fill(0);
  const srcY0 = srcRow * CELL;
  const dest = [
    { dx: 0, dy: 0 },
    { dx: CELL, dy: 0 },
    { dx: 0, dy: CELL },
    { dx: CELL, dy: CELL },
  ];
  for (let f = 0; f < COLS; f++) {
    const srcX0 = f * CELL;
    const { dx, dy } = dest[f];
    for (let yy = 0; yy < CELL; yy++) {
      for (let xx = 0; xx < CELL; xx++) {
        const sx = flipX ? CELL - 1 - xx : xx;
        const si = ((srcY0 + yy) * src.width + (srcX0 + sx)) * 4;
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
