// World NPCs. Static (no AI movement) for now — each has a fixed iso position,
// a character atlas to render with, a display name, and a single line of
// dialogue that floats over their head.

import type { CharacterId } from "../sprites/characterTextures";

export interface NpcSpec {
  id: string;
  name: string;
  charId: CharacterId;
  ix: number;
  iy: number;
  dialogue: string;
}

export const NPCS: NpcSpec[] = [
  {
    id: "geno",
    name: "Geno",
    charId: "penguin",
    // Five tiles east of the spawn block.
    ix: 5,
    iy: 0,
    dialogue: "Hello",
  },
];

// All NPC iso positions, exposed for the collision check. Keyed by "ix,iy".
export const NPC_TILES = new Set(NPCS.map((n) => `${n.ix},${n.iy}`));

export function isNpcTile(ix: number, iy: number): boolean {
  return NPC_TILES.has(`${ix},${iy}`);
}

export function npcAt(ix: number, iy: number): NpcSpec | null {
  for (const n of NPCS) {
    if (n.ix === ix && n.iy === iy) return n;
  }
  return null;
}
