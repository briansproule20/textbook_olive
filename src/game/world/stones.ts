// Same shape as trees: deterministic placement + per-tile harvest state.
// Stones use a different hash seed so they don't overlap tree positions.

import { isInSpawnClearZone, isSpawnTile, tileAt, GRID_RADIUS } from "./tiles";
import { hasTreeAt } from "./trees";

export const STONE_DENSITY_PCT = 3; // slightly rarer than trees
export const STONE_MAX_HP = 3;
export const STONE_PER_HIT = 1;
export const STONE_RESPAWN_MS = 3 * 60 * 1000;

export interface StoneState {
  hp: number;
  depletedAt: number | null;
}

function tileHash(ix: number, iy: number): number {
  // Different constants from trees so stones land elsewhere
  return ((ix * 374761393) ^ (iy * 668265263)) >>> 0;
}

export function hasStoneAt(ix: number, iy: number): boolean {
  if (Math.abs(ix) > GRID_RADIUS || Math.abs(iy) > GRID_RADIUS) return false;
  if (isSpawnTile(ix, iy)) return false;
  if (isInSpawnClearZone(ix, iy)) return false;
  if (hasTreeAt(ix, iy)) return false; // never stack stone on top of a tree
  const t = tileAt(ix, iy);
  if (t !== "grass" && t !== "grass2" && t !== "dirt") return false;
  return tileHash(ix, iy) % 100 < STONE_DENSITY_PCT;
}

export function listAllStoneTiles(): { ix: number; iy: number }[] {
  const out: { ix: number; iy: number }[] = [];
  for (let ix = -GRID_RADIUS; ix <= GRID_RADIUS; ix++) {
    for (let iy = -GRID_RADIUS; iy <= GRID_RADIUS; iy++) {
      if (hasStoneAt(ix, iy)) out.push({ ix, iy });
    }
  }
  return out;
}

const state = new Map<string, StoneState>();

function keyFor(ix: number, iy: number): string {
  return `${ix},${iy}`;
}

export function getStoneState(ix: number, iy: number): StoneState {
  const key = keyFor(ix, iy);
  let s = state.get(key);
  if (!s) {
    s = { hp: STONE_MAX_HP, depletedAt: null };
    state.set(key, s);
  }
  if (s.hp <= 0 && s.depletedAt !== null && Date.now() - s.depletedAt >= STONE_RESPAWN_MS) {
    s.hp = STONE_MAX_HP;
    s.depletedAt = null;
  }
  return s;
}

export function damageStone(ix: number, iy: number): number {
  if (!hasStoneAt(ix, iy)) return 0;
  const s = getStoneState(ix, iy);
  if (s.hp <= 0) return 0;
  s.hp -= 1;
  if (s.hp <= 0) s.depletedAt = Date.now();
  return STONE_PER_HIT;
}
