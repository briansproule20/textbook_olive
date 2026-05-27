"use client";

import { useEffect, useState } from "react";
import { itemCount, subscribeInventory } from "@/game/saves/saveGame";
import { onHarvest } from "@/game/events";
import { CHARACTER_LABELS, loadSelectedCharacter } from "@/game/sprites/characterTextures";

function readPlayerName(): string {
  try {
    const charId = loadSelectedCharacter();
    const label = CHARACTER_LABELS[charId];
    const raw = window.localStorage.getItem("poncho.nameParts");
    if (!raw) return label;
    const parsed = JSON.parse(raw) as { adj?: string; num?: number; custom?: string };
    const adj = typeof parsed.adj === "string" ? parsed.adj : "";
    const middle = parsed.custom && parsed.custom.length > 0 ? parsed.custom : label;
    const num = typeof parsed.num === "number" ? parsed.num : "";
    return `${adj} ${middle} ${num}`.trim();
  } catch {
    return "Player";
  }
}

const LOG_STROKE = "#c9a063";
const STONE_STROKE = "#9aa3ab";
const IRON_STROKE = "#e08b3c";

function LogIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={LOG_STROKE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="6" cy="12" rx="3" ry="9" />
      <path d="M6 3h12" />
      <path d="M6 21h12" />
      <path d="M18 3a3 9 0 0 1 0 18" />
      <ellipse cx="6" cy="12" rx="1.5" ry="6" />
    </svg>
  );
}

function StoneIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={STONE_STROKE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 17 L3 12 L8 5 L16 5 L21 12 L19 17 L16 19 L8 19 Z" />
      <path d="M8 5 L11 11 L16 11 L16 5" />
      <path d="M3 12 L11 11 L19 17" />
    </svg>
  );
}

function IronIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={IRON_STROKE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 18 L2 12 L7 5 L17 5 L22 12 L20 18 L16 20 L8 20 Z" />
      <path d="M7 9 L11 12 L9 16" />
      <path d="M15 8 L17 11 L14 14" />
    </svg>
  );
}

interface Popup {
  id: number;
  text: string;
}

const POPUP_LIFETIME_MS = 1100;

const PILLS: { id: string; label: string; icon: React.ReactNode }[] = [
  { id: "wood", label: "Wood", icon: <LogIcon /> },
  { id: "stone", label: "Stone", icon: <StoneIcon /> },
  { id: "iron", label: "Iron", icon: <IronIcon /> },
];

export default function ResourceHud() {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [popups, setPopups] = useState<Popup[]>([]);
  const [playerName, setPlayerName] = useState<string>("");

  useEffect(() => {
    setPlayerName(readPlayerName());
  }, []);

  useEffect(() => {
    const sync = () => {
      const next: Record<string, number> = {};
      for (const p of PILLS) next[p.id] = itemCount(p.id);
      setCounts(next);
    };
    sync();
    const off = subscribeInventory(sync);
    return off;
  }, []);

  useEffect(() => {
    let nextId = 1;
    const off = onHarvest((e) => {
      const labelMap: Record<string, string> = { wood: "wood", stone: "stone", iron: "iron" };
      const name = labelMap[e.itemId] ?? e.itemId;
      const id = nextId++;
      setPopups((prev) => [...prev, { id, text: `+${e.qty} ${name}` }]);
      window.setTimeout(() => {
        setPopups((prev) => prev.filter((p) => p.id !== id));
      }, POPUP_LIFETIME_MS);
    });
    return off;
  }, []);

  return (
    <>
      <div
        style={{
          position: "fixed",
          top: 60,
          left: 12,
          zIndex: 10,
          display: "flex",
          flexDirection: "column",
          gap: 6,
          fontFamily: "system-ui, sans-serif",
          pointerEvents: "none",
        }}
      >
        {playerName && (
          <div
            style={{
              padding: "8px 14px",
              background: "rgba(20, 30, 22, 0.92)",
              color: "#fff",
              borderRadius: 999,
              fontSize: 13,
              fontWeight: 800,
              letterSpacing: 0.3,
              boxShadow: "0 2px 8px rgba(0,0,0,0.35)",
              maxWidth: 240,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title={playerName}
          >
            {playerName}
          </div>
        )}
        {PILLS.map((p) => (
          <div
            key={p.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 14px",
              background: "rgba(20, 30, 22, 0.85)",
              color: "#fff",
              borderRadius: 999,
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: 0.4,
              boxShadow: "0 2px 8px rgba(0,0,0,0.35)",
              minWidth: 56,
            }}
          >
            {p.icon}
            <span>{counts[p.id] ?? 0}</span>
          </div>
        ))}
      </div>

      <div style={{ position: "fixed", inset: 0, zIndex: 9, pointerEvents: "none" }}>
        {popups.map((p) => (
          <PopupFloater key={p.id} popup={p} />
        ))}
      </div>
    </>
  );
}

function PopupFloater({ popup }: { popup: Popup }) {
  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "calc(50% - 60px)",
        transform: "translate(-50%, -50%)",
        color: "#fff7c0",
        fontFamily: "system-ui, sans-serif",
        fontWeight: 800,
        fontSize: 18,
        letterSpacing: 0.4,
        textShadow: "0 2px 6px rgba(0,0,0,0.7), 0 0 2px rgba(0,0,0,0.9)",
        animation: "poncho-wood-float 1.1s ease-out forwards",
      }}
    >
      {popup.text}
    </div>
  );
}
