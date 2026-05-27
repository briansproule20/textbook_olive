"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getInventory,
  hydrateInventoryFromSave,
  subscribeInventory,
  type InventoryItem,
} from "@/game/saves/saveGame";

const SLOTS = 24;

const COLORS = {
  overlay: "rgba(8, 12, 9, 0.78)",
  card: "#11181a",
  cardBorder: "rgba(255,255,255,0.08)",
  slot: "#0c1213",
  slotBorder: "rgba(255,255,255,0.10)",
  text: "#f5f7f5",
  muted: "rgba(245,247,245,0.55)",
  accent: "#7cbf6a",
};

// Phaser scene reads this flag in update() and short-circuits movement so
// pressing E / WASD inside the modal doesn't move the character.
function setInventoryOpenFlag(open: boolean): void {
  (window as unknown as { __inventoryOpen?: boolean }).__inventoryOpen = open;
}

export default function InventoryModal() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<InventoryItem[]>([]);

  useEffect(() => {
    void hydrateInventoryFromSave().then(() => setItems(getInventory()));
    const off = subscribeInventory((next) => setItems(next));
    return off;
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Ignore keystrokes while the user is typing in an input/textarea/etc.
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) return;

      if (e.key === "e" || e.key === "E") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape" && open) {
        e.preventDefault();
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    setInventoryOpenFlag(open);
    return () => setInventoryOpenFlag(false);
  }, [open]);

  const close = useCallback(() => setOpen(false), []);

  if (!open) return null;

  const padded: (InventoryItem | null)[] = [...items];
  while (padded.length < SLOTS) padded.push(null);

  return (
    <div
      onClick={close}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        background: COLORS.overlay,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 560,
          background: COLORS.card,
          border: `1px solid ${COLORS.cardBorder}`,
          borderRadius: 16,
          padding: 24,
          color: COLORS.text,
          boxShadow: "0 24px 60px rgba(0,0,0,0.55)",
          display: "flex",
          flexDirection: "column",
          gap: 18,
        }}
      >
        <header style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.4, color: COLORS.accent, textTransform: "uppercase" }}>
              Inventory
            </div>
            <h2 style={{ margin: "4px 0 0", fontSize: 20, fontWeight: 700, letterSpacing: -0.2 }}>
              {items.length === 0 ? "Empty" : `${items.length} item${items.length === 1 ? "" : "s"}`}
            </h2>
          </div>
          <button
            type="button"
            onClick={close}
            style={{
              background: "transparent",
              border: `1px solid ${COLORS.slotBorder}`,
              color: COLORS.muted,
              borderRadius: 8,
              padding: "6px 10px",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 0.6,
              cursor: "pointer",
            }}
          >
            ESC
          </button>
        </header>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(6, 1fr)",
            gap: 8,
          }}
        >
          {padded.map((item, idx) => (
            <Slot key={idx} item={item} />
          ))}
        </div>

        <footer style={{ fontSize: 11, color: COLORS.muted, letterSpacing: 0.3 }}>
          Press <KeyTag>E</KeyTag> to toggle. Items persist with <KeyTag>Save</KeyTag>.
        </footer>
      </div>
    </div>
  );
}

const ITEM_ICONS: Record<string, string> = {
  wood: "/sprites/objects/tree.png",
  stone: "/sprites/objects/stone.png",
};

function Slot({ item }: { item: InventoryItem | null }) {
  const iconUrl = item ? ITEM_ICONS[item.id] : undefined;
  return (
    <div
      style={{
        aspectRatio: "1 / 1",
        background: COLORS.slot,
        border: `1px solid ${COLORS.slotBorder}`,
        borderRadius: 10,
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: COLORS.muted,
        fontSize: 11,
        fontWeight: 600,
        textAlign: "center",
        padding: 4,
        overflow: "hidden",
      }}
    >
      {item ? (
        <>
          {iconUrl ? (
            <div
              style={{
                width: "78%",
                height: "78%",
                backgroundImage: `url(${iconUrl})`,
                backgroundSize: "contain",
                backgroundRepeat: "no-repeat",
                backgroundPosition: "center",
                imageRendering: "pixelated",
              }}
              title={item.label}
            />
          ) : (
            <span style={{ color: COLORS.text, fontSize: 12 }}>{item.label}</span>
          )}
          {item.qty !== undefined && item.qty > 1 && (
            <span
              style={{
                position: "absolute",
                bottom: 4,
                right: 6,
                fontSize: 11,
                fontWeight: 800,
                color: "#fff",
                background: "rgba(0,0,0,0.55)",
                padding: "1px 5px",
                borderRadius: 6,
                lineHeight: 1.2,
              }}
            >
              ×{item.qty}
            </span>
          )}
        </>
      ) : null}
    </div>
  );
}

function KeyTag({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "1px 6px",
        background: "rgba(255,255,255,0.06)",
        border: `1px solid ${COLORS.slotBorder}`,
        borderRadius: 4,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: 0.6,
        color: COLORS.text,
        margin: "0 2px",
      }}
    >
      {children}
    </span>
  );
}
