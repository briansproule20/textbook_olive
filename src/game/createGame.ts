import Phaser from "phaser";
import { GameScene } from "./scenes/GameScene";

export async function createGame(parent: HTMLElement): Promise<Phaser.Game> {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: "#6f9947",
    scale: {
      mode: Phaser.Scale.RESIZE,
      width: parent.clientWidth || window.innerWidth,
      height: parent.clientHeight || window.innerHeight,
    },
    pixelArt: true,
    roundPixels: true,
    render: { antialias: false, pixelArt: true, roundPixels: true },
    scene: [GameScene],
  });
  return game;
}
