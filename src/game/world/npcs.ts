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
    // Five tiles southeast of the spawn block (which anchors at 0,0..1,1).
    ix: 5,
    iy: 5,
    dialogue: "Hello",
  },
];
