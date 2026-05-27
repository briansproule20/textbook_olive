"use client";

import { useCallback, useEffect, useState } from "react";
import { saveGame } from "@/game/saves/saveGame";

const COLORS = {
  overlay: "rgba(8, 12, 9, 0.78)",
  card: "#11181a",
  cardBorder: "rgba(255,255,255,0.08)",
  divider: "rgba(255,255,255,0.06)",
  field: "#0c1213",
  fieldBorder: "rgba(255,255,255,0.10)",
  text: "#f5f7f5",
  muted: "rgba(245,247,245,0.55)",
  accent: "#7cbf6a",
  accentText: "#0c1c0a",
  danger: "#ff7676",
};

function setMenuOpenFlag(open: boolean): void {
  (window as unknown as { __menuOpen?: boolean }).__menuOpen = open;
}

function inventoryOpen(): boolean {
  return (window as unknown as { __inventoryOpen?: boolean }).__inventoryOpen === true;
}

export default function MainMenuModal() {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Don't react if user is typing in a field somewhere
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) return;

      if (e.key === "Escape") {
        // If inventory is open, let it handle ESC. Otherwise toggle menu.
        if (inventoryOpen() && !open) return;
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    setMenuOpenFlag(open);
    if (!open) {
      setConfirmReset(false);
      setSaving(false);
    }
    return () => setMenuOpenFlag(false);
  }, [open]);

  const close = useCallback(() => setOpen(false), []);

  const onSave = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    try {
      const result = await saveGame();
      setSavedAt(result.updatedAt);
    } catch {
      // ignore for skeleton
    } finally {
      setSaving(false);
    }
  }, [saving]);

  const onEditCharacter = useCallback(() => {
    try {
      // Send the user back to the welcome screen. Keep nameParts + character so
      // the screen can pre-populate. Clearing the welcomeShown flag is enough.
      window.localStorage.removeItem("poncho.welcomeShown");
    } catch {
      // ignore
    }
    window.location.reload();
  }, []);

  const onReset = useCallback(async () => {
    try {
      window.localStorage.removeItem("poncho.welcomeShown");
      window.localStorage.removeItem("poncho.nameParts");
      window.localStorage.removeItem("poncho.character");
      window.localStorage.removeItem("poncho.localName");
      // Wipe IndexedDB save slot
      const req = indexedDB.deleteDatabase("poncho-save");
      await new Promise<void>((resolve) => {
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
        req.onblocked = () => resolve();
      });
    } catch {
      // ignore
    }
    window.location.reload();
  }, []);

  if (!open) return null;

  return (
    <div
      onClick={close}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
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
          maxWidth: 420,
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
              Menu
            </div>
            <h2 style={{ margin: "4px 0 0", fontSize: 20, fontWeight: 700, letterSpacing: -0.2 }}>
              Game Menu
            </h2>
          </div>
          <button
            type="button"
            onClick={close}
            style={{
              background: "transparent",
              border: `1px solid ${COLORS.fieldBorder}`,
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

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <MenuButton
            label={saving ? "Saving…" : savedAt ? "Save Game ✓" : "Save Game"}
            description="Persist your character and inventory."
            onClick={onSave}
            disabled={saving}
            primary
          />
          <MenuButton
            label="Edit Character"
            description="Rename or change sprite — back to character setup."
            onClick={onEditCharacter}
          />
          <MenuButton
            label="Settings"
            description="Coming soon."
            onClick={() => undefined}
            disabled
          />
          <div style={{ height: 1, background: COLORS.divider, margin: "4px 0" }} />
          {confirmReset ? (
            <div
              style={{
                display: "flex",
                gap: 8,
                alignItems: "center",
                padding: "10px 12px",
                background: "rgba(255,118,118,0.08)",
                border: `1px solid rgba(255,118,118,0.35)`,
                borderRadius: 10,
              }}
            >
              <div style={{ flex: 1, fontSize: 12, color: COLORS.text }}>
                Wipe save & restart? Inventory and character are lost.
              </div>
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                style={{
                  background: "transparent",
                  color: COLORS.muted,
                  border: `1px solid ${COLORS.fieldBorder}`,
                  borderRadius: 8,
                  padding: "6px 12px",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onReset}
                style={{
                  background: COLORS.danger,
                  color: "#260a0a",
                  border: "none",
                  borderRadius: 8,
                  padding: "6px 12px",
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                Reset
              </button>
            </div>
          ) : (
            <MenuButton
              label="Reset Game"
              description="Wipe save and start over."
              onClick={() => setConfirmReset(true)}
              danger
            />
          )}
        </div>
      </div>
    </div>
  );
}

interface MenuButtonProps {
  label: string;
  description: string;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
  danger?: boolean;
}

function MenuButton({ label, description, onClick, disabled, primary, danger }: MenuButtonProps) {
  const base = {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "flex-start",
    gap: 2,
    padding: "12px 14px",
    background: COLORS.field,
    border: `1px solid ${COLORS.fieldBorder}`,
    borderRadius: 10,
    color: COLORS.text,
    cursor: disabled ? "default" : "pointer",
    textAlign: "left" as const,
    fontFamily: "inherit",
    opacity: disabled ? 0.5 : 1,
    transition: "border-color 120ms, background 120ms",
  };
  if (primary) {
    base.background = COLORS.accent;
    base.color = COLORS.accentText;
    base.border = "none";
  }
  if (danger) {
    base.color = COLORS.danger;
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled} style={base}>
      <span style={{ fontSize: 14, fontWeight: 800, letterSpacing: 0.2 }}>{label}</span>
      <span style={{ fontSize: 11, fontWeight: 500, opacity: 0.85 }}>{description}</span>
    </button>
  );
}
