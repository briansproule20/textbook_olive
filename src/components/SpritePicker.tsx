"use client";

import { useEffect, useState } from "react";
import {
  CHARACTERS,
  CHARACTER_LABELS,
  DEFAULT_CHARACTER,
  loadSelectedCharacter,
  saveSelectedCharacter,
  type CharacterId,
} from "@/game/sprites/characterTextures";

export default function SpritePicker() {
  const [selected, setSelected] = useState<CharacterId>(DEFAULT_CHARACTER);

  useEffect(() => {
    setSelected(loadSelectedCharacter());
  }, []);

  const onChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value as CharacterId;
    if (id === selected) return;
    saveSelectedCharacter(id);
    window.location.reload();
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 12,
        left: 12,
        zIndex: 10,
        background: "rgba(20, 30, 22, 0.85)",
        borderRadius: 10,
        boxShadow: "0 2px 8px rgba(0,0,0,0.35)",
        padding: "6px 8px",
        fontFamily: "system-ui, sans-serif",
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      <span
        style={{
          color: "#7cbf6a",
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 0.6,
          textTransform: "uppercase",
        }}
      >
        Sprite
      </span>
      <select
        value={selected}
        onChange={onChange}
        style={{
          background: "transparent",
          color: "#fff",
          border: "1px solid rgba(255,255,255,0.2)",
          borderRadius: 6,
          padding: "5px 10px",
          fontSize: 13,
          fontWeight: 600,
          fontFamily: "system-ui, sans-serif",
          cursor: "pointer",
          outline: "none",
          appearance: "none",
          paddingRight: 24,
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6' fill='none' stroke='%23fff' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'><polyline points='1,1 5,5 9,1'/></svg>\")",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "right 8px center",
        }}
      >
        {CHARACTERS.map((id) => (
          <option key={id} value={id} style={{ background: "#1f2f24", color: "#fff" }}>
            {CHARACTER_LABELS[id]}
          </option>
        ))}
      </select>
    </div>
  );
}
