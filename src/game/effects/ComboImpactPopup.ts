import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../config";
import { COMBO_DIGIT_ADVANCE, COMBO_DIGIT_SIZE, COMBO_DIGIT_START_X, comboDigits, comboLayoutWidth } from "./effectRules";

const COMBO_WIDTH = 500;
const COMBO_HEIGHT = 375;
const DIGIT_SIZE = COMBO_DIGIT_SIZE;
const DIGIT_START_X = COMBO_DIGIT_START_X;
const DIGIT_ADVANCE = COMBO_DIGIT_ADVANCE;
const START_SCALE = 0.4;
const ANIMATION_MS = 350;

export class ComboImpactPopup {
  private readonly scene: Phaser.Scene;
  private readonly root: Phaser.GameObjects.Container;
  private readonly comboImage: Phaser.GameObjects.Image;
  private readonly digitImages: Phaser.GameObjects.Image[] = [];
  private tween?: Phaser.Tweens.Tween;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.root = scene.add.container(GAME_WIDTH / 2, GAME_HEIGHT / 2).setDepth(1000).setVisible(false).setName("ComboImpactPopup");
    this.comboImage = scene.add.image(0, 0, "combo").setOrigin(0).setDisplaySize(COMBO_WIDTH, COMBO_HEIGHT);
    this.root.add(this.comboImage);
  }

  play(combo: number) {
    const digits = comboDigits(combo);
    this.ensureDigits(digits.length);
    const totalWidth = comboLayoutWidth(digits.length);
    const left = -totalWidth / 2;
    const top = -COMBO_HEIGHT / 2;

    this.comboImage.setPosition(left, top).setVisible(true);
    this.digitImages.forEach((image, index) => {
      const visible = index < digits.length;
      image.setVisible(visible);
      if (!visible) return;
      image
        .setTexture(`num${digits[index]}`)
        .setPosition(left + DIGIT_START_X + DIGIT_ADVANCE * index, top + (COMBO_HEIGHT - DIGIT_SIZE) / 2)
        .setDisplaySize(DIGIT_SIZE, DIGIT_SIZE);
    });

    this.tween?.stop();
    this.root.setVisible(true).setAlpha(1).setScale(START_SCALE);
    this.tween = this.scene.tweens.add({
      targets: this.root,
      scale: 1,
      duration: ANIMATION_MS,
      ease: "Cubic.In",
      onComplete: () => {
        this.root.setVisible(false).setScale(1);
        this.tween = undefined;
      },
    });
  }

  destroy() {
    this.tween?.stop();
    this.tween = undefined;
    this.root.destroy(true);
  }

  private ensureDigits(count: number) {
    while (this.digitImages.length < count) {
      const digit = this.scene.add.image(0, 0, "num0").setOrigin(0).setVisible(false);
      this.root.add(digit);
      this.digitImages.push(digit);
    }
  }
}
