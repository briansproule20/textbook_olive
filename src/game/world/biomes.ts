// Rocky biomes — patches of map where the ground turns to rock and iron ore
// deposits spawn. Fixed positions so the world is recognizable across reloads.

export interface RockBiome {
  id: string;
  ix: number; // iso center
  iy: number;
  radius: number; // tiles
}

export const ROCK_BIOMES: RockBiome[] = [
  { id: "rocky-east", ix: 24, iy: -8, radius: 6 },
  { id: "rocky-south", ix: 12, iy: 24, radius: 6 },
  { id: "rocky-northwest", ix: -22, iy: -14, radius: 6 },
];

export function isInRockBiome(ix: number, iy: number): boolean {
  for (const b of ROCK_BIOMES) {
    const dx = ix - b.ix;
    const dy = iy - b.iy;
    if (dx * dx + dy * dy < b.radius * b.radius) return true;
  }
  return false;
}
