"use client";

import { useEffect, useState } from "react";
import {
  CHARACTERS,
  DEFAULT_CHARACTER,
  loadSelectedCharacter,
  saveSelectedCharacter,
  type CharacterId,
} from "@/game/sprites/characterTextures";

interface GameStatus {
  action: string;
  facing: string;
  speed: number;
  x: number;
  y: number;
  fps: number;
}

const DEFAULT_STATUS: GameStatus = {
  action: "IDLE",
  facing: "SE",
  speed: 0,
  x: 0,
  y: 0,
  fps: 0,
};

const STROKE = "#7cbf6a";

function PulseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={STROKE} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12h4l2-7 4 14 2-7h6" />
    </svg>
  );
}

function CompassIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={STROKE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <polygon points="15.5,8.5 11,11 8.5,15.5 13,13" fill={STROKE} stroke="none" />
    </svg>
  );
}

function SpeedIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={STROKE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 19a9 9 0 1 1 14 0" />
      <path d="M12 14l4-4" />
    </svg>
  );
}

function CrosshairIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={STROKE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="8" />
      <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
      <circle cx="12" cy="12" r="1.5" fill={STROKE} stroke="none" />
    </svg>
  );
}

interface PillProps {
  icon?: React.ReactNode;
  label: string;
}

function Pill({ icon, label }: PillProps) {
  return (
    <div
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
        fontFamily: "system-ui, sans-serif",
        boxShadow: "0 2px 8px rgba(0,0,0,0.35)",
      }}
    >
      {icon}
      <span>{label}</span>
    </div>
  );
}

const CHAR_LABEL: Record<CharacterId, string> = {
  poncho: "Poncho",
  cat: "Cat",
  aussie: "Aussie",
  penguin: "Penguin",
  "black-lab": "Black Lab",
  "yellow-lab": "Yellow Lab",
  "brown-lab": "Brown Lab",
  pug: "Pug",
  "brown-tabby": "Brown Tabby",
  "orange-tabby": "Orange Tabby",
};

export default function Hud() {
  const [status, setStatus] = useState<GameStatus>(DEFAULT_STATUS);
  const [selected, setSelected] = useState<CharacterId>(DEFAULT_CHARACTER);

  useEffect(() => {
    setSelected(loadSelectedCharacter());
  }, []);

  const pick = (id: CharacterId) => {
    if (id === selected) return;
    saveSelectedCharacter(id);
    window.location.reload();
  };

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const w = window as unknown as { __gameStatus?: GameStatus };
      if (w.__gameStatus) {
        const s = w.__gameStatus;
        setStatus((prev) =>
          prev.action === s.action &&
          prev.facing === s.facing &&
          prev.speed === s.speed &&
          prev.x === s.x &&
          prev.y === s.y &&
          prev.fps === s.fps
            ? prev
            : { ...s }
        );
      }
      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        top: 12,
        right: 12,
        zIndex: 10,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: 8,
      }}
    >
      <div style={{ display: "flex", gap: 8, pointerEvents: "none" }}>
        <Pill icon={<PulseIcon />} label={status.action} />
        <Pill icon={<CompassIcon />} label={status.facing} />
        <Pill icon={<CrosshairIcon />} label={`${status.x}, ${status.y}`} />
        <Pill label={`${status.fps} FPS`} />
      </div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "flex-end",
          gap: 6,
          padding: 6,
          maxWidth: "min(560px, calc(100vw - 24px))",
          background: "rgba(20, 30, 22, 0.85)",
          borderRadius: 14,
          boxShadow: "0 2px 8px rgba(0,0,0,0.35)",
        }}
      >
        {CHARACTERS.map((id) => {
          const active = id === selected;
          return (
            <button
              key={id}
              onClick={() => pick(id)}
              style={{
                padding: "6px 14px",
                background: active ? "#7cbf6a" : "transparent",
                color: active ? "#0e1a10" : "#fff",
                border: "none",
                borderRadius: 999,
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: 0.4,
                fontFamily: "system-ui, sans-serif",
              }}
            >
              {CHAR_LABEL[id]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
