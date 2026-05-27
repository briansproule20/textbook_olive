export const TILE_FRAMES = ["grass", "dirt", "sand", "farm"] as const;
export type TileFrame = (typeof TILE_FRAMES)[number];
export const TILE_ATLAS_KEY = "tiles";

export function tileAt(ix: number, iy: number): TileFrame {
  const patchX = Math.floor(ix / 2);
  const patchY = Math.floor(iy / 2);
  const h = ((patchX * 73856093) ^ (patchY * 19349663)) >>> 0;
  if (h % 100 < 22) return "dirt";
  return "grass";
}
