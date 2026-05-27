export const CHARACTERS = ["cat", "aussie"] as const;
export type CharacterId = (typeof CHARACTERS)[number];
export const DEFAULT_CHARACTER: CharacterId = "cat";
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

export function atlasAnimationKey(action: Action, direction: Direction): ResolvedAnim {
  if (action === "idle") {
    if (direction === "sw" || direction === "nw") return { key: animationKey("idle", "se"), flipX: true };
    return { key: animationKey("idle", "se"), flipX: false };
  }
  if (action === "attack") {
    if (direction === "ne") return { key: animationKey("attack", "sw"), flipX: true };
    if (direction === "nw") return { key: animationKey("attack", "se"), flipX: true };
    return { key: animationKey("attack", direction), flipX: false };
  }
  return { key: animationKey(action, direction), flipX: false };
}

export function directionFromVector(
  vector: { x: number; y: number },
  previous: Direction
): Direction {
  const DEAD = 0.05;
  const absX = Math.abs(vector.x);
  const absY = Math.abs(vector.y);

  const prevIsEast = previous === "se" || previous === "ne";
  const prevIsSouth = previous === "se" || previous === "sw";

  const east = absX < DEAD ? prevIsEast : vector.x > 0;
  const south = absY < DEAD ? prevIsSouth : vector.y > 0;

  if (south && east) return "se";
  if (south && !east) return "sw";
  if (!south && east) return "ne";
  return "nw";
}
