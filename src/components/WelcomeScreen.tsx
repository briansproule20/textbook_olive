"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CHARACTERS,
  CHARACTER_LABELS,
  DEFAULT_CHARACTER,
  saveSelectedCharacter,
  type CharacterId,
} from "@/game/sprites/characterTextures";
import {
  ADJECTIVES,
  ADJECTIVE_PATTERN,
  CUSTOM_NAME_PATTERN,
  saveNameParts,
} from "@/game/players/playerNames";

const PREVIEW_PX = 240;
const ATLAS_NATURAL = 1024;
const FRAME_NATURAL = 256;
const PREVIEW_RATIO = PREVIEW_PX / FRAME_NATURAL;

const COLORS = {
  bgOverlay: "rgba(8, 12, 9, 0.88)",
  card: "#11181a",
  cardBorder: "rgba(255,255,255,0.08)",
  field: "#0c1213",
  fieldBorder: "rgba(255,255,255,0.14)",
  fieldBorderFocus: "rgba(124, 191, 106, 0.55)",
  text: "#f5f7f5",
  muted: "rgba(245,247,245,0.55)",
  accent: "#7cbf6a",
  accentText: "#0c1c0a",
  danger: "#ff7676",
};

function DiceIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <circle cx="8" cy="8" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="16" cy="8" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="8" cy="16" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="16" cy="16" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

function Chevron({ dir, size = 28 }: { dir: "left" | "right"; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      {dir === "left" ? <polyline points="15 18 9 12 15 6" /> : <polyline points="9 18 15 12 9 6" />}
    </svg>
  );
}

interface Props {
  onComplete: () => void;
}

