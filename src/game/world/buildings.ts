// Buildings the player can construct on the map.
//
// Static registry (BUILDING_TYPES) + runtime placement state. Placed buildings
// occupy a rectangular footprint anchored at the (iso) tile in the
// bottom-front corner (anchor = origin of the building's iso diamond). Their
// art is loaded as a single Phaser image, anchored at the bottom-center of
// the footprint.
//
// Interaction model: SPACE while standing within the harvest reach of any
// footprint tile runs the building's recipe — consume inputs from inventory,
// produce outputs. Buildings block movement on every tile in their footprint
// (collision check pulls from getBuildingTiles()).

export type ItemId = "wood" | "stone" | "iron" | "plank" | "ingot";

export interface RecipeIO {
  itemId: ItemId;
  qty: number;
}

export interface BuildingType {
  id: string;
  label: string;
  description: string;
  // Footprint dimensions in iso tiles (w = +ix direction, h = +iy direction).
  w: number;
  h: number;
  spritePath: string;
  // Display scale for the loaded image when rendered in the scene.
  spriteScale: number;
  inputs: RecipeIO[];
  outputs: RecipeIO[];
}

export const BUILDING_TYPES: BuildingType[] = [
  {
    id: "sawmill",
    label: "Sawmill",
    description: "Turns 2 wood into 1 plank.",
    w: 2,
    h: 2,
    spritePath: "/sprites/buildings/sawmill.png",
    spriteScale: 0.5,
    inputs: [{ itemId: "wood", qty: 2 }],
    outputs: [{ itemId: "plank", qty: 1 }],
  },
  {
    id: "forge",
    label: "Forge",
    description: "Turns 1 iron + 1 wood into 1 ingot.",
    w: 2,
    h: 2,
    spritePath: "/sprites/buildings/forge.png",
    spriteScale: 0.5,
    inputs: [
      { itemId: "iron", qty: 1 },
      { itemId: "wood", qty: 1 },
    ],
    outputs: [{ itemId: "ingot", qty: 1 }],
  },
];

export interface PlacedBuilding {
  uid: string; // unique runtime id
  typeId: string;
  ix: number; // anchor tile (front-bottom corner of footprint)
  iy: number;
}

const placed: PlacedBuilding[] = [];
const listeners = new Set<() => void>();

function notify(): void {
  for (const cb of listeners) cb();
}

export function getPlacedBuildings(): PlacedBuilding[] {
  return placed.slice();
}

export function subscribePlacedBuildings(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

// Enumerate every (ix, iy) tile a placed building occupies. With anchor at
// (ax, ay), footprint extends to (ax + w - 1, ay + h - 1) inclusive.
export function getBuildingTiles(b: PlacedBuilding): { ix: number; iy: number }[] {
  const t = BUILDING_TYPES.find((bt) => bt.id === b.typeId);
  if (!t) return [];
  const tiles: { ix: number; iy: number }[] = [];
  for (let dx = 0; dx < t.w; dx++) {
    for (let dy = 0; dy < t.h; dy++) {
      tiles.push({ ix: b.ix + dx, iy: b.iy + dy });
    }
  }
  return tiles;
}

// Build a Set of all building-occupied tile keys for fast collision checks.
export function getOccupiedTilesSet(): Set<string> {
  const out = new Set<string>();
  for (const b of placed) {
    for (const { ix, iy } of getBuildingTiles(b)) {
      out.add(`${ix},${iy}`);
    }
  }
  return out;
}

export function isTileOccupiedByBuilding(ix: number, iy: number): boolean {
  for (const b of placed) {
    for (const { ix: tx, iy: ty } of getBuildingTiles(b)) {
      if (tx === ix && ty === iy) return true;
    }
  }
  return false;
}

// Building whose footprint contains (ix, iy), or null.
export function buildingAt(ix: number, iy: number): PlacedBuilding | null {
  for (const b of placed) {
    for (const { ix: tx, iy: ty } of getBuildingTiles(b)) {
      if (tx === ix && ty === iy) return b;
    }
  }
  return null;
}

export function buildingType(typeId: string): BuildingType | null {
  return BUILDING_TYPES.find((bt) => bt.id === typeId) ?? null;
}

// Adds a building if the requested footprint is clear (caller verifies with
// isPlacementValid). Returns the new placement.
export function placeBuilding(typeId: string, ix: number, iy: number): PlacedBuilding {
  const uid = `${typeId}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const b: PlacedBuilding = { uid, typeId, ix, iy };
  placed.push(b);
  notify();
  return b;
}

export function removeBuilding(uid: string): void {
  const i = placed.findIndex((b) => b.uid === uid);
  if (i >= 0) {
    placed.splice(i, 1);
    notify();
  }
}
