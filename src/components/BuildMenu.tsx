"use client";

import { useCallback, useEffect, useState } from "react";
import { BUILDING_TYPES, type BuildingType } from "@/game/world/buildings";

const COLORS = {
  overlay: "rgba(8, 12, 9, 0.78)",
  card: "#11181a",
  cardBorder: "rgba(255,255,255,0.08)",
  field: "#0c1213",
  fieldBorder: "rgba(255,255,255,0.10)",
  text: "#f5f7f5",
  muted: "rgba(245,247,245,0.55)",
  accent: "#7cbf6a",
  accentText: "#0c1c0a",
};

// Phaser scene reads these to know if it should render a placement ghost and
// listen for placement clicks.
function setPlacingBuilding(typeId: string | null): void {
  (window as unknown as { __placingBuilding?: string | null }).__placingBuilding = typeId;
}
function getPlacingBuilding(): string | null {
  return (window as unknown as { __placingBuilding?: string | null }).__placingBuilding ?? null;
}
function setMenuOpen(open: boolean): void {
  (window as unknown as { __buildMenuOpen?: boolean }).__buildMenuOpen = open;
}
function inventoryOpen(): boolean {
  return (window as unknown as { __inventoryOpen?: boolean }).__inventoryOpen === true;
}
function mainMenuOpen(): boolean {
  return (window as unknown as { __menuOpen?: boolean }).__menuOpen === true;
}

function HammerIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#c9a063" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 3 L20 3 L20 9 L17 9 L17 12 L14 12 Z" />
      <path d="M14 8 L4 18 L7 21 L17 11" />
    </svg>
  );
}

export default function BuildMenu() {
  const [open, setOpen] = useState(false);
  const [placing, setPlacing] = useState<string | null>(null);

  useEffect(() => {
    setMenuOpen(open);
    return () => setMenuOpen(false);
  }, [open]);

  // Open on B (when nothing else is open) and ESC to cancel placement or close.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) return;
      if (e.key === "b" || e.key === "B") {
        if (inventoryOpen() || mainMenuOpen()) return;
        e.preventDefault();
        if (placing) {
          setPlacing(null);
          setPlacingBuilding(null);
          return;
        }
        setOpen((o) => !o);
      } else if (e.key === "Escape" && placing) {
        e.preventDefault();
        setPlacing(null);
        setPlacingBuilding(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [placing]);

  // Poll for placement completion: GameScene clears __placingBuilding once a
  // building is placed. Sync local state back so the React UI exits placement.
  useEffect(() => {
    if (!placing) return;
    const id = window.setInterval(() => {
      if (getPlacingBuilding() === null) {
        setPlacing(null);
      }
    }, 100);
    return () => window.clearInterval(id);
  }, [placing]);

  const startPlacing = useCallback((type: BuildingType) => {
    setOpen(false);
    setPlacing(type.id);
    setPlacingBuilding(type.id);
  }, []);

  const cancelPlacing = useCallback(() => {
    setPlacing(null);
    setPlacingBuilding(null);
  }, []);

  return (
    <>
      {/* Build button — sits above the mini-map (mini-map is 168px + padding at bottom-left). */}
      <button
        type="button"
        onClick={() => {
          if (placing) {
            cancelPlacing();
            return;
          }
          setOpen((o) => !o);
        }}
        title={placing ? "Cancel placement (ESC)" : "Build (B)"}
        style={{
          position: "fixed",
          bottom: 204,
          left: 12,
          zIndex: 10,
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 14px",
          background: placing ? "#ff7676" : "rgba(20, 30, 22, 0.92)",
          color: placing ? "#260a0a" : "#fff",
          border: `1px solid ${placing ? "rgba(0,0,0,0.2)" : "rgba(124,191,106,0.35)"}`,
          borderRadius: 999,
          fontSize: 13,
          fontWeight: 800,
          letterSpacing: 0.4,
          cursor: "pointer",
          boxShadow: "0 2px 8px rgba(0,0,0,0.35)",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <HammerIcon />
        <span>{placing ? "Cancel" : "Build"}</span>
      </button>

      {/* Placement HUD banner */}
      {placing && (
        <div
          style={{
            position: "fixed",
            top: 12,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 11,
            padding: "10px 18px",
            background: "rgba(20, 30, 22, 0.92)",
            border: "1px solid rgba(124,191,106,0.45)",
            borderRadius: 999,
            color: "#fff",
            fontFamily: "system-ui, sans-serif",
            fontSize: 13,
            fontWeight: 700,
            boxShadow: "0 2px 12px rgba(0,0,0,0.45)",
          }}
        >
          Placing: {BUILDING_TYPES.find((b) => b.id === placing)?.label ?? placing} — click an empty tile · ESC cancels
        </div>
      )}

      {open && (
        <div
          onClick={() => setOpen(false)}
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
              maxWidth: 520,
              background: COLORS.card,
              border: `1px solid ${COLORS.cardBorder}`,
              borderRadius: 16,
              padding: 24,
              color: COLORS.text,
              boxShadow: "0 24px 60px rgba(0,0,0,0.55)",
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            <header style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.4, color: COLORS.accent, textTransform: "uppercase" }}>
                  Build
                </div>
                <h2 style={{ margin: "4px 0 0", fontSize: 20, fontWeight: 700 }}>
                  Choose a building
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                style={{
                  background: "transparent",
                  border: `1px solid ${COLORS.fieldBorder}`,
                  color: COLORS.muted,
                  borderRadius: 8,
                  padding: "6px 10px",
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                B
              </button>
            </header>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {BUILDING_TYPES.map((t) => (
                <button
                  type="button"
                  key={t.id}
                  onClick={() => startPlacing(t)}
                  style={{
                    display: "flex",
                    gap: 12,
                    padding: 12,
                    background: COLORS.field,
                    border: `1px solid ${COLORS.fieldBorder}`,
                    borderRadius: 10,
                    color: COLORS.text,
                    textAlign: "left",
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  <div
                    style={{
                      width: 56,
                      height: 56,
                      flex: "0 0 56px",
                      background: `#0c1213 url(${t.spritePath}) center/contain no-repeat`,
                      borderRadius: 8,
                      imageRendering: "pixelated",
                    }}
                  />
                  <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 800 }}>{t.label}</div>
                    <div style={{ fontSize: 11, color: COLORS.muted, lineHeight: 1.3 }}>
                      {t.description}
                    </div>
                    <div style={{ fontSize: 10, color: COLORS.muted, marginTop: 2, letterSpacing: 0.3 }}>
                      {t.w}×{t.h} footprint
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
