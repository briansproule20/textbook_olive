export const TILE_WIDTH = 128;
export const TILE_HEIGHT = 64;

export interface Vec2 {
  x: number;
  y: number;
}

export function isoToScreen(ix: number, iy: number): Vec2 {
  return {
    x: (ix - iy) * (TILE_WIDTH / 2),
    y: (ix + iy) * (TILE_HEIGHT / 2),
  };
}

export function screenToIso(sx: number, sy: number): Vec2 {
  return {
    x: sx / TILE_WIDTH + sy / TILE_HEIGHT,
    y: sy / TILE_HEIGHT - sx / TILE_WIDTH,
  };
}

export function isoInputToScreenVector(ix: number, iy: number): Vec2 {
  const sx = (ix - iy) * (TILE_WIDTH / 2);
  const sy = (ix + iy) * (TILE_HEIGHT / 2);
  const len = Math.hypot(sx, sy);
  if (len === 0) return { x: 0, y: 0 };
  return { x: sx / len, y: sy / len };
}

export function worldObjectDepth(y: number): number {
  return y + 3000;
}

export const BASELINE_OFFSET = 22;
