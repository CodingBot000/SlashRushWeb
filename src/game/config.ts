import Phaser from "phaser";
import { BootScene } from "./scenes/BootScene";
import { GameScene } from "./scenes/GameScene";

export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: "app",
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: "#060914",
  render: {
    antialias: true,
    roundPixels: true,
    powerPreference: "high-performance",
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
  },
  input: {
    activePointers: 3,
  },
  physics: {
    default: "arcade",
    arcade: {
      gravity: { x: 0, y: 1550 },
      debug: false,
    },
  },
  scene: [BootScene, GameScene],
};
