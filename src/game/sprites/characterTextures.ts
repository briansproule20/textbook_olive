export const CHARACTERS = [
  "poncho",
  "cat",
  "aussie",
  "collie",
  "penguin",
  "black-lab",
  "yellow-lab",
  "brown-lab",
  "pug",
  "pug-beagle",
  "dachshund",
  "brown-tabby",
  "orange-tabby",
] as const;
export type CharacterId = (typeof CHARACTERS)[number];
export const DEFAULT_CHARACTER: CharacterId = "poncho";

export const CHARACTER_LABELS: Record<CharacterId, string> = {
  poncho: "Poncho",
  cat: "Black Cat",
  aussie: "Aussie",
  collie: "Collie",
  penguin: "Penguin",
  "black-lab": "Black Lab",
  "yellow-lab": "Yellow Lab",
  "brown-lab": "Brown Lab",
  pug: "Pug",
  "pug-beagle": "Pug Beagle",
  dachshund: "Dachshund",
  "brown-tabby": "Brown Tabby",
  "orange-tabby": "Orange Tabby",
};
const CHARACTER_STORAGE_KEY = "poncho.character";

export function atlasKey(charId: string): string {
  return `character-${charId}`;
}

export function loadSelectedCharacter(): CharacterId {
  if (typeof window === "undefined") return DEFAULT_CHARACTER;
  try {
    const raw = window.localStorage.getItem(CHARACTER_STORAGE_KEY);
    if (raw && (CHARACTERS as readonly string[]).includes(raw)) {
      return raw as CharacterId;
    }
  } catch {
    // ignore
  }
  return DEFAULT_CHARACTER;
}

export function saveSelectedCharacter(id: CharacterId): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CHARACTER_STORAGE_KEY, id);
  } catch {
    // ignore
  }
}

export const DIRECTIONS = ["se", "sw", "ne", "nw"] as const;
export const ACTIONS = ["idle", "walk", "attack"] as const;

export type Direction = (typeof DIRECTIONS)[number];
export type Action = (typeof ACTIONS)[number];

export interface ResolvedAnim {
  key: string;
  flipX: boolean;
}

export function frameKey(action: Action, direction: Direction, index: number): string {
  return `${action}_${direction}_${String(index).padStart(2, "0")}`;
}

export function animationKey(action: Action, direction: Direction): string {
  return `anim_${action}_${direction}`;
}

// Atlas only contains SE+NE source frames. SW/NW are produced by Phaser flipX
// at render time so they are pixel-identical to SE/NE (just mirrored), and
// the visual character size is guaranteed equal between left and right.
export function atlasAnimationKey(action: Action, direction: Direction): ResolvedAnim {
  const flip = direction === "sw" || direction === "nw";
  if (action === "idle") {
    return { key: animationKey("idle", "se"), flipX: flip };
  }
  if (action === "attack") {
    return { key: animationKey("attack", "se"), flipX: flip };
  }
  // walk
  const baseDir: Direction = direction === "ne" || direction === "nw" ? "ne" : "se";
  return { key: animationKey("walk", baseDir), flipX: flip };
}

// Facing labels (se/sw/ne/nw) refer to SCREEN diamond corners, so the input
// here MUST be the screen-space movement vector (e.g. moveVec applied to
// player.x and player.y), not the iso world vector. Using iso here causes
// the sprite to mis-face on certain inputs because iso +iy is actually
// screen-SW, not screen-south.
export function directionFromVector(
  screenVector: { x: number; y: number },
  previous: Direction
): Direction {
  const DEAD = 0.05;
  const absX = Math.abs(screenVector.x);
  const absY = Math.abs(screenVector.y);

  const prevIsEast = previous === "se" || previous === "ne";
  const prevIsSouth = previous === "se" || previous === "sw";

  const east = absX < DEAD ? prevIsEast : screenVector.x > 0;
  const south = absY < DEAD ? prevIsSouth : screenVector.y > 0;

  if (south && east) return "se";
  if (south && !east) return "sw";
  if (!south && east) return "ne";
  return "nw";
}
