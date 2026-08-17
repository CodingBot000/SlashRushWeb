import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../config";

const SPEED_LINE_COUNT = 100;
const BURST_POOL_SIZE = 8;
const BURST_RAY_COUNT = 12;
const FEVER_COLORS = [0xff2e42, 0xffa32e, 0xfff033, 0x3dff75, 0x2ef2ff, 0x6b80ff, 0xff47f2];

interface SpeedLine {
  x: number;
  y: number;
  length: number;
  slant: number;
  width: number;
  speed: number;
  alpha: number;
  phase: number;
  color: number;
}

interface BurstRay {
  x: number;
  y: number;
  color: number;
  alpha: number;
  width: number;
}

interface Burst {
  active: boolean;
  x: number;
  y: number;
  age: number;
  duration: number;
  radius: number;
  rays: BurstRay[];
}

function randomBetween(minimum: number, maximum: number) {
  return minimum + Math.random() * (maximum - minimum);
}

export class FeverImpactOverlay {
  private readonly scene: Phaser.Scene;
  private readonly root: Phaser.GameObjects.Container;
  private readonly tintLayer: Phaser.GameObjects.Rectangle;
  private readonly flashLayer: Phaser.GameObjects.Rectangle;
  private readonly speedGraphics: Phaser.GameObjects.Graphics;
  private readonly burstGraphics: Phaser.GameObjects.Graphics;
  private readonly speedLines: SpeedLine[] = [];
  private readonly bursts: Burst[] = [];
  private flashTween?: Phaser.Tweens.Tween;
  private elapsed = 0;
  private nextBurstDelay = 0;
  private active = false;

  constructor(scene: Phaser.Scene, depth = 12) {
    this.scene = scene;
    this.root = scene.add.container(0, 0).setDepth(depth).setVisible(false).setName("FeverImpactOverlay");
    this.tintLayer = scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x35eaff, 0.07);
    this.flashLayer = scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0xd9ffff, 0);
    this.speedGraphics = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    this.burstGraphics = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    this.root.add([this.tintLayer, this.flashLayer, this.speedGraphics, this.burstGraphics]);
    for (let index = 0; index < SPEED_LINE_COUNT; index += 1) this.speedLines.push(this.makeSpeedLine(index, true));
    for (let index = 0; index < BURST_POOL_SIZE; index += 1) {
      this.bursts.push({
        active: false,
        x: 0,
        y: 0,
        age: 0,
        duration: 0,
        radius: 0,
        rays: Array.from({ length: BURST_RAY_COUNT }, () => ({ x: 0, y: 0, color: FEVER_COLORS[0], alpha: 0, width: 0 })),
      });
    }
  }

  start() {
    if (this.active) return;
    this.active = true;
    this.elapsed = 0;
    this.nextBurstDelay = 0;
    this.speedLines.forEach((line, index) => Object.assign(line, this.makeSpeedLine(index, true)));
    this.bursts.forEach((burst) => { burst.active = false; });
    this.root.setVisible(true);
    this.flashTween?.stop();
    this.flashLayer.setAlpha(0.18);
    this.flashTween = this.scene.tweens.add({
      targets: this.flashLayer,
      alpha: 0,
      duration: 120,
      onComplete: () => { this.flashTween = undefined; },
    });
    this.render();
  }

  stop() {
    this.active = false;
    this.flashTween?.stop();
    this.flashTween = undefined;
    this.flashLayer.setAlpha(0);
    this.speedGraphics.clear();
    this.burstGraphics.clear();
    this.bursts.forEach((burst) => { burst.active = false; });
    this.root.setVisible(false);
  }

  update(deltaSeconds: number) {
    if (!this.active) return;
    const delta = Math.max(0, deltaSeconds);
    this.elapsed += delta;
    for (let index = 0; index < this.speedLines.length; index += 1) {
      const line = this.speedLines[index];
      line.x -= line.speed * delta;
      if (line.x + line.length < -80) Object.assign(line, this.makeSpeedLine(index, false));
    }
    this.nextBurstDelay -= delta;
    if (this.nextBurstDelay <= 0) {
      this.startBurst();
      this.nextBurstDelay = randomBetween(0.08, 0.18);
    }
    this.bursts.forEach((burst) => {
      if (!burst.active) return;
      burst.age += delta;
      if (burst.age >= burst.duration) burst.active = false;
    });
    this.render();
  }

  destroy() {
    this.stop();
    this.root.destroy(true);
  }

  get isActive() {
    return this.active;
  }

  private makeSpeedLine(index: number, randomizeX: boolean): SpeedLine {
    const laneHeight = GAME_HEIGHT * 0.94 / SPEED_LINE_COUNT;
    const y = GAME_HEIGHT * 0.02 + laneHeight * (index + 0.5) + randomBetween(-laneHeight * 0.42, laneHeight * 0.42);
    return {
      x: randomizeX ? randomBetween(-GAME_WIDTH * 0.2, GAME_WIDTH * 1.2) : GAME_WIDTH + randomBetween(0, GAME_WIDTH * 0.55),
      y,
      length: randomBetween(300, 1180),
      slant: randomBetween(-28, 28),
      width: randomBetween(25, 45),
      speed: randomBetween(2200, 5200),
      alpha: randomBetween(0.12, 0.32),
      phase: randomBetween(0, Math.PI * 2),
      color: FEVER_COLORS[Math.floor(Math.random() * FEVER_COLORS.length)],
    };
  }

  private startBurst() {
    const burst = this.bursts.find((candidate) => !candidate.active);
    if (!burst) return;
    burst.active = true;
    burst.x = randomBetween(90, GAME_WIDTH - 90);
    burst.y = randomBetween(90, GAME_HEIGHT * 0.78);
    burst.age = 0;
    burst.duration = randomBetween(0.24, 0.42);
    burst.radius = randomBetween(70, 170);
    burst.rays.forEach((ray) => {
      const angle = randomBetween(0, Math.PI * 2);
      ray.x = Math.cos(angle);
      ray.y = Math.sin(angle);
      ray.color = FEVER_COLORS[Math.floor(Math.random() * FEVER_COLORS.length)];
      ray.alpha = randomBetween(0.34, 0.58);
      ray.width = randomBetween(2, 5);
    });
  }

  private render() {
    this.speedGraphics.clear();
    this.speedLines.forEach((line) => {
      const flicker = Math.max(0.03, Math.min(0.22, line.alpha * (0.65 + Math.sin(this.elapsed * 18 + line.phase) * 0.35)));
      this.speedGraphics.lineStyle(line.width, line.color, flicker);
      this.speedGraphics.lineBetween(line.x, line.y, line.x + line.length, line.y + line.slant);
    });

    this.burstGraphics.clear();
    this.bursts.forEach((burst) => {
      if (!burst.active) return;
      const progress = Math.min(1, burst.age / Math.max(0.01, burst.duration));
      const eased = 1 - Math.pow(1 - progress, 3);
      const radius = Phaser.Math.Linear(8, burst.radius, eased);
      burst.rays.forEach((ray) => {
        this.burstGraphics.lineStyle(ray.width, ray.color, ray.alpha * (1 - progress));
        this.burstGraphics.lineBetween(
          burst.x + ray.x * radius * 0.18,
          burst.y + ray.y * radius * 0.18,
          burst.x + ray.x * radius,
          burst.y + ray.y * radius,
        );
      });
    });
  }
}
