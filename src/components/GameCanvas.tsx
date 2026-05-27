"use client";

import { useEffect, useRef } from "react";
import Hud from "./Hud";
import SpritePicker from "./SpritePicker";

export default function GameCanvas() {
  const rootRef = useRef<HTMLDivElement>(null);
  const destroyRef = useRef<(() => void) | null>(null);

  useEffect(() => {
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

  return (
    <>
      <div id="game-root" ref={rootRef} />
      <SpritePicker />
      <Hud />
    </>
  );
}
