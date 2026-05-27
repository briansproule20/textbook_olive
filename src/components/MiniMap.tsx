"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GRID_RADIUS, tileAt } from "@/game/world/tiles";

const GRASS_COLOR = "#6f9947";
const DIRT_COLOR = "#8a6a47";
const BORDER_COLOR = "#2d3520";
const PLAYER_COLOR = "#ffd24a";
const PLAYER_RING = "#1f1a08";

const SMALL_SIZE = 168;
const EXPANDED_SIZE = 560;

interface GameStatus {
  isoX: number;
  isoY: number;
}

function precomputeDirtPositions(): Int16Array {
  // Pre-iterate once: store flat (ix, iy) pairs for every dirt tile so we
  // don't call tileAt 10k times per render.
  const buf: number[] = [];
  for (let ix = -GRID_RADIUS; ix <= GRID_RADIUS; ix++) {
    for (let iy = -GRID_RADIUS; iy <= GRID_RADIUS; iy++) {
      if (tileAt(ix, iy).startsWith("dirt")) {
        buf.push(ix, iy);
      }
    }
  }
  return Int16Array.from(buf);
}

function drawMap(
  ctx: CanvasRenderingContext2D,
  size: number,
  dirt: Int16Array,
  playerIsoX: number,
  playerIsoY: number,
  hoverIso: { x: number; y: number } | null
): void {
  const span = GRID_RADIUS * 2 + 1;
  const tilePx = size / span;
  const ox = size / 2;
  const oy = size / 2;

  // Backdrop
  ctx.fillStyle = GRASS_COLOR;
  ctx.fillRect(0, 0, size, size);

  // Dirt cells
  ctx.fillStyle = DIRT_COLOR;
  const cellPx = Math.ceil(tilePx);
  for (let i = 0; i < dirt.length; i += 2) {
    const ix = dirt[i];
    const iy = dirt[i + 1];
    const px = ox + ix * tilePx - tilePx / 2;
    const py = oy + iy * tilePx - tilePx / 2;
    ctx.fillRect(Math.floor(px), Math.floor(py), cellPx, cellPx);
  }

  // Border
  ctx.strokeStyle = BORDER_COLOR;
  ctx.lineWidth = Math.max(2, size / 100);
  ctx.strokeRect(0, 0, size, size);

  // Hover crosshair (expanded only)
  if (hoverIso) {
    const hx = ox + hoverIso.x * tilePx;
    const hy = oy + hoverIso.y * tilePx;
    ctx.strokeStyle = "rgba(255,255,255,0.45)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, hy); ctx.lineTo(size, hy);
    ctx.moveTo(hx, 0); ctx.lineTo(hx, size);
    ctx.stroke();
  }

  // Player marker
  const px = ox + playerIsoX * tilePx;
  const py = oy + playerIsoY * tilePx;
  const r = Math.max(3, size / 60);
  ctx.fillStyle = PLAYER_RING;
  ctx.beginPath();
  ctx.arc(px, py, r + 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PLAYER_COLOR;
  ctx.beginPath();
  ctx.arc(px, py, r, 0, Math.PI * 2);
  ctx.fill();
}

export default function MiniMap() {
  const dirt = useMemo(() => precomputeDirtPositions(), []);
  const smallCanvasRef = useRef<HTMLCanvasElement>(null);
  const expandedCanvasRef = useRef<HTMLCanvasElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [hoverIso, setHoverIso] = useState<{ x: number; y: number } | null>(null);
  const playerRef = useRef({ isoX: 0, isoY: 0 });

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const w = window as unknown as { __gameStatus?: GameStatus };
      if (w.__gameStatus) {
        playerRef.current = {
          isoX: w.__gameStatus.isoX ?? 0,
          isoY: w.__gameStatus.isoY ?? 0,
        };
      }
      const small = smallCanvasRef.current?.getContext("2d");
      if (small) {
        drawMap(small, SMALL_SIZE, dirt, playerRef.current.isoX, playerRef.current.isoY, null);
      }
      if (expanded) {
        const big = expandedCanvasRef.current?.getContext("2d");
        if (big) {
          drawMap(big, EXPANDED_SIZE, dirt, playerRef.current.isoX, playerRef.current.isoY, hoverIso);
        }
      }
      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [dirt, expanded, hoverIso]);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded]);

  const onExpandedMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const span = GRID_RADIUS * 2 + 1;
    const tilePx = EXPANDED_SIZE / span;
    const ix = Math.round((px - EXPANDED_SIZE / 2) / tilePx);
    const iy = Math.round((py - EXPANDED_SIZE / 2) / tilePx);
    if (ix < -GRID_RADIUS || ix > GRID_RADIUS || iy < -GRID_RADIUS || iy > GRID_RADIUS) {
      setHoverIso(null);
    } else {
      setHoverIso({ x: ix, y: iy });
    }
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setExpanded(true)}
        title="Open map (M / click)"
        style={{
          position: "fixed",
          bottom: 12,
          left: 12,
          zIndex: 10,
          padding: 6,
          background: "rgba(20, 30, 22, 0.85)",
          border: "1px solid rgba(255,255,255,0.15)",
          borderRadius: 12,
          boxShadow: "0 2px 8px rgba(0,0,0,0.35)",
          cursor: "pointer",
          lineHeight: 0,
        }}
      >
        <canvas ref={smallCanvasRef} width={SMALL_SIZE} height={SMALL_SIZE} style={{ display: "block", borderRadius: 6 }} />
      </button>

      {expanded && (
        <div
          onClick={() => setExpanded(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.65)",
            zIndex: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "zoom-out",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "relative",
              padding: 12,
              background: "rgba(20, 30, 22, 0.95)",
              borderRadius: 16,
              boxShadow: "0 12px 40px rgba(0,0,0,0.6)",
              cursor: "default",
            }}
          >
            <canvas
              ref={expandedCanvasRef}
              width={EXPANDED_SIZE}
              height={EXPANDED_SIZE}
              onMouseMove={onExpandedMove}
              onMouseLeave={() => setHoverIso(null)}
              style={{ display: "block", borderRadius: 8, cursor: "crosshair" }}
            />
            <div
              style={{
                position: "absolute",
                top: 20,
                right: 20,
                padding: "6px 12px",
                background: "rgba(20,30,22,0.9)",
                color: "#fff",
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 700,
                fontFamily: "system-ui, sans-serif",
                letterSpacing: 0.4,
              }}
            >
              {hoverIso ? `${hoverIso.x}, ${hoverIso.y}` : "—, —"}
            </div>
            <div
              style={{
                position: "absolute",
                bottom: 20,
                left: 20,
                fontSize: 11,
                fontWeight: 600,
                color: "rgba(255,255,255,0.55)",
                letterSpacing: 0.5,
                fontFamily: "system-ui, sans-serif",
              }}
            >
              click outside or press ESC to close
            </div>
          </div>
        </div>
      )}
    </>
  );
}
