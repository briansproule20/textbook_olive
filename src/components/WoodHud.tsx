"use client";

import { useEffect, useState } from "react";
import { itemCount, subscribeInventory } from "@/game/saves/saveGame";
import { onHarvest } from "@/game/events";

const STROKE = "#c9a063";

function LogIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={STROKE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="6" cy="12" rx="3" ry="9" />
      <path d="M6 3h12" />
      <path d="M6 21h12" />
      <path d="M18 3a3 9 0 0 1 0 18" />
      <ellipse cx="6" cy="12" rx="1.5" ry="6" />
    </svg>
  );
}

interface Popup {
  id: number;
  text: string;
  bornAt: number;
}

const POPUP_LIFETIME_MS = 1100;

export default function WoodHud() {
  const [wood, setWood] = useState(0);
  const [popups, setPopups] = useState<Popup[]>([]);

  useEffect(() => {
    setWood(itemCount("wood"));
    const off = subscribeInventory(() => setWood(itemCount("wood")));
    return off;
  }, []);

  useEffect(() => {
    let nextId = 1;
    const off = onHarvest((e) => {
      if (e.itemId !== "wood") return;
      const id = nextId++;
      setPopups((prev) => [...prev, { id, text: `+${e.qty} wood`, bornAt: Date.now() }]);
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
          pointerEvents: "none",
        }}
      >
        <LogIcon />
        <span>{wood}</span>
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
  // Camera follows the player, so the player is always near screen center.
  // Anchor popups slightly above center and let CSS animate the float-up + fade.
  void popup.bornAt;
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
