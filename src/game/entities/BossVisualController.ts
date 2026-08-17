import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../config";
import { bossActionMotion } from "../effects/effectRules";
import { RequiredAction } from "../rules";

const ROOT_X = 724;
const ROOT_Y = 70;
const ROOT_SCALE = 0.75;
const HIT_DURATION = 0.28;

const AURA_X = 71;
const AURA_Y = 47;
const SPIRIT_X = 66;
const SPIRIT_Y = 0;

const WAIST_X = 392;
const WAIST_Y = 390;
const HEAD_X = 286;
const HEAD_Y = 285;
const RIGHT_ARM_X = 377;
const RIGHT_ARM_Y = 220;
const LEFT_ARM_X = 210;
const LEFT_ARM_Y = 345;

function easedInOut(value: number) {
  return value < 0.5 ? 2 * value * value : 1 - Math.pow(-2 * value + 2, 2) / 2;
}

function easedOut(value: number) {
  return 1 - Math.pow(1 - value, 3);
}

function mix(from: number, to: number, amount: number) {
  return Phaser.Math.Linear(from, to, amount);
}

export class BossVisualController {
  private readonly backgroundRoot: Phaser.GameObjects.Container;
  private readonly background: Phaser.GameObjects.Image;
  private readonly root: Phaser.GameObjects.Container;
  private readonly aura: Phaser.GameObjects.Sprite;
  private readonly spirit: Phaser.GameObjects.Sprite;
  private readonly waist: Phaser.GameObjects.Image;
  private readonly head: Phaser.GameObjects.Image;
  private readonly rightArm: Phaser.GameObjects.Image;
  private readonly leftArmSword: Phaser.GameObjects.Image;
  private pattern: RequiredAction | null = null;
  private patternElapsed = 0;
  private patternDuration = 1;
  private hitRemaining = 0;
  private defeatedElapsed = -1;
  private elapsed = 0;

