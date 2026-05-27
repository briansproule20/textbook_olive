"use client";

import { useCallback, useEffect, useState } from "react";
import { saveGame } from "@/game/saves/saveGame";

const STROKE = "#7cbf6a";

function DiskIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={STROKE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <polyline points="17 21 17 13 7 13 7 21" />
      <polyline points="7 3 7 8 15 8" />
    </svg>
  );
}

function formatAgo(ms: number): string {
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}

export default function SaveGameButton() {
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!savedAt) return;
    const id = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [savedAt]);

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

  // Ctrl/Cmd+S → save
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void onSave();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onSave]);

  void tick;

  return (
    <div
      style={{
        position: "fixed",
        top: 12,
        right: 12,
        zIndex: 11,
        display: "flex",
        alignItems: "center",
        gap: 8,
        fontFamily: "system-ui, sans-serif",
      }}
    >
      {savedAt !== null && (
        <div
          style={{
            padding: "6px 10px",
            background: "rgba(20, 30, 22, 0.85)",
            color: "rgba(245,247,245,0.7)",
            borderRadius: 999,
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: 0.3,
            boxShadow: "0 2px 8px rgba(0,0,0,0.35)",
          }}
        >
          Saved {formatAgo(savedAt)}
        </div>
      )}
      <button
        type="button"
        onClick={onSave}
        disabled={saving}
        title="Save game (Ctrl/Cmd+S)"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 14px",
          background: "rgba(20, 30, 22, 0.92)",
          color: "#fff",
          border: `1px solid rgba(124,191,106,0.35)`,
          borderRadius: 999,
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: 0.4,
          cursor: saving ? "default" : "pointer",
          boxShadow: "0 2px 8px rgba(0,0,0,0.35)",
          opacity: saving ? 0.65 : 1,
        }}
      >
        <DiskIcon />
        <span>{saving ? "Saving…" : "Save"}</span>
      </button>
    </div>
  );
}
