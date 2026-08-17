import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../config";
import { bossMotionPhase } from "../effects/effectRules";
import { RequiredAction } from "../rules";

function easedInOut(value: number) {
  return value < 0.5 ? 2 * value * value : 1 - Math.pow(-2 * value + 2, 2) / 2;
}

export class BossVisualController {
  private readonly scene: Phaser.Scene;
  private readonly backgroundRoot: Phaser.GameObjects.Container;
  private readonly background: Phaser.GameObjects.Image;
  private readonly root: Phaser.GameObjects.Container;
  private readonly body: Phaser.GameObjects.Image;
  private readonly head: Phaser.GameObjects.Image;
  private readonly leftArmPivot: Phaser.GameObjects.Container;
  private readonly rightArmPivot: Phaser.GameObjects.Container;
  private readonly core: Phaser.GameObjects.Image;
  private readonly clothLeft: Phaser.GameObjects.Image;
  private readonly clothRight: Phaser.GameObjects.Image;
  private pattern: RequiredAction | null = null;
  private patternElapsed = 0;
  private patternDuration = 1;
  private hitRemaining = 0;
  private defeatedElapsed = -1;
  private elapsed = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.backgroundRoot = scene.add.container(0, 0).setDepth(-100).setName("BossBackgroundRoot");
    const underlay = scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x120c24, 1);
    this.background = scene.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, "bossBackground")
      .setDisplaySize(2348, 1320)
      .setName("BossRotatingBackground");
    this.backgroundRoot.add([underlay, this.background]);

    this.root = scene.add.container(970, 615).setScale(0.8).setDepth(5).setName("BossVisual");
    const aura = scene.add.circle(0, -275, 235, 0x4e3fca, 0.1);
    this.clothLeft = scene.add.image(-104, -235, "bossClothLeft").setDisplaySize(118, 145).setOrigin(0.5, 0.1);
    this.clothRight = scene.add.image(102, -235, "bossClothRight").setDisplaySize(120, 145).setOrigin(0.5, 0.1);
    this.body = scene.add.image(-8, -245, "bossBody").setDisplaySize(390, 470).setOrigin(0.5, 1);

    this.leftArmPivot = scene.add.container(-175, -230);
    const leftSword = scene.add.image(-40, -120, "bossSword").setDisplaySize(105, 185).setAngle(-12);
    const leftArm = scene.add.image(0, 0, "bossLeftArm").setDisplaySize(145, 260).setOrigin(0.5, 1);
    this.leftArmPivot.add([leftSword, leftArm]);

    this.rightArmPivot = scene.add.container(170, -230);
    const rightSword = scene.add.image(40, -120, "bossSword").setDisplaySize(105, 185).setAngle(12);
    const rightArm = scene.add.image(0, 0, "bossRightArm").setDisplaySize(155, 260).setOrigin(0.5, 1);
    this.rightArmPivot.add([rightSword, rightArm]);

    this.head = scene.add.image(6, -480, "bossHead").setDisplaySize(195, 215).setOrigin(0.5, 1);
    this.core = scene.add.image(0, -260, "bossCore").setDisplaySize(82, 80);
    this.root.add([aura, this.clothLeft, this.clothRight, this.body, this.leftArmPivot, this.rightArmPivot, this.head, this.core]);
    this.applyIdlePose();
  }

  startPattern(action: RequiredAction, duration: number) {
    this.pattern = action;
    this.patternElapsed = 0;
    this.patternDuration = Math.max(0.1, duration);
    this.hitRemaining = 0;
  }

  endPattern(showHit = false) {
    this.pattern = null;
    this.patternElapsed = 0;
    if (showHit) this.hitRemaining = 0.28;
  }

  defeat() {
    this.pattern = null;
    this.hitRemaining = 0;
    this.defeatedElapsed = 0;
  }

  update(deltaSeconds: number) {
    const delta = Math.max(0, deltaSeconds);
    this.elapsed += delta;
    this.background.rotation += 0.05 * delta;

    if (this.defeatedElapsed >= 0) {
      this.defeatedElapsed += delta;
      this.applyDefeatedPose();
      return;
    }
    if (this.hitRemaining > 0) {
      this.hitRemaining = Math.max(0, this.hitRemaining - delta);
      this.applyHitPose();
      return;
    }
    if (this.pattern) {
      this.patternElapsed += delta;
      this.applyAttackPose();
      return;
    }
    this.applyIdlePose();
  }

  destroy() {
    this.backgroundRoot.destroy(true);
    this.root.destroy(true);
  }

  private resetPose() {
    const breath = Math.sin(this.elapsed * Math.PI * 1.25);
    this.root.setPosition(970, 615 + breath * 4).setRotation(0).setAlpha(1);
    this.body
      .setPosition(-8, -245 - breath * 3)
      .setAngle(breath * 0.75)
      .setDisplaySize(390 * (1 - breath * 0.008), 470 * (1 + breath * 0.018));
    this.head
      .setPosition(6 + Math.cos(this.elapsed * 1.3) * 2, -480 - breath * 2)
      .setAngle(breath * 2.2)
      .setDisplaySize(195, 215);
    this.leftArmPivot.setPosition(-175, -230 - breath * 2).setAngle(-breath * 4).setScale(1);
    this.rightArmPivot.setPosition(170, -230 - breath * 2).setAngle(breath * 3.4).setScale(1);
    this.setCoreScale(1 + (breath + 1) * 0.035);
    this.core.setPosition(0, -260 - breath * 2).setAlpha(0.86 + (breath + 1) * 0.07).clearTint();
    this.clothLeft.setPosition(-104, -235).setAngle(Math.sin(this.elapsed * 2.1 - 0.7) * 7).setDisplaySize(118, 145).setAlpha(1);
    this.clothRight.setPosition(102, -235).setAngle(-Math.sin(this.elapsed * 1.9 - 1.1) * 7).setDisplaySize(120, 145).setAlpha(1);
  }

  private applyIdlePose() {
    this.resetPose();
  }

  private applyAttackPose() {
    this.resetPose();
    if (!this.pattern) return;
    const motion = bossMotionPhase(this.patternElapsed / this.patternDuration);
    const t = motion.phase === "strike" ? 1 - Math.pow(1 - motion.progress, 3) : easedInOut(motion.progress);

    if (this.pattern === "tap") {
      if (motion.phase === "windup") {
        this.rightArmPivot.setPosition(188, -278).setAngle(70 * t);
        this.body.setAngle(3 * t);
      } else if (motion.phase === "strike") {
        this.rightArmPivot.setPosition(188 - 40 * t, -278 + 120 * t).setAngle(70 - 142 * t);
        this.body.setAngle(3 - 8 * t);
      } else {
        this.rightArmPivot.setPosition(148 + 22 * t, -158 - 72 * t).setAngle(-72 + 72 * t);
      }
    } else if (this.pattern === "double_tap") {
      if (motion.phase === "windup") {
        this.leftArmPivot.setPosition(-157, -278).setAngle(-70 * t);
        this.rightArmPivot.setPosition(188, -278).setAngle(70 * t);
      } else if (motion.phase === "strike") {
        this.leftArmPivot.setPosition(-157 - 40 * t, -278 + 126 * t).setAngle(-70 + 142 * t);
        this.rightArmPivot.setPosition(188 + 40 * t, -278 + 126 * t).setAngle(70 - 142 * t);
      } else {
        this.leftArmPivot.setPosition(-197 + 22 * t, -152 - 78 * t).setAngle(72 - 72 * t);
        this.rightArmPivot.setPosition(228 - 58 * t, -152 - 78 * t).setAngle(-72 + 72 * t);
      }
    } else {
      const charge = motion.phase === "windup" ? Phaser.Math.Linear(1, 1.45, t)
        : motion.phase === "strike" ? Phaser.Math.Linear(1.65, 1.15, t)
          : Phaser.Math.Linear(1.15, 1, t);
      this.setCoreScale(charge);
      this.core.setTint(0xff9696).setAlpha(1);
      this.leftArmPivot.setAngle(-14 * (motion.phase === "recover" ? 1 - t : t));
      this.rightArmPivot.setAngle(14 * (motion.phase === "recover" ? 1 - t : t));
    }

    const clothWeight = motion.phase === "recover" ? 1 - t : t;
    this.clothLeft.setAngle(this.clothLeft.angle + 10 * clothWeight);
    this.clothRight.setAngle(this.clothRight.angle - 10 * clothWeight);
  }

  private applyHitPose() {
    this.resetPose();
    const fade = this.hitRemaining / 0.28;
    this.root.x = 970 + (Math.sin(this.elapsed * 86) + Math.sin(this.elapsed * 141) * 0.45) * 10 * fade;
    this.root.y += (Math.cos(this.elapsed * 93) + Math.sin(this.elapsed * 119) * 0.35) * 6.5 * fade;
    this.root.angle = Math.sin(this.elapsed * 126) * 2.5 * fade;
    this.setCoreScale(1.18);
    this.core.setTint(0xff6666).setAlpha(1);
  }

  private applyDefeatedPose() {
    this.resetPose();
    const t = easedInOut(Math.min(1, this.defeatedElapsed / 0.85));
    this.body.setPosition(-8, -245 + 45 * t).setAngle(8 * t);
    this.head.setPosition(6 - 35 * t, -480 + 60 * t).setAngle(-35 * t);
    this.leftArmPivot.setPosition(-175 - 70 * t, -230 + 80 * t).setAngle(55 * t);
    this.rightArmPivot.setPosition(170 + 70 * t, -230 + 80 * t).setAngle(-55 * t);
    this.clothLeft.setPosition(-104 - 15 * t, -235 + 70 * t).setAngle(18 * t);
    this.clothRight.setPosition(102 + 15 * t, -235 + 70 * t).setAngle(-18 * t);
    this.setCoreScale(Math.max(0.1, 1 - 0.9 * t));
    this.core.setAlpha(1 - t).setTint(0xff7777);
  }

  private setCoreScale(scale: number) {
    this.core.setDisplaySize(82 * scale, 80 * scale);
  }
}
