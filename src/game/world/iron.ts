// Iron ore deposits. Only spawn inside ROCK_BIOMES, at ~25% density of biome
// tiles. Same harvest model as trees/stones (3 HP, 1 iron per hit, respawn).

import { isInRockBiome } from "./biomes";
import { GRID_RADIUS } from "./tiles";
import { hasTreeAt } from "./trees";
import { hasStoneAt } from "./stones";
import { isNpcTile } from "./npcs";

export const IRON_DENSITY_PCT = 25;
export const IRON_MAX_HP = 3;
export const IRON_PER_HIT = 1;
export const IRON_RESPAWN_MS = 3 * 60 * 1000;

export interface IronState {
  hp: number;
  depletedAt: number | null;
}

function tileHash(ix: number, iy: number): number {
  return ((ix * 2147483647) ^ (iy * 805306457)) >>> 0;
}

export function hasIronAt(ix: number, iy: number): boolean {
  if (Math.abs(ix) > GRID_RADIUS || Math.abs(iy) > GRID_RADIUS) return false;
  if (!isInRockBiome(ix, iy)) return false;
  if (hasTreeAt(ix, iy)) return false;
  if (hasStoneAt(ix, iy)) return false;
  if (isNpcTile(ix, iy)) return false;
  return tileHash(ix, iy) % 100 < IRON_DENSITY_PCT;
}

export function listAllIronTiles(): { ix: number; iy: number }[] {
  const out: { ix: number; iy: number }[] = [];
  for (let ix = -GRID_RADIUS; ix <= GRID_RADIUS; ix++) {
    for (let iy = -GRID_RADIUS; iy <= GRID_RADIUS; iy++) {
      if (hasIronAt(ix, iy)) out.push({ ix, iy });
    }
  }
  return out;
}

const state = new Map<string, IronState>();

function keyFor(ix: number, iy: number): string {
  return `${ix},${iy}`;
}

export function getIronState(ix: number, iy: number): IronState {
  const key = keyFor(ix, iy);
  let s = state.get(key);
  if (!s) {
    s = { hp: IRON_MAX_HP, depletedAt: null };
    state.set(key, s);
  }
  if (s.hp <= 0 && s.depletedAt !== null && Date.now() - s.depletedAt >= IRON_RESPAWN_MS) {
    s.hp = IRON_MAX_HP;
    s.depletedAt = null;
  }
  return s;
}

export function damageIron(ix: number, iy: number): number {
  if (!hasIronAt(ix, iy)) return 0;
  const s = getIronState(ix, iy);
  if (s.hp <= 0) return 0;
  s.hp -= 1;
  if (s.hp <= 0) s.depletedAt = Date.now();
  return IRON_PER_HIT;
}
