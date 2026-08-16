import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../config";
import { clamp, comboMultiplier, nextSpawnDelay, scoreForDefeat } from "../rules";

type GameMode = "menu" | "playing" | "gameover";

const COLORS = {
  ink: 0x060914,
  surface: 0x11172a,
  cyan: 0x6ae8ff,
  orange: 0xff7b22,
  gold: 0xffc857,
  pink: 0xff4f79,
  white: 0xf4f7ff,
  muted: 0x9ca9c9,
};

export class GameScene extends Phaser.Scene {
  private mode: GameMode = "menu";
  private paused = false;
  private elapsed = 0;
  private score = 0;
  private combo = 0;
  private comboTimer = 0;
  private health = 3;
  private spawnTimer = 0;
  private coinTimer = 0;
  private slashTimer = 0;
  private hitCooldown = 0;
  private jumpCount = 0;
  private readonly highScoreKey = "slashrush-high-score";

  private player!: Phaser.Physics.Arcade.Sprite;
  private enemies!: Phaser.Physics.Arcade.Group;
  private coins!: Phaser.Physics.Arcade.Group;
  private platforms!: Phaser.Physics.Arcade.StaticGroup;
  private slashFx!: Phaser.GameObjects.Graphics;
  private worldFx!: Phaser.GameObjects.Graphics;
  private cityFar!: Phaser.GameObjects.Graphics;
  private cityNear!: Phaser.GameObjects.Graphics;
  private starLayer!: Phaser.GameObjects.Graphics;
  private hud!: Phaser.GameObjects.Container;
  private scoreText!: Phaser.GameObjects.Text;
  private comboText!: Phaser.GameObjects.Text;
  private healthText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private stateLayer!: Phaser.GameObjects.Container;
  private pauseButton!: Phaser.GameObjects.Text;
  private touchLabels!: Phaser.GameObjects.Container;

  constructor() {
    super("GameScene");
  }

  create() {
    this.physics.world.setBounds(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.createBackground();
    this.createWorld();
    this.createHud();
    this.createTouchControls();
    this.createInput();
    this.showMenu();
  }

  update(_time: number, delta: number) {
    const dt = Math.min(delta, 40);
    this.animateBackground(dt);

    if (this.mode !== "playing" || this.paused) return;

    const seconds = dt / 1000;
    this.elapsed += seconds;
    this.spawnTimer -= dt;
    this.coinTimer -= dt;
    this.slashTimer = Math.max(0, this.slashTimer - dt);
    this.comboTimer -= dt;
    this.hitCooldown = Math.max(0, this.hitCooldown - dt);

    if (this.comboTimer <= 0) this.combo = 0;
    if (this.spawnTimer <= 0) {
      this.spawnEnemy();
      this.spawnTimer = nextSpawnDelay(this.elapsed);
    }
    if (this.coinTimer <= 0) {
      this.spawnCoinLine();
      this.coinTimer = 2000;
    }

    this.enemies.children.each((child) => {
      const enemy = child as Phaser.Physics.Arcade.Sprite;
      if (!enemy.active) return true;
      enemy.setVelocityX(-(300 + Math.min(160, this.elapsed * 3)));
      if (enemy.x < -100) {
        enemy.destroy();
        this.combo = 0;
      }
      return true;
    });
    this.coins.children.each((child) => {
      const coin = child as Phaser.Physics.Arcade.Sprite;
      if (!coin.active) return true;
      coin.setVelocityX(-(300 + Math.min(160, this.elapsed * 3)));
      coin.angle += 4;
      if (coin.x < -80) coin.destroy();
      return true;
    });

    this.drawSlashEffect();
    this.updateHud();
    this.keepPlayerInPlaySpace();

    if (this.health <= 0) this.endRun();
  }

  private createBackground() {
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, COLORS.ink);
    const sky = this.add.graphics();
    sky.fillGradientStyle(0x111a39, 0x111a39, 0x060914, 0x060914, 1);
    sky.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    this.starLayer = this.add.graphics();
    for (let i = 0; i < 58; i += 1) {
      const x = (i * 211) % GAME_WIDTH;
      const y = 70 + ((i * 83) % 270);
      const size = i % 7 === 0 ? 3 : 1.5;
      this.starLayer.fillStyle(i % 3 === 0 ? COLORS.cyan : COLORS.white, i % 4 === 0 ? 0.65 : 0.35);
      this.starLayer.fillCircle(x, y, size);
    }

    this.cityFar = this.add.graphics();
    this.drawCity(this.cityFar, 0x202b50, 0.75, 0);
    this.cityNear = this.add.graphics();
    this.drawCity(this.cityNear, 0x11182c, 0.95, 1);

    this.worldFx = this.add.graphics();
    this.worldFx.fillStyle(COLORS.orange, 0.16);
    this.worldFx.fillEllipse(260, 595, 360, 80);
    this.worldFx.fillStyle(COLORS.cyan, 0.1);
    this.worldFx.fillEllipse(1000, 580, 480, 90);
  }

