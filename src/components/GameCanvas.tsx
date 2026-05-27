"use client";

import { useEffect, useRef, useState } from "react";
import BuildMenu from "./BuildMenu";
import Hud from "./Hud";
import InventoryModal from "./InventoryModal";
import MainMenuModal from "./MainMenuModal";
import MiniMap from "./MiniMap";
import SaveGameButton from "./SaveGameButton";
import SpritePicker from "./SpritePicker";
import ResourceHud from "./ResourceHud";
import WelcomeScreen from "./WelcomeScreen";

export default function GameCanvas() {
  const rootRef = useRef<HTMLDivElement>(null);
  const destroyRef = useRef<(() => void) | null>(null);
  const [welcomeChecked, setWelcomeChecked] = useState(false);
  const [welcomeDone, setWelcomeDone] = useState(false);

  useEffect(() => {
    try {
      setWelcomeDone(window.localStorage.getItem("poncho.welcomeShown") === "1");
    } catch {
      setWelcomeDone(false);
    }
    setWelcomeChecked(true);
  }, []);

  useEffect(() => {
    if (!welcomeDone) return;
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
  }, [welcomeDone]);

  if (!welcomeChecked) return null;

  if (!welcomeDone) {
    return <WelcomeScreen onComplete={() => setWelcomeDone(true)} />;
  }

  return (
    <>
      <div id="game-root" ref={rootRef} />
      <SpritePicker />
      <SaveGameButton />
      <Hud />
      <ResourceHud />
      <MiniMap />
      <BuildMenu />
      <InventoryModal />
      <MainMenuModal />
    </>
  );
}
