import Phaser from "phaser";

function texture(scene: Phaser.Scene, key: string, width: number, height: number, draw: (g: Phaser.GameObjects.Graphics) => void) {
  const g = scene.make.graphics({ x: 0, y: 0 });
  draw(g);
  g.generateTexture(key, width, height);
  g.destroy();
}

export class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  create() {
    if (!this.textures.exists("player")) {
      texture(this, "player", 96, 128, (g) => {
        g.fillStyle(0x13182d, 1);
        g.fillRoundedRect(26, 28, 44, 70, 14);
        g.fillStyle(0x6ae8ff, 1);
        g.fillRoundedRect(34, 19, 28, 26, 10);
        g.fillStyle(0x060914, 1);
        g.fillRect(36, 28, 24, 7);
        g.fillStyle(0xffa23d, 1);
        g.fillTriangle(67, 54, 91, 45, 70, 67);
        g.fillStyle(0x6ae8ff, 1);
        g.fillRect(29, 96, 14, 24);
        g.fillRect(53, 96, 14, 24);
        g.lineStyle(4, 0xff7b22, 1);
        g.strokeRoundedRect(26, 28, 44, 70, 14);
      });
    }

    if (!this.textures.exists("enemy")) {
      texture(this, "enemy", 90, 112, (g) => {
        g.fillStyle(0x5d183b, 1);
        g.fillRoundedRect(20, 24, 50, 60, 18);
        g.fillStyle(0xff4f79, 1);
        g.fillCircle(35, 48, 7);
        g.fillCircle(55, 48, 7);
        g.fillStyle(0x24112d, 1);
        g.fillRect(30, 65, 30, 7);
        g.fillStyle(0xffa23d, 1);
        g.fillRect(23, 84, 14, 21);
        g.fillRect(53, 84, 14, 21);
        g.lineStyle(4, 0xff4f79, 1);
        g.strokeRoundedRect(20, 24, 50, 60, 18);
      });
    }

    if (!this.textures.exists("coin")) {
      texture(this, "coin", 48, 48, (g) => {
        g.fillStyle(0xffc857, 1);
        g.fillCircle(24, 24, 17);
        g.lineStyle(4, 0xfff3a5, 1);
        g.strokeCircle(24, 24, 14);
        g.fillStyle(0xfff3a5, 1);
        g.fillRect(21, 15, 6, 18);
      });
    }

    if (!this.textures.exists("ground")) {
      texture(this, "ground", 1280, 120, (g) => {
        g.fillStyle(0x171d35, 1);
        g.fillRect(0, 0, 1280, 120);
        g.fillStyle(0x293453, 1);
        g.fillRect(0, 0, 1280, 7);
        g.lineStyle(2, 0x3c5d83, 0.65);
        for (let x = 0; x < 1280; x += 64) g.lineBetween(x, 12, x + 20, 120);
        g.fillStyle(0xff7b22, 0.6);
        for (let x = 24; x < 1280; x += 160) g.fillRect(x, 26, 54, 4);
      });
    }

    this.scene.start("GameScene");
  }
}
