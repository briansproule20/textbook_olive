export const TILE_FRAMES = ["grass", "dirt", "sand", "farm"] as const;
export type TileFrame = (typeof TILE_FRAMES)[number];
export const TILE_ATLAS_KEY = "tiles";

export function tileAt(ix: number, iy: number): TileFrame {
  const h = ((ix * 73856093) ^ (iy * 19349663)) >>> 0;
  const bucket = h % 100;
  if (bucket < 70) return "grass";
  if (bucket < 85) return "dirt";
  if (bucket < 93) return "sand";
  return "farm";
}
