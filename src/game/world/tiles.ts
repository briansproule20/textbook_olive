import { isInRockBiome } from "./biomes";

export const GRID_RADIUS = 50;
export const TILE_FRAMES = ["grass", "grass2", "dirt", "rock"] as const;
export type TileFrame = (typeof TILE_FRAMES)[number];
export const TILE_ATLAS_KEY = "tiles";

// 2x2 rock spawn block anchored at (0,0).
const SPAWN_ROCK_TILES = new Set(["0,0", "1,0", "0,1", "1,1"]);

export function isSpawnTile(ix: number, iy: number): boolean {
  return SPAWN_ROCK_TILES.has(`${ix},${iy}`);
}

// Clear ring around the spawn rock — no trees or stones spawn within
// SPAWN_CLEAR_RADIUS tiles (Euclidean) of the spawn block's center (~0.5,0.5).
export const SPAWN_CLEAR_RADIUS = 10;

export function isInSpawnClearZone(ix: number, iy: number): boolean {
  const dx = ix - 0.5;
  const dy = iy - 0.5;
  return dx * dx + dy * dy < SPAWN_CLEAR_RADIUS * SPAWN_CLEAR_RADIUS;
}

export function tileAt(ix: number, iy: number): TileFrame {
  if (isSpawnTile(ix, iy)) return "rock";
  if (isInRockBiome(ix, iy)) return "rock";
  const patchX = Math.floor(ix / 2);
  const patchY = Math.floor(iy / 2);
  const patchHash = ((patchX * 73856093) ^ (patchY * 19349663)) >>> 0;
  const isDirt = patchHash % 100 < 22;
  const variantHash = ((ix * 83492791) ^ (iy * 50331653)) >>> 0;
  const variant = variantHash & 1;
  if (isDirt) return "dirt";
  return variant ? "grass2" : "grass";
}
