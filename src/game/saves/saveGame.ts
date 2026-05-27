// IndexedDB-backed save slot. One DB, one store, one record keyed "current".
// Skeleton: name + character + inventory (currently empty placeholder).
//
// Inventory shape is intentionally minimal so the game systems can grow into
// it without churning the schema right away. Items have an id, a label, and
// an optional quantity. Anything richer (icon, rarity, stats) can be added
// as optional fields later.

import { CHARACTERS, DEFAULT_CHARACTER, type CharacterId } from "@/game/sprites/characterTextures";

const DB_NAME = "poncho-save";
const DB_VERSION = 1;
const STORE = "saves";
const SLOT = "current";

export interface InventoryItem {
  id: string;
  label: string;
  qty?: number;
}

export interface SaveData {
  adj: string;
  num: number;
  charId: CharacterId;
  inventory: InventoryItem[];
  updatedAt: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function withStore<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const store = tx.objectStore(STORE);
        const req = fn(store);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        tx.oncomplete = () => db.close();
      })
  );
}

function readNamePartsFromLocalStorage(): { adj: string; num: number } | null {
  try {
    const raw = window.localStorage.getItem("poncho.nameParts");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed.adj === "string" &&
      typeof parsed.num === "number"
    ) {
      return { adj: parsed.adj, num: parsed.num };
    }
  } catch {
    // ignore
  }
  return null;
}

function readCharIdFromLocalStorage(): CharacterId {
  try {
    const raw = window.localStorage.getItem("poncho.character");
    if (raw && (CHARACTERS as readonly string[]).includes(raw)) {
      return raw as CharacterId;
    }
  } catch {
    // ignore
  }
  return DEFAULT_CHARACTER;
}

// Pull the most recent character + name parts from localStorage and the
// latest inventory from the live in-memory store (if any), then persist.
export async function saveGame(): Promise<SaveData> {
  const parts = readNamePartsFromLocalStorage();
  const charId = readCharIdFromLocalStorage();
  const inventory = getInventory();
  const data: SaveData = {
    adj: parts?.adj ?? "Sturdy",
    num: parts?.num ?? 42,
    charId,
    inventory,
    updatedAt: Date.now(),
  };
  await withStore("readwrite", (store) => store.put(data, SLOT));
  return data;
}

export async function loadGame(): Promise<SaveData | null> {
  try {
    const result = await withStore<SaveData | undefined>("readonly", (store) =>
      store.get(SLOT) as IDBRequest<SaveData | undefined>
    );
    return result ?? null;
  } catch {
    return null;
  }
}

// Live in-memory inventory, mirrored into IDB on save. Game systems can call
// addItem/removeItem to mutate. UI subscribes to refresh.
let inventory: InventoryItem[] = [];
const listeners = new Set<(items: InventoryItem[]) => void>();

export function getInventory(): InventoryItem[] {
  return inventory.slice();
}

export function setInventory(next: InventoryItem[]): void {
  inventory = next.slice();
  for (const cb of listeners) cb(getInventory());
}

export function addItem(item: InventoryItem): void {
  const existing = inventory.find((i) => i.id === item.id);
  if (existing) {
    existing.qty = (existing.qty ?? 1) + (item.qty ?? 1);
  } else {
    inventory.push({ ...item });
  }
  for (const cb of listeners) cb(getInventory());
}

// Convenience accessor for a single item count.
export function itemCount(id: string): number {
  const it = inventory.find((i) => i.id === id);
  return it ? it.qty ?? 1 : 0;
}

// Subtract qty of item id from the inventory. Returns true if there was
// enough to remove the requested amount (and the change was applied), false
// otherwise (inventory left unchanged).
export function removeItem(id: string, qty: number): boolean {
  const slot = inventory.find((i) => i.id === id);
  if (!slot || (slot.qty ?? 1) < qty) return false;
  slot.qty = (slot.qty ?? 1) - qty;
  if ((slot.qty ?? 0) <= 0) {
    inventory.splice(inventory.indexOf(slot), 1);
  }
  for (const cb of listeners) cb(getInventory());
  return true;
}

export function subscribeInventory(cb: (items: InventoryItem[]) => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

// Hydrate the in-memory inventory from the most recent save, if any.
export async function hydrateInventoryFromSave(): Promise<void> {
  const save = await loadGame();
  if (save?.inventory) {
    setInventory(save.inventory);
  }
}
