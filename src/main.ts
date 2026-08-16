import Phaser from "phaser";
import "./styles.css";
import { gameConfig } from "./game/config";

const game = new Phaser.Game(gameConfig);

window.addEventListener("beforeunload", () => game.destroy(true));