  private drawCity(graphics: Phaser.GameObjects.Graphics, color: number, alpha: number, offset: number) {
    graphics.fillStyle(color, alpha);
    for (let x = -50; x < GAME_WIDTH + 100; x += 86 + (offset * 11)) {
      const height = 90 + ((x * 17 + offset * 53) % 190);
      graphics.fillRect(x, 585 - height, 60 + offset * 14, height);
      graphics.fillStyle(offset === 0 ? 0x6ae8ff : 0xff7b22, 0.08);
      for (let y = 600 - height + 20; y < 575; y += 24) graphics.fillRect(x + 12, y, 9, 4);
      graphics.fillStyle(color, alpha);
    }
  }

  private animateBackground(delta: number) {
    if (this.mode !== "playing" || this.paused) return;
    this.cityFar.x -= delta * 0.005;
    this.cityNear.x -= delta * 0.012;
    if (this.cityFar.x < -50) this.cityFar.x = 50;
    if (this.cityNear.x < -70) this.cityNear.x = 70;
  }

  private createWorld() {
    this.platforms = this.physics.add.staticGroup();
    const floor = this.platforms.create(GAME_WIDTH / 2, 660, "ground") as Phaser.Physics.Arcade.Sprite;
    floor.setSize(GAME_WIDTH, 120).setOffset(0, 0).refreshBody();
    floor.setDepth(2);

    const ledgeA = this.platforms.create(610, 485, "ground") as Phaser.Physics.Arcade.Sprite;
    ledgeA.setScale(0.33, 0.22).setSize(1280, 120).setOffset(0, 0).refreshBody();
    ledgeA.setDepth(2);
    const ledgeB = this.platforms.create(1010, 390, "ground") as Phaser.Physics.Arcade.Sprite;
    ledgeB.setScale(0.22, 0.18).setSize(1280, 120).setOffset(0, 0).refreshBody();
    ledgeB.setDepth(2);

    this.enemies = this.physics.add.group({ allowGravity: true, collideWorldBounds: false });
    this.coins = this.physics.add.group({ allowGravity: false, collideWorldBounds: false });
    this.player = this.physics.add.sprite(250, 520, "player");
    this.player.setDepth(5).setCollideWorldBounds(true);
    this.player.setSize(42, 90).setOffset(27, 29);

    this.physics.add.collider(this.player, this.platforms);
    this.physics.add.collider(this.enemies, this.platforms);
    this.physics.add.overlap(this.player, this.enemies, (_player, enemy) => this.playerHit(enemy as Phaser.Physics.Arcade.Sprite));
    this.physics.add.overlap(this.player, this.coins, (_player, coin) => this.collectCoin(coin as Phaser.Physics.Arcade.Sprite));

    this.slashFx = this.add.graphics().setDepth(6);
  }

  private createHud() {
    this.hud = this.add.container(0, 0).setDepth(20);
    const topBar = this.add.rectangle(GAME_WIDTH / 2, 42, GAME_WIDTH - 48, 66, COLORS.surface, 0.78).setStrokeStyle(1, 0x2b385a, 0.8);
    this.hud.add(topBar);
    this.addText(this.hud, 56, 22, "SLASHRUSH", 18, COLORS.cyan, "700");
    this.addText(this.hud, 56, 48, "NEON DISTRICT // RUN 01", 11, COLORS.muted, "600");
    this.scoreText = this.addText(this.hud, 420, 20, "SCORE 000000", 20, COLORS.white, "700");
    this.comboText = this.addText(this.hud, 420, 49, "COMBO x0", 12, COLORS.gold, "700");
    this.healthText = this.addText(this.hud, 740, 32, "♥ ♥ ♥", 20, COLORS.pink, "700");
    this.pauseButton = this.addText(this.hud, 1178, 19, "Ⅱ", 28, COLORS.white, "700").setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.pauseButton.on("pointerdown", () => this.togglePause());

    this.hintText = this.addText(this.hud, GAME_WIDTH / 2, 135, "SPACE / TAP TO START", 13, COLORS.muted, "700").setOrigin(0.5);
  }

