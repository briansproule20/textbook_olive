// Lightweight pub/sub for cross-cutting game events that the React HUD layer
// needs to listen for (harvest popups, etc.). Phaser → React, one direction.

export interface HarvestEvent {
  itemId: string;
  qty: number;
  // Screen position where the popup should anchor (game world coords are fine;
  // the HUD overlay tracks player position via window.__gameStatus already).
  screenX: number;
  screenY: number;
}

type Listener<T> = (e: T) => void;

const harvestListeners = new Set<Listener<HarvestEvent>>();

export function emitHarvest(e: HarvestEvent): void {
  for (const cb of harvestListeners) cb(e);
}

export function onHarvest(cb: Listener<HarvestEvent>): () => void {
  harvestListeners.add(cb);
  return () => {
    harvestListeners.delete(cb);
  };
}
