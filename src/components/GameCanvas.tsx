"use client";

import { useEffect, useRef, useState } from "react";
import {
  CHARACTERS,
  DEFAULT_CHARACTER,
  loadSelectedCharacter,
  saveSelectedCharacter,
  type CharacterId,
} from "@/game/sprites/characterTextures";

export default function GameCanvas() {
  const rootRef = useRef<HTMLDivElement>(null);
  const destroyRef = useRef<(() => void) | null>(null);
  const [selected, setSelected] = useState<CharacterId>(DEFAULT_CHARACTER);

  useEffect(() => {
    setSelected(loadSelectedCharacter());
    let cancelled = false;
    (async () => {
      if (!rootRef.current) return;
      const { createGame } = await import("@/game/createGame");
      if (cancelled || !rootRef.current) return;
      const game = await createGame(rootRef.current);
      destroyRef.current = () => game.destroy(true);
    })();
    return () => {
      cancelled = true;
      if (destroyRef.current) {
        destroyRef.current();
        destroyRef.current = null;
      }
    };
  }, []);

  const pick = (id: CharacterId) => {
    if (id === selected) return;
    saveSelectedCharacter(id);
    window.location.reload();
  };

  return (
    <>
      <div id="game-root" ref={rootRef} />
      <div
        style={{
          position: "fixed",
          top: 12,
          left: 12,
          zIndex: 10,
          display: "flex",
          gap: 6,
          padding: 6,
          background: "rgba(0,0,0,0.55)",
          borderRadius: 8,
          fontFamily: "system-ui, sans-serif",
          fontSize: 12,
          color: "#fff",
        }}
      >
        {CHARACTERS.map((id) => {
          const active = id === selected;
          return (
            <button
              key={id}
              onClick={() => pick(id)}
              style={{
                padding: "4px 10px",
                background: active ? "#ffd27a" : "rgba(255,255,255,0.12)",
                color: active ? "#000" : "#fff",
                border: "1px solid rgba(255,255,255,0.25)",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: 12,
                textTransform: "capitalize",
              }}
            >
              {id}
            </button>
          );
        })}
      </div>
    </>
  );
}
