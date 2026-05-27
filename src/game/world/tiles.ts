export const TILE_FRAMES = ["grass", "grass2", "dirt", "dirt2"] as const;
export type TileFrame = (typeof TILE_FRAMES)[number];
export const TILE_ATLAS_KEY = "tiles";

export function tileAt(ix: number, iy: number): TileFrame {
  const patchX = Math.floor(ix / 2);
  const patchY = Math.floor(iy / 2);
  const patchHash = ((patchX * 73856093) ^ (patchY * 19349663)) >>> 0;
  const isDirt = patchHash % 100 < 22;
  const variantHash = ((ix * 83492791) ^ (iy * 50331653)) >>> 0;
  const variant = variantHash & 1;
  if (isDirt) return variant ? "dirt2" : "dirt";
  return variant ? "grass2" : "grass";
}
