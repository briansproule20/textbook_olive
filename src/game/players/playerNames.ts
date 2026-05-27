export const ADJECTIVES = [
  "Brave", "Clever", "Daring", "Eager", "Fierce", "Gentle", "Happy", "Iron",
  "Jolly", "Keen", "Lucky", "Mighty", "Noble", "Odd", "Proud", "Quick",
  "Royal", "Swift", "Tough", "Upbeat", "Valiant", "Wise", "Xenial", "Yare",
  "Zesty", "Cosmic", "Mellow", "Plucky", "Rowdy", "Shiny", "Spry", "Stout",
  "Sunny", "Vivid", "Witty", "Bold", "Calm", "Dusty", "Frosty", "Glowing",
];

export const ADJECTIVE_PATTERN = /^[A-Z][a-zA-Z]*$/;

export function saveNameParts(adj: string, num: number): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem("poncho.nameParts", JSON.stringify({ adj, num }));
  } catch {
    // ignore
  }
}

export function hasSavedNameParts(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return !!window.localStorage.getItem("poncho.nameParts");
  } catch {
    return false;
  }
}

const PARTS_KEY = "poncho.nameParts";
const LEGACY_FULL_KEY = "poncho.localName";

interface NameParts {
  adj: string;
  num: number;
}

function randomParts(): NameParts {
  return {
    adj: ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)],
    num: Math.floor(Math.random() * 90) + 10,
  };
}

function isValidParts(value: unknown): value is NameParts {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.adj === "string" &&
    /^[A-Z][a-zA-Z]+$/.test(v.adj) &&
    typeof v.num === "number" &&
    v.num >= 10 &&
    v.num <= 99
  );
}

function loadOrCreateParts(): NameParts {
  if (typeof window === "undefined") return randomParts();
  try {
    const raw = window.localStorage.getItem(PARTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (isValidParts(parsed)) return parsed;
    }
    // Migrate legacy "<Adj> Poncho NN" names: keep the adjective and number,
    // drop the noun. The new render path supplies the active character label.
    const legacy = window.localStorage.getItem(LEGACY_FULL_KEY);
    if (legacy) {
      const m = /^([A-Z][a-zA-Z]+) Poncho (\d{2})$/.exec(legacy);
      if (m) {
        const migrated: NameParts = { adj: m[1], num: Number(m[2]) };
        window.localStorage.setItem(PARTS_KEY, JSON.stringify(migrated));
        return migrated;
      }
    }
  } catch {
    // ignore
  }
  const fresh = randomParts();
  try {
    window.localStorage.setItem(PARTS_KEY, JSON.stringify(fresh));
  } catch {
    // ignore
  }
  return fresh;
}

export function composeName(parts: NameParts, charLabel: string): string {
  return `${parts.adj} ${charLabel} ${parts.num}`;
}

export function loadOrCreateLocalName(charLabel: string): string {
  return composeName(loadOrCreateParts(), charLabel);
}

export function isValidPlayerName(name: string): boolean {
  return /^[A-Z][a-zA-Z]+(?: [A-Z][a-zA-Z]+)+ \d{2}$/.test(name);
}
