const ADJECTIVES = [
  "Brave", "Clever", "Daring", "Eager", "Fierce", "Gentle", "Happy", "Iron",
  "Jolly", "Keen", "Lucky", "Mighty", "Noble", "Odd", "Proud", "Quick",
  "Royal", "Swift", "Tough", "Upbeat", "Valiant", "Wise", "Xenial", "Yare",
  "Zesty", "Cosmic", "Mellow", "Plucky", "Rowdy", "Shiny", "Spry", "Stout",
  "Sunny", "Vivid", "Witty", "Bold", "Calm", "Dusty", "Frosty", "Glowing",
];

const STORAGE_KEY = "poncho.localName";

export function generatePonchoName(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const n = Math.floor(Math.random() * 90) + 10;
  return `${adj} Poncho ${n}`;
}

export function isValidPonchoName(name: string): boolean {
  return /^[a-zA-Z]+ Poncho \d{2}$/.test(name);
}

export function loadOrCreateLocalName(): string {
  if (typeof window === "undefined") return generatePonchoName();
  try {
    const existing = window.localStorage.getItem(STORAGE_KEY);
    if (existing && isValidPonchoName(existing)) return existing;
  } catch {}
  const fresh = generatePonchoName();
  try {
    window.localStorage.setItem(STORAGE_KEY, fresh);
  } catch {}
  return fresh;
}