  private createTouchControls() {
    this.touchLabels = this.add.container(0, 0).setDepth(25).setVisible(false);
    const jump = this.add.rectangle(150, 630, 220, 110, 0x17213e, 0.76).setStrokeStyle(2, COLORS.cyan, 0.48).setInteractive();
    const slash = this.add.rectangle(1130, 630, 220, 110, 0x2b1835, 0.76).setStrokeStyle(2, COLORS.orange, 0.56).setInteractive();
    this.touchLabels.add([jump, slash]);
    this.touchLabels.add(this.addText(this.touchLabels, 150, 630, "JUMP", 18, COLORS.cyan, "800").setOrigin(0.5));
    this.touchLabels.add(this.addText(this.touchLabels, 1130, 630, "SLASH", 18, COLORS.orange, "800").setOrigin(0.5));
    jump.on("pointerdown", () => this.jump());
    slash.on("pointerdown", () => this.slash());
  }

  private createInput() {
    this.input.keyboard?.on("keydown-SPACE", () => {
      if (this.mode === "menu" || this.mode === "gameover") this.startRun();
      else this.slash();
    });
    this.input.keyboard?.on("keydown-UP", () => this.jump());
    this.input.keyboard?.on("keydown-W", () => this.jump());
    this.input.keyboard?.on("keydown-X", () => this.slash());
    this.input.keyboard?.on("keydown-C", () => this.slash());
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (this.mode === "menu" || this.mode === "gameover") {
        this.startRun();
      } else if (pointer.y > 500) {
        if (pointer.x < GAME_WIDTH / 2) this.jump();
        else this.slash();
      }
    });
  }

  private showMenu() {
    this.mode = "menu";
    this.touchLabels.setVisible(false);
    this.stateLayer?.destroy();
    this.stateLayer = this.add.container(0, 0).setDepth(30);
    const veil = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, COLORS.ink, 0.76);
    const panel = this.add.rectangle(GAME_WIDTH / 2, 372, 560, 320, COLORS.surface, 0.96).setStrokeStyle(2, 0x33456e, 1);
    const title = this.addText(this.stateLayer, GAME_WIDTH / 2, 260, "SLASHRUSH", 54, COLORS.white, "800").setOrigin(0.5);
    title.setShadow(0, 5, "#ff7b22", 18, true, true);
    this.stateLayer.add([veil, panel]);
    this.stateLayer.bringToTop(title);
    this.stateLayer.add(this.addText(this.stateLayer, GAME_WIDTH / 2, 326, "CUT THROUGH THE NIGHT", 14, COLORS.orange, "800").setOrigin(0.5));
    this.stateLayer.add(this.addText(this.stateLayer, GAME_WIDTH / 2, 364, "적을 베고 콤보를 이어 최고 점수를 갱신하세요.", 15, COLORS.muted, "500").setOrigin(0.5));
    const button = this.add.rectangle(GAME_WIDTH / 2, 444, 250, 58, COLORS.orange, 1).setStrokeStyle(2, 0xffc857, 1).setInteractive({ useHandCursor: true });
    this.stateLayer.add(button);
    const label = this.addText(this.stateLayer, GAME_WIDTH / 2, 444, "START RUN", 18, COLORS.ink, "800").setOrigin(0.5);
    button.on("pointerover", () => button.setFillStyle(COLORS.gold));
    button.on("pointerout", () => button.setFillStyle(COLORS.orange));
    button.on("pointerdown", () => this.startRun());
    this.stateLayer.bringToTop(label);
    this.stateLayer.add(this.addText(this.stateLayer, GAME_WIDTH / 2, 504, "JUMP  ↑ / W      SLASH  SPACE / X", 12, COLORS.cyan, "700").setOrigin(0.5));
    this.hintText.setVisible(false);
  }

  private startRun() {
    this.mode = "playing";
    this.paused = false;
    this.elapsed = 0;
    this.score = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.health = 3;
    this.spawnTimer = 450;
    this.coinTimer = 1000;
    this.jumpCount = 0;
    this.hitCooldown = 0;
    this.player.setPosition(250, 520).setVelocity(0, 0).clearTint();
    this.enemies.clear(true, true);
    this.coins.clear(true, true);
    this.stateLayer?.destroy();
    this.touchLabels.setVisible(true);
    this.hintText.setVisible(false);
    this.pauseButton.setText("Ⅱ");
    this.updateHud();
  }

  private spawnEnemy() {
    const y = Math.random() > 0.76 ? 305 : 530;
    const enemy = this.enemies.create(GAME_WIDTH + 70, y, "enemy") as Phaser.Physics.Arcade.Sprite;
    enemy.setDepth(5).setSize(50, 72).setOffset(20, 28);
    enemy.setVelocityX(-340).setBounce(0, 0);
    enemy.setData("hp", 1);
  }

  private spawnCoinLine() {
    const y = 320 + Math.floor(Math.random() * 3) * 90;
    for (let i = 0; i < 3; i += 1) {
      const coin = this.coins.create(GAME_WIDTH + 40 + i * 54, y - Math.sin(i * 1.5) * 30, "coin") as Phaser.Physics.Arcade.Sprite;
      coin.setDepth(4).setCircle(16, 8, 8);
      coin.setVelocityX(-340);
    }
  }

  private jump() {
    if (this.mode === "menu" || this.mode === "gameover") {
      this.startRun();
      return;
    }
    if (this.paused) return;
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    const grounded = body.blocked.down || body.touching.down;
    if (grounded) this.jumpCount = 0;
    if (grounded || this.jumpCount < 1) {
      this.player.setVelocityY(-650);
      this.jumpCount += 1;
    }
  }

  private slash() {
    if (this.mode === "menu" || this.mode === "gameover") {
      this.startRun();
      return;
    }
    if (this.paused) return;
    this.slashTimer = 240;
    this.player.setTint(0xfff3a5);
    this.time.delayedCall(130, () => this.player.clearTint());
    this.enemies.children.each((child) => {
      const enemy = child as Phaser.Physics.Arcade.Sprite;
      if (!enemy.active) return true;
      const inRange = enemy.x > this.player.x - 20 && enemy.x < this.player.x + 190 && Math.abs(enemy.y - this.player.y) < 145;
      if (inRange) this.defeatEnemy(enemy);
      return true;
    });
  }

  private defeatEnemy(enemy: Phaser.Physics.Arcade.Sprite) {
    if (!enemy.active) return;
    enemy.disableBody(true, true);
    this.combo = clamp(this.combo + 1, 0, 12);
    this.comboTimer = 1800;
    this.score += scoreForDefeat(this.combo);
    const burst = this.add.particles(enemy.x, enemy.y, "coin", {
      speed: { min: 80, max: 220 },
      lifespan: 280,
      quantity: 8,
      scale: { start: 0.45, end: 0 },
      tint: [COLORS.orange, COLORS.gold, COLORS.cyan],
      emitting: false,
    }).setDepth(7);
    burst.explode(8, enemy.x, enemy.y);
    this.time.delayedCall(400, () => burst.destroy());
  }

  private playerHit(enemy: Phaser.Physics.Arcade.Sprite) {
    if (this.hitCooldown > 0 || !enemy.active || this.slashTimer > 0) return;
    this.hitCooldown = 1200;
    this.health -= 1;
    this.combo = 0;
    this.player.setTint(COLORS.pink);
    this.tweens.add({ targets: this.player, alpha: 0.25, duration: 80, yoyo: true, repeat: 5 });
    enemy.disableBody(true, true);
    this.cameras.main.shake(160, 0.006);
  }

  private collectCoin(coin: Phaser.Physics.Arcade.Sprite) {
    if (!coin.active) return;
    coin.disableBody(true, true);
    this.score += 25;
    this.comboTimer = Math.max(this.comboTimer, 900);
  }

  private drawSlashEffect() {
    this.slashFx.clear();
    if (this.slashTimer <= 0) return;
    const progress = 1 - this.slashTimer / 240;
    this.slashFx.lineStyle(18, COLORS.orange, 0.2);
    this.slashFx.beginPath();
    this.slashFx.arc(this.player.x + 44, this.player.y - 6, 118, -1.2 + progress * 0.3, 0.45 + progress * 0.3, false, 24);
    this.slashFx.strokePath();
    this.slashFx.lineStyle(5, COLORS.gold, 1);
    this.slashFx.beginPath();
    this.slashFx.arc(this.player.x + 44, this.player.y - 6, 118, -1.2 + progress * 0.3, 0.45 + progress * 0.3, false, 24);
    this.slashFx.strokePath();
  }

  private keepPlayerInPlaySpace() {
    this.player.x = clamp(this.player.x, 160, 420);
    if (this.player.y > GAME_HEIGHT + 100) this.health = 0;
  }

  private updateHud() {
    this.scoreText?.setText(`SCORE ${String(this.score).padStart(6, "0")}`);
    this.comboText?.setText(`COMBO x${comboMultiplier(this.combo)}  //  ${this.combo}`);
    this.healthText?.setText(`${this.health >= 1 ? "♥" : "♡"} ${this.health >= 2 ? "♥" : "♡"} ${this.health >= 3 ? "♥" : "♡"}`);
  }

  private togglePause() {
    if (this.mode !== "playing") return;
    this.paused = !this.paused;
    this.pauseButton.setText(this.paused ? "▶" : "Ⅱ");
    if (this.paused) {
      this.stateLayer = this.add.container(0, 0).setDepth(30);
      this.stateLayer.add(this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, COLORS.ink, 0.7));
      this.stateLayer.add(this.addText(this.stateLayer, GAME_WIDTH / 2, 320, "PAUSED", 48, COLORS.white, "800").setOrigin(0.5));
      this.stateLayer.add(this.addText(this.stateLayer, GAME_WIDTH / 2, 380, "상단 오른쪽 버튼으로 계속하기", 14, COLORS.muted, "600").setOrigin(0.5));
    } else {
      this.stateLayer?.destroy();
    }
  }

  private endRun() {
    if (this.mode !== "playing") return;
    this.mode = "gameover";
    this.touchLabels.setVisible(false);
    this.player.setVelocity(0, 0);
    const previous = Number(localStorage.getItem(this.highScoreKey) ?? 0);
    const highScore = Math.max(previous, this.score);
    localStorage.setItem(this.highScoreKey, String(highScore));
    this.stateLayer = this.add.container(0, 0).setDepth(30);
    this.stateLayer.add(this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, COLORS.ink, 0.8));
    const panel = this.add.rectangle(GAME_WIDTH / 2, 365, 520, 300, COLORS.surface, 0.98).setStrokeStyle(2, COLORS.pink, 0.9);
    this.stateLayer.add(panel);
    this.stateLayer.add(this.addText(this.stateLayer, GAME_WIDTH / 2, 278, "RUN OVER", 42, COLORS.white, "800").setOrigin(0.5));
    this.stateLayer.add(this.addText(this.stateLayer, GAME_WIDTH / 2, 338, `SCORE  ${String(this.score).padStart(6, "0")}`, 22, COLORS.orange, "800").setOrigin(0.5));
    this.stateLayer.add(this.addText(this.stateLayer, GAME_WIDTH / 2, 376, `BEST  ${String(highScore).padStart(6, "0")}`, 14, COLORS.cyan, "700").setOrigin(0.5));
    const button = this.add.rectangle(GAME_WIDTH / 2, 446, 220, 54, COLORS.orange, 1).setInteractive({ useHandCursor: true });
    button.on("pointerdown", () => this.startRun());
    this.stateLayer.add(button);
    this.stateLayer.add(this.addText(this.stateLayer, GAME_WIDTH / 2, 446, "RETRY", 17, COLORS.ink, "800").setOrigin(0.5));
    this.stateLayer.add(this.addText(this.stateLayer, GAME_WIDTH / 2, 503, "SPACE / TAP TO RETRY", 12, COLORS.muted, "700").setOrigin(0.5));
  }

  private addText(container: Phaser.GameObjects.Container, x: number, y: number, text: string, size: number, color: number, weight: string) {
    const gameText = this.add.text(x, y, text, {
      fontFamily: "Arial, Helvetica, sans-serif",
      fontSize: `${size}px`,
      fontStyle: weight === "800" || weight === "700" ? "bold" : "normal",
      color: `#${color.toString(16).padStart(6, "0")}`,
      letterSpacing: size >= 18 ? 1 : 0.4,
    });
    container.add(gameText);
    return gameText;
  }
}
