// Deterministic tree placement + per-tile harvest state.
//
// Placement is hashed off (ix, iy) so the same tiles always have trees across
// reloads. Only grass tiles get trees, never rock/spawn tiles.
//
// Per-tree state is in-memory only (lost on reload, fine for now): hp 0..3.
// When hp reaches 0, the tree stays visually but stops yielding wood. After
// TREE_RESPAWN_MS of real time, hp resets to MAX_HP — driven by Date.now()
// so the clock is the player's machine clock.

import { isSpawnTile, tileAt, GRID_RADIUS } from "./tiles";

export const TREE_DENSITY_PCT = 4; // ~4% of eligible tiles have a tree
export const TREE_MAX_HP = 3;
export const TREE_WOOD_PER_HIT = 1;
export const TREE_RESPAWN_MS = 3 * 60 * 1000; // 3 minutes

export interface TreeState {
  hp: number;
  depletedAt: number | null; // ms timestamp when hp dropped to 0
}

function tileHash(ix: number, iy: number): number {
  return ((ix * 2654435761) ^ (iy * 40503)) >>> 0;
}

export function hasTreeAt(ix: number, iy: number): boolean {
  if (Math.abs(ix) > GRID_RADIUS || Math.abs(iy) > GRID_RADIUS) return false;
  if (isSpawnTile(ix, iy)) return false;
  if (tileAt(ix, iy) !== "grass" && tileAt(ix, iy) !== "grass2") return false;
  return tileHash(ix, iy) % 100 < TREE_DENSITY_PCT;
}

export function listAllTreeTiles(): { ix: number; iy: number }[] {
  const out: { ix: number; iy: number }[] = [];
  for (let ix = -GRID_RADIUS; ix <= GRID_RADIUS; ix++) {
    for (let iy = -GRID_RADIUS; iy <= GRID_RADIUS; iy++) {
      if (hasTreeAt(ix, iy)) out.push({ ix, iy });
    }
  }
  return out;
}

const state = new Map<string, TreeState>();

function keyFor(ix: number, iy: number): string {
  return `${ix},${iy}`;
}

export function getTreeState(ix: number, iy: number): TreeState {
  const key = keyFor(ix, iy);
  let s = state.get(key);
  if (!s) {
    s = { hp: TREE_MAX_HP, depletedAt: null };
    state.set(key, s);
  }
  // Respawn if depleted long enough ago.
  if (s.hp <= 0 && s.depletedAt !== null && Date.now() - s.depletedAt >= TREE_RESPAWN_MS) {
    s.hp = TREE_MAX_HP;
    s.depletedAt = null;
  }
  return s;
}

// Damages the tree at (ix, iy) by 1. Returns the amount of wood dropped
// (0 if no tree or already depleted, TREE_WOOD_PER_HIT otherwise).
export function damageTree(ix: number, iy: number): number {
  if (!hasTreeAt(ix, iy)) return 0;
  const s = getTreeState(ix, iy);
  if (s.hp <= 0) return 0;
  s.hp -= 1;
  if (s.hp <= 0) s.depletedAt = Date.now();
  return TREE_WOOD_PER_HIT;
}