export default function WelcomeScreen({ onComplete }: Props) {
  const [adj, setAdj] = useState<string>(() => ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]);
  const [custom, setCustom] = useState<string>("");
  const [num, setNum] = useState<string>(() => String(Math.floor(Math.random() * 90) + 10));
  const [charIdx, setCharIdx] = useState<number>(() => CHARACTERS.indexOf(DEFAULT_CHARACTER));

  const charId: CharacterId = CHARACTERS[charIdx];
  const charLabel = CHARACTER_LABELS[charId];

  const adjValid = ADJECTIVE_PATTERN.test(adj.trim()) && adj.trim().length > 0;
  const numInt = parseInt(num, 10);
  const numValid = !Number.isNaN(numInt) && numInt >= 10 && numInt <= 99;
  const customTrim = custom.trim();
  const customValid = customTrim.length === 0 || CUSTOM_NAME_PATTERN.test(customTrim);
  const ready = adjValid && numValid && customValid;

  const middleName = customTrim.length > 0 ? customTrim : charLabel;
  const previewName = `${adj.trim() || "____"} ${middleName} ${numValid ? numInt : "__"}`;

  const rollAdj = useCallback(() => {
    let next = adj;
    while (next === adj) {
      next = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
    }
    setAdj(next);
  }, [adj]);

  const rollNum = useCallback(() => {
    let next = numInt;
    while (next === numInt || Number.isNaN(next)) {
      next = Math.floor(Math.random() * 90) + 10;
    }
    setNum(String(next));
  }, [numInt]);

  const prevChar = useCallback(() => {
    setCharIdx((i) => (i - 1 + CHARACTERS.length) % CHARACTERS.length);
  }, []);

  const nextChar = useCallback(() => {
    setCharIdx((i) => (i + 1) % CHARACTERS.length);
  }, []);

  const start = useCallback(() => {
    if (!ready) return;
    saveSelectedCharacter(charId);
    saveNameParts(adj.trim(), numInt, customTrim || undefined);
    try {
      window.localStorage.setItem("poncho.welcomeShown", "1");
    } catch {
      // ignore
    }
    onComplete();
  }, [ready, adj, numInt, customTrim, charId, onComplete]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        prevChar();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        nextChar();
      } else if (e.key === "Enter" && ready) {
        e.preventDefault();
        start();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prevChar, nextChar, ready, start]);

  // Real generated grass tile from the asset prep pipeline. Tiles are 128x64
  // 2:1 isometric — repeat them with a soft vignette so the preview looks
  // like the in-game ground without the welcome screen needing its own art.
  const sceneBg = useMemo(() => ({
    backgroundImage: `radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) 30%, rgba(0,0,0,0.45) 100%), url("/sprites/tiles/grass.png")`,
    backgroundSize: "auto, 128px 64px",
    backgroundRepeat: "no-repeat, repeat",
    imageRendering: "pixelated" as const,
  }), []);

  // Sprite cutout. Character body in the 256x256 frame is centered horizontally
  // and has its baseline at y≈246, so the body spans roughly y=40..246. To
  // visually center the body in the preview box, shift the atlas up so the
  // body midpoint lands at the box midpoint.
  const previewBg = useMemo(() => {
    const spritePx = ATLAS_NATURAL * PREVIEW_RATIO; // total atlas pixel size when rendered
    // Frame 0 (idle_se) sits at top-left of atlas. The body midpoint inside
    // that frame is ~y=143 (between top of head ~40 and baseline 246).
    const bodyMidYInFrame = 143;
    const offsetX = (PREVIEW_PX - FRAME_NATURAL * PREVIEW_RATIO) / 2;
    const offsetY = PREVIEW_PX / 2 - bodyMidYInFrame * PREVIEW_RATIO;
    return {
      backgroundImage: `url(/sprites/characters/${charId}/${charId}.png)`,
      backgroundSize: `${spritePx}px ${spritePx}px`,
      backgroundPosition: `${offsetX}px ${offsetY}px`,
      backgroundRepeat: "no-repeat",
      imageRendering: "pixelated" as const,
    };
  }, [charId]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: COLORS.bgOverlay,
        padding: 24,
        fontFamily: "system-ui, -apple-system, sans-serif",
        color: COLORS.text,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 720,
          background: COLORS.card,
          border: `1px solid ${COLORS.cardBorder}`,
          borderRadius: 20,
          padding: 32,
          boxShadow: "0 24px 60px rgba(0,0,0,0.55)",
          display: "flex",
          flexDirection: "column",
          gap: 28,
        }}
      >
        <header style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: 1.5, textTransform: "uppercase", color: COLORS.accent }}>
            Placeholder Hero
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: -0.4, margin: 0 }}>Build your character.</h1>
          <p style={{ fontSize: 14, color: COLORS.muted, margin: 0 }}>
            Pick an adjective, a sprite, and a number. Or roll the dice.
          </p>
        </header>

        {/* Sprite carousel — center stage */}
        <section style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.4, color: COLORS.muted, textTransform: "uppercase" }}>
            Sprite
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <button
              type="button"
              onClick={prevChar}
              aria-label="Previous sprite"
              style={iconButtonStyle()}
            >
              <Chevron dir="left" />
            </button>
            <div
              style={{
                width: PREVIEW_PX,
                height: PREVIEW_PX,
                background: COLORS.field,
                border: `1px solid ${COLORS.fieldBorder}`,
                borderRadius: 16,
                overflow: "hidden",
                position: "relative",
                ...sceneBg,
              }}
            >
              <div style={{ position: "absolute", inset: 0, ...previewBg }} />
            </div>
            <button
              type="button"
              onClick={nextChar}
              aria-label="Next sprite"
              style={iconButtonStyle()}
            >
              <Chevron dir="right" />
            </button>
          </div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{charLabel}</div>
          <div style={{ fontSize: 12, color: COLORS.muted }}>
            {charIdx + 1} / {CHARACTERS.length}
          </div>
        </section>

        {/* Adjective + (optional) Name + Number */}
        <section style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr 1fr", gap: 12 }}>
          <Field
            label="Adjective"
            value={adj}
            onChange={(v) => setAdj(v.replace(/[^a-zA-Z]/g, "").replace(/^./, (c) => c.toUpperCase()))}
            placeholder="Sturdy"
            valid={adjValid}
            onRoll={rollAdj}
            helperWhenInvalid="Letters only, capital first"
          />
          <Field
            label="Name (optional)"
            value={custom}
            onChange={(v) => setCustom(v.replace(/[^a-zA-Z' -]/g, "").replace(/^./, (c) => c.toUpperCase()).slice(0, 24))}
            placeholder={charLabel}
            valid={customValid}
            helperWhenInvalid="Letters, spaces, ' or -; capital first; ≤24"
            optional
          />
          <Field
            label="Number"
            value={num}
            onChange={(v) => setNum(v.replace(/\D/g, "").slice(0, 2))}
            placeholder="42"
            valid={numValid}
            onRoll={rollNum}
            helperWhenInvalid="10–99"
            inputMode="numeric"
          />
        </section>

        {/* Preview line */}
        <div
          style={{
            background: COLORS.field,
            border: `1px solid ${COLORS.fieldBorder}`,
            borderRadius: 10,
            padding: "12px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.2, color: COLORS.muted, textTransform: "uppercase", marginBottom: 4 }}>
              Your name
            </div>
            <div style={{ fontSize: 17, fontWeight: 700 }}>{previewName}</div>
          </div>
          {ready ? (
            <button
              type="button"
              onClick={start}
              style={{
                background: COLORS.accent,
                color: COLORS.accentText,
                border: "none",
                borderRadius: 10,
                padding: "12px 20px",
                fontSize: 14,
                fontWeight: 700,
                letterSpacing: 0.6,
                cursor: "pointer",
                boxShadow: "0 4px 16px rgba(124,191,106,0.35)",
              }}
            >
              Start game →
            </button>
          ) : (
            <div
              style={{
                padding: "12px 20px",
                fontSize: 13,
                fontWeight: 600,
                color: COLORS.muted,
                border: `1px dashed ${COLORS.fieldBorder}`,
                borderRadius: 10,
              }}
            >
              Finish all three
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface FieldProps {
  label: string;
  value: string;
  placeholder: string;
  valid: boolean;
  onChange: (v: string) => void;
  onRoll?: () => void;
  helperWhenInvalid: string;
  inputMode?: "text" | "numeric";
  optional?: boolean;
}

function Field({ label, value, placeholder, valid, onChange, onRoll, helperWhenInvalid, inputMode = "text", optional = false }: FieldProps) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.4, color: COLORS.muted, textTransform: "uppercase" }}>
        {label}
      </label>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          background: COLORS.field,
          border: `1px solid ${focused ? COLORS.fieldBorderFocus : COLORS.fieldBorder}`,
          borderRadius: 10,
          padding: "4px 4px 4px 14px",
          transition: "border-color 120ms",
        }}
      >
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          inputMode={inputMode}
          style={{
            flex: 1,
            background: "transparent",
            border: "none",
            outline: "none",
            color: COLORS.text,
            fontSize: 16,
            fontWeight: 600,
            fontFamily: "inherit",
            padding: "8px 0",
            minWidth: 0,
          }}
        />
        {onRoll && (
          <button
            type="button"
            onClick={onRoll}
            aria-label={`Random ${label.toLowerCase()}`}
            title={`Random ${label.toLowerCase()}`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 36,
              height: 36,
              background: "transparent",
              color: COLORS.text,
              border: `1px solid ${COLORS.fieldBorder}`,
              borderRadius: 8,
              cursor: "pointer",
            }}
          >
            <DiceIcon />
          </button>
        )}
      </div>
      <div style={{ minHeight: 16, fontSize: 11, color: valid ? COLORS.muted : COLORS.danger }}>
        {valid ? (optional ? "Defaults to the sprite's name" : " ") : helperWhenInvalid}
      </div>
    </div>
  );
}

function iconButtonStyle(): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 44,
    height: 44,
    background: "rgba(255,255,255,0.06)",
    color: COLORS.text,
    border: `1px solid ${COLORS.fieldBorder}`,
    borderRadius: 12,
    cursor: "pointer",
  };
}