  constructor(scene: Phaser.Scene) {
    this.backgroundRoot = scene.add.container(0, 0).setDepth(-100).setName("BossBackgroundRoot");
    const underlay = scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x120c24, 1);
    this.background = scene.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, "bossBackground")
      .setDisplaySize(2348, 1320)
      .setName("BossRotatingBackground");
    this.backgroundRoot.add([underlay, this.background]);

    this.root = scene.add.container(ROOT_X, ROOT_Y).setScale(ROOT_SCALE).setDepth(5).setName("BossVisual");
    this.aura = scene.add.sprite(AURA_X, AURA_Y, "bossPixelSpiritAura", 0)
      .setOrigin(0, 0)
      .setAlpha(0.78)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setName("BossSpiritAura");
    this.spirit = scene.add.sprite(SPIRIT_X, SPIRIT_Y, "bossPixelSpiritBody", 0)
      .setOrigin(0, 0)
      .setName("BossSpiritBody");
    this.waist = scene.add.image(WAIST_X, WAIST_Y, "bossPixelArmorWaist")
      .setOrigin(0.545679, 0.311189)
      .setName("BossArmorWaist");
    this.head = scene.add.image(HEAD_X, HEAD_Y, "bossPixelArmorHead")
      .setOrigin(0.595652, 0.905512)
      .setName("BossArmorHead");
    this.rightArm = scene.add.image(RIGHT_ARM_X, RIGHT_ARM_Y, "bossPixelArmorRight")
      .setOrigin(0.192593, 0.383838)
      .setName("BossArmorRightArm");
    this.leftArmSword = scene.add.image(LEFT_ARM_X, LEFT_ARM_Y, "bossPixelArmorLeftSword")
      .setOrigin(0.514986, 0.498008)
      .setName("BossArmorLeftArmSword");

    this.root.add([this.aura, this.spirit, this.waist, this.head, this.rightArm, this.leftArmSword]);
    this.spirit.play("bossPixelSpiritBodyIdle");
    this.aura.play("bossPixelSpiritAuraIdle");
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
    if (showHit) this.hitRemaining = HIT_DURATION;
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
    const breath = Math.sin(this.elapsed * 1.65);
    const drift = Math.sin(this.elapsed * 0.82 + 0.7);

    this.root
      .setPosition(ROOT_X + drift * 2.5, ROOT_Y + breath * 3.5)
      .setScale(ROOT_SCALE)
      .setAngle(drift * 0.28)
      .setAlpha(1);

    this.aura
      .setPosition(AURA_X + drift * 1.5, AURA_Y + breath * 1.5)
      .setScale(1.005 + breath * 0.012)
      .setAngle(drift * 0.35)
      .setAlpha(0.74 + (breath + 1) * 0.035)
      .clearTint();
    this.spirit
      .setPosition(SPIRIT_X - drift, SPIRIT_Y + breath * 1.8)
      .setScale(1 - breath * 0.004, 1 + breath * 0.008)
      .setAngle(-drift * 0.18)
      .setAlpha(1)
      .clearTint();
    this.waist
      .setPosition(WAIST_X + drift * 1.2, WAIST_Y + breath * 2.4)
      .setScale(1)
      .setAngle(-breath * 0.9 + drift * 0.35)
      .setAlpha(1)
      .clearTint();
    this.head
      .setPosition(HEAD_X + drift * 2.2, HEAD_Y + breath * 1.5)
      .setScale(1)
      .setAngle(breath * 1.25 + drift * 0.6)
      .setAlpha(1)
      .clearTint();
    this.rightArm
      .setPosition(RIGHT_ARM_X + drift, RIGHT_ARM_Y + breath * 1.7)
      .setScale(1)
      .setAngle(Math.sin(this.elapsed * 1.27 + 0.9) * 1.25)
      .setAlpha(1)
      .clearTint();
    this.leftArmSword
      .setPosition(LEFT_ARM_X - drift * 0.7, LEFT_ARM_Y + breath * 1.4)
      .setScale(1)
      .setAngle(Math.sin(this.elapsed * 1.08 - 0.4) * 1.05)
      .setAlpha(1)
      .clearTint();
  }

  private applyIdlePose() {
    this.resetPose();
  }

  private applyAttackPose() {
    this.resetPose();
    if (!this.pattern) return;

    const progress = Math.min(1, this.patternElapsed / this.patternDuration);
    if (this.pattern === "no_input") {
      this.applyWaitPose(progress);
      return;
    }

    const motion = bossActionMotion(this.pattern, progress);
    const t = motion.phase === "strike" ? easedOut(motion.progress) : easedInOut(motion.progress);

    if (this.pattern === "tap") this.applyTapPose(motion.phase, t);
    else if (this.pattern === "double_tap") this.applyDoubleTapPose(motion.phase, motion.progress, motion.strikeBeat);
    else this.applyLongTapPose(motion.phase, t);
  }

  private applyTapPose(phase: "windup" | "strike" | "recover", t: number) {
    if (phase === "windup") {
      this.rightArm.setPosition(RIGHT_ARM_X + 24 * t, RIGHT_ARM_Y - 18 * t).setAngle(24 * t);
      this.head.setAngle(this.head.angle - 3 * t);
      this.waist.setAngle(this.waist.angle + 2 * t);
      return;
    }
    if (phase === "strike") {
      this.rightArm
        .setPosition(mix(RIGHT_ARM_X + 24, RIGHT_ARM_X - 54, t), mix(RIGHT_ARM_Y - 18, RIGHT_ARM_Y + 74, t))
        .setAngle(mix(24, -34, t));
      this.root.x = ROOT_X - 8 * t;
      this.head.setAngle(mix(-3, 5, t));
      this.flashSpirit(Math.sin(t * Math.PI), 0xffd4ff);
      return;
    }
    this.rightArm
      .setPosition(mix(RIGHT_ARM_X - 54, RIGHT_ARM_X, t), mix(RIGHT_ARM_Y + 74, RIGHT_ARM_Y, t))
      .setAngle(mix(-34, 0, t));
  }

  private applyDoubleTapPose(phase: "windup" | "strike" | "recover", phaseProgress: number, strikeBeat: 0 | 1 | 2) {
    const t = phase === "strike" ? easedOut(phaseProgress) : easedInOut(phaseProgress);
    if (phase === "windup") {
      this.rightArm.setPosition(RIGHT_ARM_X + 22 * t, RIGHT_ARM_Y - 16 * t).setAngle(23 * t);
      this.leftArmSword.setPosition(LEFT_ARM_X + 16 * t, LEFT_ARM_Y - 16 * t).setAngle(28 * t);
      this.waist.setAngle(this.waist.angle - 2.5 * t);
      return;
    }
    if (phase === "strike" && strikeBeat === 1) {
      const beat = easedOut(Math.min(1, phaseProgress * 2));
      this.rightArm
        .setPosition(mix(RIGHT_ARM_X + 22, RIGHT_ARM_X - 52, beat), mix(RIGHT_ARM_Y - 16, RIGHT_ARM_Y + 68, beat))
        .setAngle(mix(23, -31, beat));
      this.leftArmSword.setPosition(LEFT_ARM_X + 16, LEFT_ARM_Y - 16).setAngle(28);
      this.root.x = ROOT_X - 5 * beat;
      this.flashSpirit(Math.sin(beat * Math.PI), 0xffc8ff);
      return;
    }
    if (phase === "strike" && strikeBeat === 2) {
      const beat = easedOut(Math.min(1, (phaseProgress - 0.5) * 2));
      this.rightArm
        .setPosition(mix(RIGHT_ARM_X - 52, RIGHT_ARM_X - 15, beat), mix(RIGHT_ARM_Y + 68, RIGHT_ARM_Y + 28, beat))
        .setAngle(mix(-31, -12, beat));
      this.leftArmSword
        .setPosition(mix(LEFT_ARM_X + 16, LEFT_ARM_X + 30, beat), mix(LEFT_ARM_Y - 16, LEFT_ARM_Y + 44, beat))
        .setAngle(mix(28, -45, beat));
      this.root.x = ROOT_X - 5 - 10 * beat;
      this.root.y = ROOT_Y + 5 * beat;
      this.flashSpirit(Math.sin(beat * Math.PI), 0xffffff);
      return;
    }
    this.rightArm
      .setPosition(mix(RIGHT_ARM_X - 15, RIGHT_ARM_X, t), mix(RIGHT_ARM_Y + 28, RIGHT_ARM_Y, t))
      .setAngle(mix(-12, 0, t));
    this.leftArmSword
      .setPosition(mix(LEFT_ARM_X + 30, LEFT_ARM_X, t), mix(LEFT_ARM_Y + 44, LEFT_ARM_Y, t))
      .setAngle(mix(-45, 0, t));
  }

  private applyLongTapPose(phase: "windup" | "strike" | "recover", t: number) {
    if (phase === "windup") {
      this.leftArmSword
        .setPosition(LEFT_ARM_X + 20 * t, LEFT_ARM_Y - 24 * t)
        .setAngle(42 * t);
      this.rightArm.setAngle(this.rightArm.angle - 8 * t);
      this.head.setPosition(HEAD_X - 3 * t, HEAD_Y + 3 * t).setAngle(-5 * t);
      this.waist.setAngle(this.waist.angle + 3 * t);
      this.flashSpirit(t, 0xffb8ff);
      return;
    }
    if (phase === "strike") {
      this.leftArmSword
        .setPosition(mix(LEFT_ARM_X + 20, LEFT_ARM_X + 38, t), mix(LEFT_ARM_Y - 24, LEFT_ARM_Y + 58, t))
        .setAngle(mix(42, -52, t));
      this.rightArm.setAngle(mix(-8, 7, t));
      this.root.x = ROOT_X - 14 * t;
      this.root.y = ROOT_Y + 8 * t;
      this.head.setAngle(mix(-5, 8, t));
      this.flashSpirit(1 - t * 0.35, 0xffffff);
      return;
    }
    this.leftArmSword
      .setPosition(mix(LEFT_ARM_X + 38, LEFT_ARM_X, t), mix(LEFT_ARM_Y + 58, LEFT_ARM_Y, t))
      .setAngle(mix(-52, 0, t));
    this.rightArm.setAngle(mix(7, 0, t));
  }

  private applyWaitPose(progress: number) {
    const pulse = Math.sin(progress * Math.PI);
    const settle = Math.sin(Math.min(1, progress / 0.35) * Math.PI * 0.5);
    this.root.setPosition(ROOT_X, ROOT_Y + pulse * 2).setAngle(0);
    this.rightArm.setPosition(RIGHT_ARM_X, RIGHT_ARM_Y + pulse).setAngle(0.4 * settle);
    this.leftArmSword.setPosition(LEFT_ARM_X, LEFT_ARM_Y + pulse).setAngle(-0.5 * settle);
    this.head.setPosition(HEAD_X, HEAD_Y - pulse * 4).setAngle(0);
    this.waist.setPosition(WAIST_X, WAIST_Y + pulse * 3).setAngle(0);
    this.aura.setScale(1 + pulse * 0.1).setAlpha(0.78 + pulse * 0.18).setTint(0xf3d6ff);
    this.spirit.setScale(1 + pulse * 0.025, 1 + pulse * 0.045).setTint(0xffddff);
  }

  private flashSpirit(amount: number, tint: number) {
    const strength = Math.max(0, Math.min(1, amount));
    this.aura.setScale(1 + strength * 0.09).setAlpha(0.78 + strength * 0.2).setTint(tint);
    this.spirit.setScale(1 + strength * 0.012, 1 + strength * 0.025).setTint(tint);
  }

  private applyHitPose() {
    this.resetPose();
    const fade = this.hitRemaining / HIT_DURATION;
    const shakeX = (Math.sin(this.elapsed * 86) + Math.sin(this.elapsed * 141) * 0.45) * 10 * fade;
    const shakeY = (Math.cos(this.elapsed * 93) + Math.sin(this.elapsed * 119) * 0.35) * 6.5 * fade;
    const flash = Math.floor(this.elapsed * 36) % 2 === 0;

    this.root.setPosition(ROOT_X + shakeX, ROOT_Y + shakeY).setAngle(Math.sin(this.elapsed * 126) * 2.5 * fade);
    this.head.x += Math.sin(this.elapsed * 172) * 4 * fade;
    this.rightArm.x += Math.cos(this.elapsed * 157) * 5 * fade;
    this.leftArmSword.y += Math.sin(this.elapsed * 149) * 4 * fade;
    this.waist.x += Math.cos(this.elapsed * 181) * 3 * fade;
    const tint = flash ? 0xffffff : 0xff8fbb;
    this.head.setTint(tint);
    this.rightArm.setTint(tint);
    this.leftArmSword.setTint(tint);
    this.waist.setTint(tint);
    this.spirit.setTint(0xffffff).setScale(1 + 0.025 * fade, 1 + 0.04 * fade);
    this.aura.setTint(0xffb8ff).setScale(1 + 0.14 * fade).setAlpha(1);
  }

  private applyDefeatedPose() {
    this.resetPose();
    const t = easedInOut(Math.min(1, this.defeatedElapsed / 0.85));
    const armorFade = 1 - Math.max(0, (t - 0.72) / 0.28);

    this.root.y = ROOT_Y + 22 * t;
    this.aura.setScale(1 + 0.22 * t).setAlpha(0.82 * (1 - t)).setTint(0xff9eea);
    this.spirit.setScale(1 - 0.22 * t, 1 - 0.08 * t).setAlpha(1 - t).setTint(0xffb4dd);
    this.head.setPosition(HEAD_X - 58 * t, HEAD_Y - 82 * t).setAngle(-38 * t).setAlpha(armorFade);
    this.rightArm.setPosition(RIGHT_ARM_X + 95 * t, RIGHT_ARM_Y + 55 * t).setAngle(42 * t).setAlpha(armorFade);
    this.leftArmSword.setPosition(LEFT_ARM_X - 118 * t, LEFT_ARM_Y + 82 * t).setAngle(-58 * t).setAlpha(armorFade);
    this.waist.setPosition(WAIST_X + 52 * t, WAIST_Y + 102 * t).setAngle(24 * t).setAlpha(armorFade);
  }
}
