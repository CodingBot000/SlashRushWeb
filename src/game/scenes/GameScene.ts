import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../config";
import { ComboImpactPopup } from "../effects/ComboImpactPopup";
import { FeverImpactOverlay } from "../effects/FeverImpactOverlay";
import { HitFeedbackController } from "../effects/HitFeedbackController";
import { feverTapPulse } from "../effects/effectRules";
import { BossVisualController } from "../entities/BossVisualController";
import { PlayerVisualController } from "../entities/PlayerVisualController";
import {
  changeMasterVolume,
  DEFAULT_GAME_SETTINGS,
  GameSettingsState,
  loadGameSettings,
  saveGameSettings,
  triggerHaptic,
} from "../services/GameSettings";
import {
  actionHint,
  actionMatches,
  BOSS_MAX_HP,
  buildRunnerSchedule,
  clamp,
  FEVER_DURATION,
  MAX_FEVER,
  MAX_HP,
  OBJECT_RULES,
  RequiredAction,
  RUNNER_DURATION,
  scoreMultiplier,
  SlashAction,
  STARTING_HP,
  SpawnEvent,
  RunnerObjectType,
} from "../rules";

type GameMode = "intro" | "menu" | "character" | "howto" | "runner" | "boss" | "result";

interface RunnerObject {
  type: RunnerObjectType;
  rule: (typeof OBJECT_RULES)[RunnerObjectType];
  sprite: Phaser.GameObjects.Image;
  shadow?: Phaser.GameObjects.Ellipse;
  x: number;
  baseY: number;
  phase: number;
  handled: boolean;
  feverSpawn: boolean;
}

interface SlashRushDebugApi {
  getState: () => {
    mode: GameMode;
    combo: number;
    bossCombo: number;
    feverActive: boolean;
    bossFeverActive: boolean;
    hurt: boolean;
  };
  startRunner: () => void;
  startBoss: () => void;
  triggerCombo: () => void;
  triggerFever: () => void;
  triggerHurt: () => void;
}

const COLORS = {
  ink: 0x070a11,
  panel: 0x0b0d14,
  white: 0xf7f4ed,
  cream: 0xffefc0,
  muted: 0xc6cad4,
  gold: 0xffca5f,
  red: 0xff6b6b,
  blue: 0x9ec8ff,
  cyan: 0x5ef3ff,
  green: 0x76ff9c,
};

const MONSTER_SHADOW_Y = 612;
const MONSTER_SHADOW_WIDTH = 104;
const MONSTER_SHADOW_HEIGHT = 22;

export class GameScene extends Phaser.Scene {
  private mode: GameMode = "intro";
  private paused = false;
  private tracked: Phaser.GameObjects.GameObject[] = [];
  private runnerTiles: Phaser.GameObjects.TileSprite[] = [];
  private runnerObjects: RunnerObject[] = [];
  private schedule: SpawnEvent[] = [];
  private scheduleIndex = 0;
  private runnerElapsed = 0;
  private player!: Phaser.GameObjects.Sprite;
  private playerSlash!: Phaser.GameObjects.Image;
  private playerVisual?: PlayerVisualController;
  private swordX = 366;
  private swordY = 475;
  private swordWidth = 205;
  private swordHeight = 117;
  private swordDebugAlwaysVisible = false;
  private invincibleMode = false;
  private feedbackTimer = 0;
  private comboPopup?: ComboImpactPopup;
  private feverImpact?: FeverImpactOverlay;
  private feverText?: Phaser.GameObjects.Text;
  private feverSpawnTimer = 0;
  private feverTimeLeft = 0;
  private fever = 0;
  private feverActive = false;
  private score = 0;
  private coins = 0;
  private combo = 0;
  private health = STARTING_HP;
  private bestScore = 0;

  private scoreText?: Phaser.GameObjects.Text;
  private heartsText?: Phaser.GameObjects.Text;
  private comboText?: Phaser.GameObjects.Text;
  private coinsText?: Phaser.GameObjects.Text;
  private feverFill?: Phaser.GameObjects.Rectangle;
  private feverTrack?: Phaser.GameObjects.Rectangle;
  private feverLabel?: Phaser.GameObjects.Text;
  private bossFill?: Phaser.GameObjects.Rectangle;
  private bossTimerFill?: Phaser.GameObjects.Rectangle;
  private bossLabel?: Phaser.GameObjects.Text;
  private hintText?: Phaser.GameObjects.Text;
  private feedbackText?: Phaser.GameObjects.Text;
  private pauseButton?: Phaser.GameObjects.Text;
  private settingsButton?: Phaser.GameObjects.Image;
  private swordDebugRoot?: Phaser.GameObjects.Container;
  private swordDebugPanel?: Phaser.GameObjects.Container;
  private swordDebugToggleLabel?: Phaser.GameObjects.Text;
  private swordDebugValueText?: Phaser.GameObjects.Text;
  private swordAlwaysLabel?: Phaser.GameObjects.Text;
  private invincibleLabel?: Phaser.GameObjects.Text;
  private audioSettingLabel?: Phaser.GameObjects.Text;
  private attackVibrationLabel?: Phaser.GameObjects.Text;
  private hurtVibrationLabel?: Phaser.GameObjects.Text;
  private settingsOverlayOpen = false;
  private stateObjects: Phaser.GameObjects.GameObject[] = [];

  private pressStartedAt = -1;
  private lastTapAt = -10;
  private keyboardPressed = false;

  private bossVisual?: BossVisualController;
  private bossHp = BOSS_MAX_HP;
  private bossCombo = 0;
  private bossPatternIndex = 0;
  private bossAction: RequiredAction | null = null;
  private bossPatternTime = 0;
  private bossNextDelay = 0;
  private bossFever = 0;
  private bossFeverActive = false;
  private bossFeverTimeLeft = 0;
  private bossHint?: Phaser.GameObjects.Text;
  private bossCueOne?: Phaser.GameObjects.Image;
  private bossCueTwo?: Phaser.GameObjects.Image;
  private bossWaitCue?: Phaser.GameObjects.Image;
  private bossScraps: Phaser.GameObjects.Image[] = [];
  private music?: Phaser.Sound.BaseSound;
  private readonly hitFeedback = new HitFeedbackController();
  private settings: GameSettingsState = { ...DEFAULT_GAME_SETTINGS };

  constructor() {
    super("GameScene");
  }

  create() {
    this.settings = loadGameSettings(localStorage);
    this.sound.volume = this.settings.masterVolume;
    this.bestScore = Number(localStorage.getItem("slashrush-best-score") || 0);
    this.coins = Number(localStorage.getItem("slashrush-coins") || 0);
    this.createInput();
    this.installDevelopmentHooks();
    this.showIntro();
  }

  update(_time: number, delta: number) {
    const seconds = Math.min(delta, 50) / 1000;
    if (this.mode === "intro") {
      this.animateIntro();
      return;
    }
    if (this.mode === "runner" && !this.paused) this.updateRunner(seconds);
    if (this.mode === "boss" && !this.paused) this.updateBoss(seconds);
  }

  private track<T extends Phaser.GameObjects.GameObject>(object: T): T {
    this.tracked.push(object);
    return object;
  }

  private addText(x: number, y: number, text: string, size: number, color = COLORS.white, originX = 0.5, originY = 0.5, depth = 20) {
    return this.track(
      this.add.text(x, y, text, {
        fontFamily: "Arial, Helvetica, sans-serif",
        fontSize: size + "px",
        fontStyle: size >= 28 ? "bold" : "normal",
        color: "#" + color.toString(16).padStart(6, "0"),
        stroke: "#070a11",
        strokeThickness: size >= 24 ? 4 : 2,
      }).setOrigin(originX, originY).setDepth(depth),
    );
  }

  private clearScene() {
    this.comboPopup?.destroy();
    this.comboPopup = undefined;
    this.feverImpact?.destroy();
    this.feverImpact = undefined;
    this.playerVisual?.destroy();
    this.playerVisual = undefined;
    this.bossVisual?.destroy();
    this.bossVisual = undefined;
    this.hitFeedback.reset();
    this.tweens.killAll();
    this.time.removeAllEvents();
    if (this.music) {
      this.music.stop();
      this.music.destroy();
      this.music = undefined;
    }
    for (const object of this.tracked) object.destroy();
    this.tracked = [];
    this.stateObjects = [];
    this.runnerTiles = [];
    this.runnerObjects = [];
    this.bossScraps = [];
    this.player = undefined as unknown as Phaser.GameObjects.Sprite;
    this.playerSlash = undefined as unknown as Phaser.GameObjects.Image;
    this.feverText = undefined;
    this.bossHint = undefined;
    this.pauseButton = undefined;
    this.scoreText = undefined;
    this.heartsText = undefined;
    this.comboText = undefined;
    this.coinsText = undefined;
    this.feverFill = undefined;
    this.feverTrack = undefined;
    this.feverLabel = undefined;
    this.bossFill = undefined;
    this.bossTimerFill = undefined;
    this.bossLabel = undefined;
    this.hintText = undefined;
    this.feedbackText = undefined;
    this.settingsButton = undefined;
    this.swordDebugRoot = undefined;
    this.swordDebugPanel = undefined;
    this.swordDebugToggleLabel = undefined;
    this.swordDebugValueText = undefined;
    this.swordAlwaysLabel = undefined;
    this.invincibleLabel = undefined;
    this.audioSettingLabel = undefined;
    this.attackVibrationLabel = undefined;
    this.hurtVibrationLabel = undefined;
    this.settingsOverlayOpen = false;
    this.paused = false;
    this.pressStartedAt = -1;
    this.keyboardPressed = false;
  }

  private playMusic(key: string) {
    if (this.music) this.music.stop();
    this.music = this.sound.add(key, { loop: true, volume: 0.24 });
    try { this.music.play(); } catch { /* Browser autoplay is user-gesture gated. */ }
  }

  private playSfx(key: string, volume = 0.55) {
    try { this.sound.play(key, { volume }); } catch { /* Optional audio. */ }
  }

  private addBackdrop(key: string, darkness = 0) {
    this.track(this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, key).setDisplaySize(GAME_WIDTH, GAME_HEIGHT).setDepth(-100));
    if (darkness > 0) this.track(this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, COLORS.ink, darkness).setDepth(-90));
  }

  private showIntro() {
    this.clearScene();
    this.mode = "intro";
    this.addBackdrop("introBg", 0.15);
    this.track(this.add.image(GAME_WIDTH / 2, 350, "logo").setDisplaySize(560, 374).setDepth(5));
    this.addText(GAME_WIDTH / 2, 560, "TAP TO START", 22, COLORS.white, 0.5, 0.5, 10);
    this.addText(GAME_WIDTH / 2, 665, "GODOT ASSET CONVERSION  //  PHASER 2D WEB", 12, COLORS.muted, 0.5, 0.5, 10);
    this.playMusic("lobbyMusic");
  }

  private animateIntro() {
    const logo = this.tracked.find((object) => object instanceof Phaser.GameObjects.Image && object.texture.key === "logo") as Phaser.GameObjects.Image | undefined;
    if (logo) logo.setScale(1 + Math.sin(this.time.now / 470) * 0.035);
  }

  private showMenu() {
    this.clearScene();
    this.mode = "menu";
    this.addBackdrop("introBg", 0.2);
    this.track(this.add.image(132, 100, "logo").setDisplaySize(220, 147).setDepth(5));
    this.track(this.add.image(335, 385, "playerPreview").setDisplaySize(390, 520).setDepth(4));
    const title = this.addText(960, 150, "SLASH RUSH", 42, COLORS.cream, 0.5, 0.5, 10);
    title.setShadow(0, 4, "#000000", 8, true, true);
    this.makeButton("PLAY", 945, 260, 310, 68, () => this.startRunner());
    this.makeButton("CHARACTER", 945, 356, 310, 68, () => this.showCharacterSelect());
    this.makeButton("HOW TO", 945, 452, 310, 68, () => this.showHowTo());
    const settings = this.track(this.add.image(1218, 56, "settingsIcon").setDisplaySize(48, 48).setDepth(10).setInteractive({ useHandCursor: true }));
    settings.on("pointerdown", () => { this.playSfx("uiClick"); this.showSettingsCard(); });
    this.addText(640, 670, "COINS: " + this.coins + "    BEST SCORE: " + this.bestScore, 19, COLORS.white, 0.5, 0.5, 10);
    this.playMusic("lobbyMusic");
  }

  private makeButton(text: string, x: number, y: number, width: number, height: number, callback: () => void) {
    const button = this.track(this.add.image(x, y, "menuButton").setDisplaySize(width, height).setDepth(8).setInteractive({ useHandCursor: true }));
    this.addText(x, y, text, 26, COLORS.white, 0.5, 0.5, 9);
    button.on("pointerover", () => button.setTint(0xffe3a0));
    button.on("pointerout", () => button.clearTint());
    button.on("pointerdown", () => { this.playSfx("uiClick", 0.42); callback(); });
    return button;
  }

  private showSettingsCard() {
    if (this.settingsOverlayOpen) return;
    this.settingsOverlayOpen = true;
    if (this.mode === "runner" || this.mode === "boss") {
      this.paused = true;
      this.pauseButton?.setText("▶");
    }
    const shade = this.track(this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, COLORS.ink, 0.72).setDepth(40));
    const panel = this.track(this.add.rectangle(GAME_WIDTH / 2, 360, 540, 440, COLORS.panel, 0.98).setStrokeStyle(2, COLORS.gold, 1).setDepth(41));
    this.stateObjects.push(shade, panel);
    const title = this.addText(GAME_WIDTH / 2, 194, "SETTING", 36, COLORS.cream, 0.5, 0.5, 42);
    const note = this.addText(GAME_WIDTH / 2, 232, "Audio and haptic feedback", 16, COLORS.muted, 0.5, 0.5, 42);
    this.audioSettingLabel = this.addText(GAME_WIDTH / 2, 282, "AUDIO 100%", 18, COLORS.white, 0.5, 0.5, 42);
    this.stateObjects.push(title, note, this.audioSettingLabel);
    this.makeOverlayButton("−", 490, 282, 54, 42, () => this.changeAudioVolume(-0.1));
    this.makeOverlayButton("+", 790, 282, 54, 42, () => this.changeAudioVolume(0.1));
    this.attackVibrationLabel = this.makeOverlayButton("ATTACK VIBRATION: ON", GAME_WIDTH / 2, 340, 300, 44, () => {
      this.settings = { ...this.settings, attackVibration: !this.settings.attackVibration };
      this.persistSettings();
    });
    this.hurtVibrationLabel = this.makeOverlayButton("HURT VIBRATION: ON", GAME_WIDTH / 2, 394, 300, 44, () => {
      this.settings = { ...this.settings, hurtVibration: !this.settings.hurtVibration };
      this.persistSettings();
    });
    this.invincibleLabel = this.makeOverlayButton("INVINCIBLE: OFF", GAME_WIDTH / 2, 448, 300, 44, () => {
      this.invincibleMode = !this.invincibleMode;
      this.updateSettingsLabels();
      this.updateHud();
    });
    this.makeOverlayButton("CLOSE", GAME_WIDTH / 2, 512, 170, 46, () => this.closeOverlayCard());
    this.updateSettingsLabels();
  }

  private closeOverlayCard() {
    for (const object of this.stateObjects) object.destroy();
    this.stateObjects = [];
    this.invincibleLabel = undefined;
    this.audioSettingLabel = undefined;
    this.attackVibrationLabel = undefined;
    this.hurtVibrationLabel = undefined;
    this.settingsOverlayOpen = false;
    if (this.mode === "runner" || this.mode === "boss") {
      this.paused = false;
      this.pauseButton?.setText("Ⅱ");
    }
  }

  private makeOverlayButton(text: string, x: number, y: number, width: number, height: number, callback: () => void) {
    const button = this.track(this.add.rectangle(x, y, width, height, COLORS.gold, 1).setDepth(45).setInteractive({ useHandCursor: true }));
    const label = this.addText(x, y, text, 18, COLORS.ink, 0.5, 0.5, 46);
    this.stateObjects.push(button, label);
    button.on("pointerdown", callback);
    return label;
  }

  private createSwordDebugPanel() {
    const root = this.track(this.add.container(1000, 90).setDepth(34));
    const toggle = this.add.rectangle(140, 0, 280, 44, COLORS.panel, 0.96)
      .setStrokeStyle(2, COLORS.cyan, 1)
      .setInteractive({ useHandCursor: true });
    const toggleLabel = this.add.text(140, 0, "SWORD DEBUG ▲", {
      fontFamily: "Arial, Helvetica, sans-serif",
      fontSize: "16px",
      fontStyle: "bold",
      color: "#" + COLORS.white.toString(16).padStart(6, "0"),
      stroke: "#070a11",
      strokeThickness: 2,
    }).setOrigin(0.5);
    const panel = this.add.container(0, 26);
    const panelBackground = this.add.rectangle(140, 245, 280, 440, COLORS.panel, 0.96)
      .setStrokeStyle(2, COLORS.cyan, 1);
    panel.add(panelBackground);
    panel.add(this.add.text(140, 58, "SWORD DEBUG", {
      fontFamily: "Arial, Helvetica, sans-serif",
      fontSize: "18px",
      fontStyle: "bold",
      color: "#" + COLORS.cyan.toString(16).padStart(6, "0"),
      stroke: "#070a11",
      strokeThickness: 2,
    }).setOrigin(0.5));
    this.swordDebugValueText = this.add.text(140, 88, "", {
      fontFamily: "Arial, Helvetica, sans-serif",
      fontSize: "15px",
      color: "#" + COLORS.white.toString(16).padStart(6, "0"),
      stroke: "#070a11",
      strokeThickness: 2,
    }).setOrigin(0.5);
    panel.add(this.swordDebugValueText);
    this.swordAlwaysLabel = this.makeSwordDebugButton(panel, "SWORD ALWAYS: OFF", 140, 128, 240, 40, () => {
      this.swordDebugAlwaysVisible = !this.swordDebugAlwaysVisible;
      this.applySwordDebugTransform();
      this.updateSettingsLabels();
    });
    this.makeSwordDebugButton(panel, "X -1", 72, 188, 120, 42, () => this.adjustSword(-1, 0, 0));
    this.makeSwordDebugButton(panel, "X +1", 208, 188, 120, 42, () => this.adjustSword(1, 0, 0));
    this.makeSwordDebugButton(panel, "Y -1", 72, 240, 120, 42, () => this.adjustSword(0, -1, 0));
    this.makeSwordDebugButton(panel, "Y +1", 208, 240, 120, 42, () => this.adjustSword(0, 1, 0));
    this.makeSwordDebugButton(panel, "SIZE -10", 72, 292, 120, 42, () => this.adjustSword(0, 0, -10));
    this.makeSwordDebugButton(panel, "SIZE +10", 208, 292, 120, 42, () => this.adjustSword(0, 0, 10));
    panel.add(this.add.text(140, 355, "Adjust X / Y / SIZE\nlive during play.", {
      fontFamily: "Arial, Helvetica, sans-serif",
      fontSize: "14px",
      color: "#" + COLORS.muted.toString(16).padStart(6, "0"),
      align: "center",
      stroke: "#070a11",
      strokeThickness: 2,
    }).setOrigin(0.5));
    root.add([toggle, toggleLabel, panel]);
    this.swordDebugRoot = root;
    this.swordDebugPanel = panel;
    this.swordDebugToggleLabel = toggleLabel;
    toggle.on("pointerdown", () => {
      this.playSfx("uiClick", 0.4);
      this.setSwordDebugPanelOpen(!panel.visible);
    });
    this.setSwordDebugPanelOpen(false);
    this.updateSettingsLabels();
  }

  private makeSwordDebugButton(
    parent: Phaser.GameObjects.Container,
    text: string,
    x: number,
    y: number,
    width: number,
    height: number,
    callback: () => void,
  ) {
    const button = this.add.rectangle(x, y, width, height, COLORS.gold, 1)
      .setStrokeStyle(1, COLORS.cream, 0.85)
      .setInteractive({ useHandCursor: true });
    const label = this.add.text(x, y, text, {
      fontFamily: "Arial, Helvetica, sans-serif",
      fontSize: "15px",
      fontStyle: "bold",
      color: "#" + COLORS.ink.toString(16).padStart(6, "0"),
      stroke: "#" + COLORS.cream.toString(16).padStart(6, "0"),
      strokeThickness: 1,
    }).setOrigin(0.5);
    parent.add([button, label]);
    button.on("pointerdown", () => {
      this.playSfx("uiClick", 0.4);
      callback();
    });
    return label;
  }

  private setSwordDebugPanelOpen(open: boolean) {
    this.swordDebugPanel?.setVisible(open);
    this.swordDebugToggleLabel?.setText("SWORD DEBUG " + (open ? "▲" : "▼"));
  }

  private updateSettingsLabels() {
    this.swordAlwaysLabel?.setText("SWORD ALWAYS: " + (this.swordDebugAlwaysVisible ? "ON" : "OFF"));
    this.invincibleLabel?.setText("INVINCIBLE: " + (this.invincibleMode ? "ON" : "OFF"));
    this.audioSettingLabel?.setText("AUDIO " + Math.round(this.settings.masterVolume * 100) + "%");
    this.attackVibrationLabel?.setText("ATTACK VIBRATION: " + (this.settings.attackVibration ? "ON" : "OFF"));
    this.hurtVibrationLabel?.setText("HURT VIBRATION: " + (this.settings.hurtVibration ? "ON" : "OFF"));
    this.swordDebugValueText?.setText(
      "X " + Math.round(this.swordX) + "   Y " + Math.round(this.swordY) + "   SIZE " + Math.round(this.swordWidth) + " x " + Math.round(this.swordHeight),
    );
  }

  private adjustSword(deltaX: number, deltaY: number, deltaSize: number) {
    this.swordX += deltaX;
    this.swordY += deltaY;
    if (deltaSize !== 0) {
      this.swordWidth = Math.max(55, this.swordWidth + deltaSize);
      this.swordHeight = Math.max(32, Math.round(this.swordWidth * (117 / 205)));
    }
    this.applySwordDebugTransform();
    this.updateSettingsLabels();
  }

  private changeAudioVolume(delta: number) {
    this.settings = changeMasterVolume(this.settings, delta);
    this.persistSettings();
  }

  private persistSettings() {
    this.sound.volume = this.settings.masterVolume;
    saveGameSettings(this.settings, localStorage);
    this.updateSettingsLabels();
  }

  private showCharacterSelect() {
    this.clearScene();
    this.mode = "character";
    this.track(this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x0b0d12, 1).setDepth(-100));
    this.makeSimpleBackButton(() => this.showMenu());
    this.addText(GAME_WIDTH / 2, 66, "CHARACTER", 42, COLORS.cream, 0.5, 0.5, 10);
    this.addText(GAME_WIDTH / 2, 118, "Select your runner", 16, COLORS.muted, 0.5, 0.5, 10);
    const startX = 172;
    for (let index = 1; index <= 5; index += 1) this.makeCharacterCard(index, startX + (index - 1) * 220, 350, index === 1);
    const comingX = startX + 5 * 220;
    const card = this.track(this.add.rectangle(comingX, 350, 206, 370, COLORS.panel, 1).setStrokeStyle(1, 0x586071, 1).setDepth(2).setInteractive());
    this.addText(comingX, 300, "?", 90, COLORS.muted, 0.5, 0.5, 4);
    this.addText(comingX, 418, "+", 28, COLORS.gold, 0.5, 0.5, 4);
    this.addText(comingX, 515, "COMING SOON", 15, COLORS.muted, 0.5, 0.5, 4);
    card.on("pointerdown", () => this.showToast("Coming soon"));
    this.addText(GAME_WIDTH / 2, 655, "More characters will be available in future versions.", 16, COLORS.muted, 0.5, 0.5, 10);
  }

  private makeCharacterCard(index: number, x: number, y: number, selected: boolean) {
    const fill = selected ? 0x17130b : 0x151923;
    const stroke = selected ? COLORS.gold : 0x424754;
    const card = this.track(this.add.rectangle(x, y, 206, 370, fill, 1).setStrokeStyle(selected ? 4 : 1, stroke, 1).setDepth(2).setInteractive());
    this.track(this.add.rectangle(x, y - 45, 178, 252, 0xffffff, 1).setDepth(3));
    const portrait = this.track(this.add.image(x, y - 45, "character" + index).setDisplaySize(178, 252).setDepth(4));
    if (index !== 1) {
      this.track(this.add.rectangle(x, y - 45, 178, 252, COLORS.ink, 0.58).setDepth(5));
      this.addText(x, y - 45, "LOCKED", 24, COLORS.white, 0.5, 0.5, 6);
    }
    this.addText(x, y - 168, "PLAYER " + index, 18, selected ? COLORS.cream : COLORS.white, 0.5, 0.5, 6);
    this.track(this.add.rectangle(x, y + 143, 170, 38, selected ? COLORS.gold : 0x1e2430, 1).setDepth(3));
    this.addText(x, y + 143, selected ? "SELECTED" : "LOCKED", 14, selected ? COLORS.ink : COLORS.muted, 0.5, 0.5, 6);
    card.on("pointerdown", () => this.showToast(index === 1 ? "Selected" : "Coming soon"));
    portrait.setData("characterId", index);
  }

  private showHowTo() {
    this.clearScene();
    this.mode = "howto";
    this.track(this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x0b0d12, 1).setDepth(-100));
    this.makeSimpleBackButton(() => this.showMenu());
    this.addText(GAME_WIDTH / 2, 65, "HOW TO PLAY", 42, COLORS.cream, 0.5, 0.5, 10);
    const cards = [
      ["TAP", "enemyBasic", "기본 몬스터와 폭탄은\n한 번 탭해서 제거하세요.", COLORS.gold],
      ["TAP TAP", "enemyFast", "빠른 몬스터는\n두 번 연속 공격하세요.", 0xff7d6e],
      ["HOLD", "enemyArmor", "갑옷 몬스터는\n길게 눌러 처리하세요.", COLORS.blue],
      ["ITEMS", "feverOrb", "Coin / Fever Orb / Heal은\n베지 말고 통과 수집하세요.", COLORS.green],
      ["COMBO & FEVER", "combo", "연속 성공으로 FEVER!\n속도와 공격 범위가 상승합니다.", COLORS.cyan],
    ] as const;
    cards.forEach(([title, key, description, color], index) => {
      const x = 150 + index * 245;
      this.track(this.add.rectangle(x, 365, 222, 390, COLORS.panel, 1).setStrokeStyle(2, color, 1).setDepth(2));
      this.addText(x, 218, title, title === "COMBO & FEVER" ? 20 : 25, color, 0.5, 0.5, 6);
      const image = this.track(this.add.image(x, 350, key).setDepth(4));
      if (key === "combo") image.setDisplaySize(180, 135);
      else image.setDisplaySize(132, 132);
      this.addText(x, 500, description, 15, COLORS.white, 0.5, 0.5, 6).setLineSpacing(8).setWordWrapWidth(194);
    });
    this.addText(GAME_WIDTH / 2, 670, "60초 러너 이후 로봇 사무라이 보스전이 이어집니다.", 15, COLORS.muted, 0.5, 0.5, 10);
  }

  private makeSimpleBackButton(callback: () => void) {
    const button = this.track(this.add.text(58, 46, "< BACK", {
      fontFamily: "Arial, Helvetica, sans-serif",
      fontSize: "20px",
      color: "#f7f4ed",
      stroke: "#070a11",
      strokeThickness: 3,
    }).setOrigin(0, 0.5).setDepth(12).setInteractive({ useHandCursor: true }));
    button.on("pointerdown", () => { this.playSfx("uiClick", 0.4); callback(); });
  }

  private showToast(message: string) {
    const toast = this.track(this.add.text(GAME_WIDTH / 2, 610, message, {
      fontFamily: "Arial, Helvetica, sans-serif",
      fontSize: "22px",
      color: "#ffefc0",
      backgroundColor: "#151923",
      padding: { left: 22, right: 22, top: 12, bottom: 12 },
    }).setOrigin(0.5).setDepth(30));
    this.tweens.add({ targets: toast, alpha: 0, y: 585, delay: 650, duration: 250, onComplete: () => toast.destroy() });
  }

  private registerAlphaKeyPipeline() {
    if (this.game.renderer.type !== Phaser.WEBGL) return;
    const renderer = this.game.renderer as Phaser.Renderer.WebGL.WebGLRenderer;
    if (renderer.pipelines.get("SlashRushAlphaKey")) return;
    const fragmentShader = [
      "#define SHADER_NAME SLASH_RUSH_ALPHA_KEY_FS",
      "#ifdef GL_FRAGMENT_PRECISION_HIGH",
      "precision highp float;",
      "#else",
      "precision mediump float;",
      "#endif",
      "uniform sampler2D uMainSampler;",
      "varying vec2 outTexCoord;",
      "varying float outTintEffect;",
      "varying vec4 outTint;",
      "void main () {",
      "  vec4 texture = texture2D(uMainSampler, outTexCoord);",
      "  float maxChannel = max(max(texture.r, texture.g), texture.b);",
      "  float minChannel = min(min(texture.r, texture.g), texture.b);",
      "  if (minChannel > 0.86 && (maxChannel - minChannel) < 0.045) texture.a = 0.0;",
      "  vec4 texel = vec4(outTint.bgr * outTint.a, outTint.a);",
      "  vec4 color = texture * texel;",
      "  if (outTintEffect == 1.0) color.rgb = mix(texture.rgb, outTint.bgr * outTint.a, texture.a);",
      "  else if (outTintEffect == 2.0) color = texel;",
      "  gl_FragColor = color;",
      "}",
    ].join("\n");
    renderer.pipelines.add("SlashRushAlphaKey", new Phaser.Renderer.WebGL.Pipelines.SinglePipeline({
      game: this.game,
      name: "SlashRushAlphaKey",
      fragShader: fragmentShader,
    }));
  }

  private prepareAlphaKeyTexture(sourceKey: string, targetKey: string) {
    if (this.textures.exists(targetKey)) return;
    const source = this.textures.get(sourceKey).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
    const canvas = document.createElement("canvas");
    canvas.width = source.width;
    canvas.height = source.height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return;
    context.drawImage(source, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    for (let index = 0; index < pixels.data.length; index += 4) {
      const red = pixels.data[index];
      const green = pixels.data[index + 1];
      const blue = pixels.data[index + 2];
      const maximum = Math.max(red, green, blue);
      const minimum = Math.min(red, green, blue);
      if (maximum > 219 && maximum - minimum < 12) pixels.data[index + 3] = 0;
    }
    context.putImageData(pixels, 0, 0);
    this.textures.addCanvas(targetKey, canvas);
  }

  private buildRunnerBackground() {
    this.registerAlphaKeyPipeline();
    ["clouds", "farMountains", "midStructures", "nearForeground", "ground"].forEach((key) => this.prepareAlphaKeyTexture(key, key + "Keyed"));
    // The Godot sky texture carries a transparent color-key in some exports.
    // Keep it in the stack, but provide the same green-to-gold sky underneath
    // so the browser never exposes the canvas' default white clear color.
    const skyFallback = this.track(this.add.graphics().setDepth(-110));
    skyFallback.fillGradientStyle(0x78d85e, 0x78d85e, 0xf0c65b, 0xf0c65b, 1);
    skyFallback.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    // `sky_static.png` is exported with a white matte in the downloaded
    // Godot package, so the browser uses the matching gradient fallback
    // above and keeps the parallax art layers transparent over it.
    const clouds = this.track(this.add.tileSprite(0, 0, GAME_WIDTH, GAME_HEIGHT, "cloudsKeyed").setOrigin(0).setDepth(-90));
    clouds.setTileScale(0.68, 0.68);
    const far = this.track(this.add.tileSprite(0, -120, GAME_WIDTH, GAME_HEIGHT, "farMountainsKeyed").setOrigin(0).setDepth(-80));
    far.setTileScale(0.995, 0.995);
    const mid = this.track(this.add.tileSprite(0, -120, GAME_WIDTH, GAME_HEIGHT, "midStructuresKeyed").setOrigin(0).setDepth(-70));
    mid.setTileScale(0.995, 0.995);
    const near = this.track(this.add.tileSprite(0, -120, GAME_WIDTH, GAME_HEIGHT, "nearForegroundKeyed").setOrigin(0).setDepth(-60));
    near.setTileScale(0.995, 0.995);
    const ground = this.track(this.add.tileSprite(0, 278, GAME_WIDTH, 720, "groundKeyed").setOrigin(0).setDepth(0));
    ground.setTileScale(1.27, 1.27);
    this.runnerTiles = [clouds, far, mid, near, ground];
  }

  private buildHud(boss = false) {
    this.track(this.add.rectangle(GAME_WIDTH / 2, 38, GAME_WIDTH - 36, 74, 0x090c16, 0.36).setDepth(15));
    this.scoreText = this.addText(28, 27, "SCORE 000000", 24, COLORS.white, 0, 0.5, 20);
    this.heartsText = this.addText(282, 27, "♥ ♥ ♥", 28, 0xff5b6d, 0, 0.5, 20);
    this.comboText = this.addText(440, 27, "COMBO 0", 23, COLORS.cream, 0, 0.5, 20).setVisible(!boss);
    this.coinsText = this.addText(600, 27, "COIN 0", 23, COLORS.gold, 0, 0.5, 20).setVisible(!boss);
    this.feverTrack = this.track(this.add.rectangle(782, 28, 264, 22, COLORS.ink, 0.48).setOrigin(0, 0.5).setDepth(19).setVisible(!boss));
    this.feverFill = this.track(this.add.rectangle(784, 28, 0, 16, COLORS.cyan, 1).setOrigin(0, 0.5).setDepth(20));
    this.feverFill.setVisible(!boss);
    this.feverLabel = this.addText(786, 54, "FEVER", 14, COLORS.white, 0, 0.5, 20).setVisible(!boss);
    this.feedbackText = this.addText(GAME_WIDTH / 2, 144, "", 42, COLORS.white, 0.5, 0.5, 25);
    this.feedbackText.setAlpha(0);
    this.hintText = this.addText(GAME_WIDTH / 2, 672, boss ? "" : "TAP / TAP TAP / HOLD  //  DON'T CUT ITEMS", 20, COLORS.white, 0.5, 0.5, 20);
    this.settingsButton = this.track(this.add.image(1168, 30, "settingsIcon").setDisplaySize(34, 34).setDepth(25).setInteractive({ useHandCursor: true }));
    this.settingsButton.on("pointerdown", () => { this.playSfx("uiClick", 0.4); this.showSettingsCard(); });
    this.pauseButton = this.addText(1218, 30, "Ⅱ", 28, COLORS.white, 0.5, 0.5, 25).setInteractive({ useHandCursor: true });
    this.pauseButton.on("pointerdown", () => this.togglePause());
    this.createSwordDebugPanel();
    if (boss) {
      this.track(this.add.rectangle(956, 84, 304, 20, COLORS.ink, 0.55).setOrigin(0, 0.5).setDepth(19));
      this.bossFill = this.track(this.add.rectangle(958, 84, 300, 16, COLORS.red, 1).setOrigin(0, 0.5).setDepth(20));
      this.bossLabel = this.addText(956, 110, "BOSS 10/10", 18, COLORS.white, 0, 0.5, 20);
      this.track(this.add.rectangle(956, 142, 304, 14, COLORS.ink, 0.32).setOrigin(0, 0.5).setDepth(19));
      this.bossTimerFill = this.track(this.add.rectangle(958, 144, 300, 10, COLORS.white, 1).setOrigin(0, 0.5).setDepth(20));
    }
    this.updateHud();
  }

  private updateHud() {
    this.scoreText?.setText("SCORE " + String(this.score).padStart(6, "0"));
    const hearts = [0, 1, 2].map((index) => index < this.health ? "♥" : "♡").join(" ");
    this.heartsText?.setText(hearts);
    this.comboText?.setText("COMBO " + this.combo).setVisible(this.mode !== "boss");
    this.coinsText?.setText("COIN " + this.coins).setVisible(this.mode !== "boss");
    this.feverTrack?.setVisible(this.mode !== "boss");
    this.feverFill?.setVisible(this.mode !== "boss").setSize(260 * clamp(this.fever / MAX_FEVER, 0, 1), 16);
    this.feverLabel?.setVisible(this.mode !== "boss");
    if (this.mode === "boss") {
      this.bossFill?.setSize(300 * clamp(this.bossHp / BOSS_MAX_HP, 0, 1), 16);
      this.bossLabel?.setText(this.bossFeverActive
        ? "BOSS FEVER " + this.bossFeverTimeLeft.toFixed(1) + "s"
        : "BOSS " + this.bossHp + "/" + BOSS_MAX_HP);
      this.bossTimerFill?.setSize(300 * this.bossTimerRatio(), 10);
    }
  }

  private createRunnerPlayer() {
    this.playerVisual = new PlayerVisualController(this, {
      x: this.swordX,
      y: this.swordY,
      width: this.swordWidth,
      height: this.swordHeight,
      debugAlwaysVisible: this.swordDebugAlwaysVisible,
    });
    this.player = this.playerVisual.sprite;
    this.playerSlash = this.playerVisual.slashSprite;
  }

  private applySwordDebugTransform() {
    this.playerVisual?.setSwordTransform(this.swordX, this.swordY, this.swordWidth, this.swordHeight);
    this.playerVisual?.setDebugAlwaysVisible(this.swordDebugAlwaysVisible);
  }

  private startRunner() {
    this.clearScene();
    this.mode = "runner";
    this.score = 0;
    this.coins = Number(localStorage.getItem("slashrush-coins") || 0);
    this.combo = 0;
    this.health = STARTING_HP;
    this.fever = 0;
    this.feverActive = false;
    this.feverTimeLeft = 0;
    this.runnerElapsed = 0;
    this.schedule = buildRunnerSchedule();
    this.scheduleIndex = 0;
    this.buildRunnerBackground();
    this.createRunnerPlayer();
    this.buildHud();
    this.feverImpact = new FeverImpactOverlay(this, 12);
    this.comboPopup = new ComboImpactPopup(this);
    this.feverText = this.addText(GAME_WIDTH / 2, 220, "TAP!!", 74, COLORS.cream, 0.5, 0.5, 24);
    this.feverText.setVisible(false);
    this.playMusic("runningMusic");
    this.playSfx("startGame", 0.55);
    this.updateHud();
  }

  private updateRunner(seconds: number) {
    this.hitFeedback.update(seconds);
    this.runnerElapsed += seconds;
    this.feedbackTimer = Math.max(0, this.feedbackTimer - seconds);
    this.playerVisual?.update(seconds, this.feverActive ? 3 : 1);
    this.feverImpact?.update(seconds);
    if (this.feedbackTimer <= 0) this.feedbackText?.setAlpha(0);
    const motion = this.hitFeedback.motionScale;
    const feverScrollMultiplier = this.feverActive ? 2 : 1;
    this.runnerTiles.forEach((tile, index) => {
      const speed = [0.02, 0.24, 0.58, 1.12, 2.05][index] || 1;
      tile.tilePositionX += 780 * speed * seconds * motion.background * feverScrollMultiplier;
    });
    while (this.scheduleIndex < this.schedule.length && this.schedule[this.scheduleIndex].time <= this.runnerElapsed) {
      if (!this.feverActive) this.spawnRunnerObject(this.schedule[this.scheduleIndex].type);
      this.scheduleIndex += 1;
    }
    if (this.feverActive) {
      this.feverTimeLeft -= seconds;
      this.feverSpawnTimer -= seconds;
      if (this.feverSpawnTimer <= 0 && this.feverTimeLeft > 1) {
        this.feverSpawnTimer = 0.18;
        this.spawnRunnerObject(["enemy_basic", "enemy_basic", "enemy_fast", "bomb"][Phaser.Math.Between(0, 3)] as RunnerObjectType, true);
      }
      if (this.feverTimeLeft <= 0) this.endFever();
      this.feverText?.setScale(feverTapPulse(FEVER_DURATION - this.feverTimeLeft));
    }
    const speed = this.feverActive ? 840 : 420;
    for (const object of [...this.runnerObjects]) {
      if (object.handled) continue;
      object.x -= speed * seconds * motion.objects;
      object.sprite.x = object.x;
      object.shadow?.setPosition(object.x, MONSTER_SHADOW_Y).setVisible(!object.handled);
      if (object.rule.good) object.sprite.y = object.baseY + Math.sin(this.time.now / 160 + object.phase) * 5;
      else {
        const jump = Math.abs(Math.sin(this.time.now / (object.type === "enemy_fast" ? 230 : 330) + object.phase));
        object.sprite.y = object.baseY - jump * (object.type === "enemy_fast" ? 44 : object.type === "enemy_armor" ? 10 : 16);
      }
      if (object.x < 200) this.handlePassedObject(object);
    }
    if (this.runnerElapsed >= RUNNER_DURATION) {
      this.startBoss();
      return;
    }
    this.updateHud();
  }

  private spawnRunnerObject(type: RunnerObjectType, feverSpawn = false) {
    const rule = OBJECT_RULES[type];
    const baseY = 610 + rule.yOffset;
    const isMonster = type === "enemy_basic" || type === "enemy_fast" || type === "enemy_armor";
    const shadow = isMonster
      ? this.track(this.add.ellipse(1400, MONSTER_SHADOW_Y, MONSTER_SHADOW_WIDTH, MONSTER_SHADOW_HEIGHT, 0x000000, 0.34)
        .setDepth(1)
        .setName(type + "Shadow"))
      : undefined;
    const sprite = this.track(this.add.image(1400, baseY, rule.key).setOrigin(0.5, 1).setDepth(4));
    const texture = this.textures.get(rule.key).getSourceImage() as HTMLImageElement;
    sprite.setDisplaySize(rule.height * (texture.width / texture.height), rule.height);
    if (rule.good) sprite.setDepth(3);
    if (feverSpawn) sprite.setTint(0xc7faff);
    this.runnerObjects.push({ type, rule, sprite, shadow, x: 1400, baseY, phase: Math.random() * Math.PI * 2, handled: false, feverSpawn });
  }

  private handlePassedObject(object: RunnerObject) {
    if (object.handled) return;
    if (this.feverActive) { this.removeRunnerObject(object); return; }
    if (object.rule.good) this.collectGoodItem(object);
    else this.failObject(object, false);
  }

  private nearestActionObject() {
    return this.runnerObjects.filter((object) => !object.handled && object.x >= 270 && object.x <= 510)
      .sort((left, right) => Math.abs(left.x - 390) - Math.abs(right.x - 390))[0];
  }

  private handleRunnerAction(action: SlashAction) {
    if (this.hitFeedback.isHurt) return;
    this.playPlayerSlash(action === "long_tap");
    const target = this.feverActive
      ? this.runnerObjects.filter((object) => !object.handled && object.x >= 270 && object.x <= 510)
      : [this.nearestActionObject()].filter(Boolean) as RunnerObject[];
    if (target.length === 0) return;
    for (const object of target) {
      if (object.rule.good) {
        if (this.feverActive) this.collectFeverGoodItem(object);
        else this.breakGoodItem(object);
      } else if (actionMatches(object.rule.required, action, this.feverActive)) {
        this.successObject(object);
      } else if (object.rule.required === "double_tap" && action === "tap") {
        this.showFeedback("TAP TAP!", COLORS.gold);
      } else if (object.rule.required === "long_tap" && action === "tap") {
        this.showFeedback("HOLD!", COLORS.blue);
      } else {
        this.failObject(object, true);
      }
    }
  }

  private playPlayerSlash(strong = false) {
    if (!this.playerVisual?.playSlash(strong)) return;
    this.playSfx("slashSfx", 0.35);
    triggerHaptic("attack", this.settings);
  }

  private successObject(object: RunnerObject) {
    if (object.handled) return;
    object.handled = true;
    const multiplier = this.feverActive ? 2 : scoreMultiplier(this.combo);
    this.score += object.rule.score * multiplier;
    if (!this.feverActive) {
      this.fever = clamp(this.fever + object.rule.fever, 0, MAX_FEVER);
      this.combo += 1;
      this.comboPopup?.play(this.combo);
    }
    this.spawnEnemyHitEffect(object);
    this.spawnSlicePieces(object);
    if (this.fever >= MAX_FEVER) this.startFever();
    this.showFeedback("+" + object.rule.score * multiplier, COLORS.white);
    // The source object must disappear immediately; only the two slice pieces
    // should remain visible during the short defeat animation.
    this.removeRunnerObject(object);
    this.applyImpact(0.05, 4);
    this.updateHud();
  }

  private failObject(object: RunnerObject, sliced: boolean) {
    if (object.handled) return;
    object.handled = true;
    if (this.invincibleMode) {
      if (sliced) {
        this.spawnEnemyHitEffect(object, 0xff5368);
        this.spawnSlicePieces(object, 0xc83f3f);
      }
      this.showFeedback("INVINCIBLE", COLORS.cyan);
      this.removeRunnerObject(object);
      return;
    }
    if (this.feverActive) { this.removeRunnerObject(object); return; }
    this.combo = 0;
    this.health -= 1;
    if (sliced) {
      this.spawnEnemyHitEffect(object, 0xff5368);
      this.spawnSlicePieces(object, 0xc83f3f);
    }
    this.showFeedback(sliced ? "MISS!" : "-HP", COLORS.red);
    this.startPlayerHurt();
    this.removeRunnerObject(object);
    this.applyImpact(0.04, 5);
    if (this.health <= 0) this.finishResult(false);
    this.updateHud();
  }

  private collectGoodItem(object: RunnerObject) {
    if (object.handled) return;
    object.handled = true;
    this.playSfx("pickupSfx", 0.42);
    if (object.type === "coin") {
      this.coins += object.rule.score;
      this.score += object.rule.score;
      this.showFeedback("+20", COLORS.gold);
    } else if (object.type === "heal") {
      const healed = this.health < MAX_HP;
      if (healed) this.health += 1;
      this.showFeedback(healed ? "+HP" : "MAX", COLORS.green);
    } else if (object.type === "fever_orb") {
      this.score += object.rule.score;
      this.fever = MAX_FEVER;
      this.startFever();
    }
    this.removeRunnerObject(object);
    this.updateHud();
  }

  private collectFeverGoodItem(object: RunnerObject) {
    if (object.handled) return;
    object.handled = true;
    this.coins += 20;
    this.score += 40;
    this.showFeedback("+20", COLORS.gold);
    this.removeRunnerObject(object);
  }

  private breakGoodItem(object: RunnerObject) {
    if (object.handled) return;
    object.handled = true;
    this.combo = 0;
    this.fever = Math.max(0, this.fever - 18);
    this.spawnSlicePieces(object, object.rule.tint);
    this.showFeedback("BROKEN!", COLORS.gold);
    this.applyImpact(0.04, 3);
    this.removeRunnerObject(object);
    this.updateHud();
  }

  private spawnEnemyHitEffect(object: RunnerObject, tint = this.enemyHitColor(object.type)) {
    if (!object.type.startsWith("enemy_")) return;
    const x = object.x;
    const y = object.sprite.y - object.rule.height * 0.5;
    const heavy = object.type === "enemy_armor";
    const rayCount = heavy ? 10 : 8;
    const coreRadius = heavy ? 10 : 8;
    const ringRadius = heavy ? 24 : 19;
    const rayStart = heavy ? 13 : 10;
    const rayEnd = heavy ? 36 : 30;
    const impact = this.track(this.add.graphics()
      .setPosition(x, y)
      .setDepth(9)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setScale(0.62));

    impact.fillStyle(0xffffff, 0.94);
    impact.fillCircle(0, 0, coreRadius);
    impact.lineStyle(3, tint, 0.9);
    impact.strokeCircle(0, 0, ringRadius);
    impact.lineStyle(heavy ? 4 : 3, tint, 0.95);
    for (let index = 0; index < rayCount; index += 1) {
      const angle = object.phase + (Math.PI * 2 * index) / rayCount;
      impact.lineBetween(
        Math.cos(angle) * rayStart,
        Math.sin(angle) * rayStart,
        Math.cos(angle) * rayEnd,
        Math.sin(angle) * rayEnd,
      );
    }

    this.tweens.add({
      targets: impact,
      scale: heavy ? 1.42 : 1.28,
      alpha: 0,
      duration: heavy ? 270 : 220,
      ease: "Cubic.Out",
      onComplete: () => {
        this.tracked = this.tracked.filter((candidate) => candidate !== impact);
        impact.destroy();
      },
    });
  }

  private enemyHitColor(type: RunnerObjectType) {
    if (type === "enemy_fast") return 0xff6b42;
    if (type === "enemy_armor") return 0x9ec8ff;
    return 0xffd166;
  }

  private removeRunnerObject(object: RunnerObject, destroy = true) {
    if (destroy) {
      object.sprite.destroy();
      object.shadow?.destroy();
    }
    this.runnerObjects = this.runnerObjects.filter((candidate) => candidate !== object);
    this.tracked = this.tracked.filter((candidate) => candidate !== object.sprite && candidate !== object.shadow);
  }

  private spawnSlicePieces(object: RunnerObject, tint?: number) {
    const x = object.x;
    const y = object.sprite.y - object.rule.height * 0.5;
    const key = object.rule.sliceKey;
    const source = this.textures.get(key).getSourceImage() as HTMLImageElement;
    const left = this.track(this.add.image(x - 14, y, key).setOrigin(0.5, 0.5).setDisplaySize(object.rule.height * 0.48, object.rule.height).setDepth(8));
    const right = this.track(this.add.image(x + 14, y, key).setOrigin(0.5, 0.5).setDisplaySize(object.rule.height * 0.48, object.rule.height).setDepth(8));
    left.setCrop(0, 0, source.width / 2, source.height);
    right.setCrop(source.width / 2, 0, source.width / 2, source.height);
    if (tint) { left.setTint(tint); right.setTint(tint); }
    this.tweens.add({ targets: left, x: x - 115, y: y - 100, angle: -28, alpha: 0, duration: 620, onComplete: () => left.destroy() });
    this.tweens.add({ targets: right, x: x + 115, y: y - 50, angle: 28, alpha: 0, duration: 620, onComplete: () => right.destroy() });
  }

  private startFever() {
    if (this.feverActive) return;
    this.feverActive = true;
    this.feverTimeLeft = FEVER_DURATION;
    this.feverSpawnTimer = 0;
    this.fever = MAX_FEVER;
    for (const object of [...this.runnerObjects]) {
      object.handled = true;
      this.removeRunnerObject(object);
    }
    this.feverImpact?.start();
    this.feverText?.setVisible(true);
    this.showFeedback("FEVER!", COLORS.cyan);
    this.applyImpact(0.08, 7);
  }

  private endFever() {
    this.feverActive = false;
    this.fever = 0;
    for (const object of [...this.runnerObjects]) {
      if (object.feverSpawn) this.removeRunnerObject(object);
    }
    this.feverImpact?.stop();
    this.feverText?.setVisible(false);
    this.showFeedback("FEVER END", COLORS.white);
  }

  private showFeedback(text: string, color: number) {
    if (!this.feedbackText) return;
    this.feedbackText.setText(text).setColor("#" + color.toString(16).padStart(6, "0")).setAlpha(1).setScale(1.12);
    this.feedbackTimer = 0.75;
    this.tweens.add({ targets: this.feedbackText, scale: 1, duration: 120 });
  }

  private applyImpact(hitstopSeconds: number, strength: number) {
    this.hitFeedback.startHitstop(hitstopSeconds);
    this.cameras.main.shake(Math.max(40, hitstopSeconds * 1000), strength * 0.00072);
  }

  private startPlayerHurt() {
    this.hitFeedback.startHurt();
    this.playerVisual?.startHurt();
    this.playSfx("errorSfx", 0.58);
    triggerHaptic("hurt", this.settings);
  }

  private installDevelopmentHooks() {
    if (location.hostname !== "127.0.0.1" && location.hostname !== "localhost") return;
    const debugWindow = window as Window & { __slashRushDebug?: SlashRushDebugApi };
    debugWindow.__slashRushDebug = {
      getState: () => ({
        mode: this.mode,
        combo: this.combo,
        bossCombo: this.bossCombo,
        feverActive: this.feverActive,
        bossFeverActive: this.bossFeverActive,
        hurt: this.hitFeedback.isHurt,
      }),
      startRunner: () => this.startRunner(),
      startBoss: () => this.startBoss(),
      triggerCombo: () => this.triggerDebugCombo(),
      triggerFever: () => this.triggerDebugFever(),
      triggerHurt: () => this.triggerDebugHurt(),
    };
  }

  private triggerDebugCombo() {
    if (this.mode === "runner") {
      this.combo += 1;
      this.comboPopup?.play(this.combo);
    } else if (this.mode === "boss") {
      this.bossCombo += 1;
      this.comboPopup?.play(this.bossCombo);
    }
    this.updateHud();
  }

  private triggerDebugFever() {
    if (this.mode === "runner") {
      this.fever = MAX_FEVER;
      this.startFever();
    } else if (this.mode === "boss") {
      this.startBossFever();
    }
    this.updateHud();
  }

  private triggerDebugHurt() {
    if (this.mode !== "runner" && this.mode !== "boss") return;
    this.startPlayerHurt();
    this.applyImpact(0.04, 5);
  }

  private startBoss() {
    this.clearScene();
    this.mode = "boss";
    this.bossHp = BOSS_MAX_HP;
    this.bossCombo = 0;
    this.bossPatternIndex = 0;
    this.bossAction = null;
    this.bossNextDelay = 0;
    this.bossFever = 0;
    this.bossFeverActive = false;
    this.bossFeverTimeLeft = 0;
    this.bossVisual = new BossVisualController(this);
    this.createRunnerPlayer();
    this.buildHud(true);
    this.feverImpact = new FeverImpactOverlay(this, 12);
    this.comboPopup = new ComboImpactPopup(this);
    this.feverText = this.addText(GAME_WIDTH / 2, 220, "TAP!!", 74, COLORS.cream, 0.5, 0.5, 24).setVisible(false);
    this.bossHint = this.addText(GAME_WIDTH / 2, 530, "TAP", 48, COLORS.white, 0.5, 0.5, 24);
    this.bossCueOne = this.track(this.add.image(590, 575, "circle3").setDisplaySize(108, 108).setDepth(23));
    this.bossCueTwo = this.track(this.add.image(690, 575, "circle3").setDisplaySize(108, 108).setDepth(23));
    this.bossWaitCue = this.track(this.add.image(640, 575, "waitCue").setDisplaySize(112, 112).setDepth(23));
    this.playMusic("bossMusic");
    this.showFeedback("BOSS", COLORS.cream);
    this.nextBossPattern();
  }

  private updateBoss(seconds: number) {
    this.hitFeedback.update(seconds);
    this.feedbackTimer = Math.max(0, this.feedbackTimer - seconds);
    if (this.feedbackTimer <= 0) this.feedbackText?.setAlpha(0);
    this.playerVisual?.update(seconds, 1);
    this.feverImpact?.update(seconds);
    const worldSeconds = seconds * this.hitFeedback.motionScale.world;
    this.bossVisual?.update(worldSeconds);
    if (this.bossFeverActive) {
      this.bossFeverTimeLeft -= seconds;
      this.feverText?.setScale(feverTapPulse(5 - this.bossFeverTimeLeft));
      if (this.bossFeverTimeLeft <= 0) {
        this.bossFeverActive = false;
        this.bossFever = 0;
        this.feverImpact?.stop();
        this.feverText?.setVisible(false);
        this.showFeedback("FEVER END", COLORS.white);
      }
    }
    if (this.bossNextDelay > 0) {
      this.bossNextDelay -= worldSeconds;
      if (this.bossNextDelay <= 0 && this.bossHp > 0 && this.health > 0) this.nextBossPattern();
      this.updateHud();
      return;
    }
    if (this.bossAction) {
      this.bossPatternTime -= worldSeconds;
      if (this.bossPatternTime <= 0) {
        if (this.bossAction === "no_input" || this.bossFeverActive) this.successBossPattern(true);
        else this.failBossPattern("MISS");
      }
    }
    this.updateHud();
  }

  private nextBossPattern() {
    if (this.bossHp <= 0) { this.finishResult(true); return; }
    const pool: RequiredAction[] = this.bossHp <= BOSS_MAX_HP / 2
      ? ["double_tap", "long_tap", "no_input", "double_tap", "long_tap", "tap"]
      : ["tap", "double_tap", "long_tap", "no_input", "tap", "double_tap"];
    this.bossAction = pool[this.bossPatternIndex % pool.length];
    this.bossPatternIndex += 1;
    this.bossPatternTime = this.bossAction === "tap" ? 1.85 : this.bossAction === "double_tap" ? 2 : this.bossAction === "long_tap" ? 2.2 : 1.8;
    this.bossVisual?.startPattern(this.bossAction, this.bossPatternTime);
    this.showBossCue(this.bossAction);
  }

  private showBossCue(action: RequiredAction) {
    const color = action === "no_input" ? COLORS.red : action === "double_tap" ? COLORS.gold : action === "long_tap" ? COLORS.blue : COLORS.white;
    this.bossHint?.setText(actionHint(action)).setColor("#" + color.toString(16).padStart(6, "0"));
    this.bossCueOne?.setVisible(action === "tap" || action === "double_tap" || action === "long_tap");
    this.bossCueTwo?.setVisible(action === "double_tap");
    this.bossWaitCue?.setVisible(action === "no_input");
  }

  private bossTimerRatio() {
    if (this.bossFeverActive) return clamp(this.bossFeverTimeLeft / 5, 0, 1);
    const total = this.bossAction === "tap" ? 1.85 : this.bossAction === "double_tap" ? 2 : this.bossAction === "long_tap" ? 2.2 : 1.8;
    return this.bossPatternTime <= 0 ? 0 : clamp(this.bossPatternTime / total, 0, 1);
  }

  private handleBossAction(action: SlashAction) {
    if (!this.bossAction || this.hitFeedback.isHurt) return;
    this.playPlayerSlash(action === "long_tap");
    if (this.bossFeverActive || actionMatches(this.bossAction, action)) this.successBossPattern(false);
    else if ((this.bossAction === "double_tap" || this.bossAction === "long_tap") && action === "tap") this.showFeedback(actionHint(this.bossAction), this.bossAction === "double_tap" ? COLORS.gold : COLORS.blue);
    else this.failBossPattern("WRONG");
  }

  private successBossPattern(fromTimeout: boolean) {
    if (!this.bossAction) return;
    this.bossHp -= 1;
    this.score += this.bossFeverActive ? 400 : 200;
    if (!this.bossFeverActive) {
      this.bossCombo += 1;
      this.comboPopup?.play(this.bossCombo);
      this.bossFever += 25;
      if (this.bossFever >= MAX_FEVER) {
        this.startBossFever();
      }
    }
    this.spawnBossScrap();
    this.bossVisual?.endPattern(true);
    this.showFeedback(fromTimeout ? "WAIT" : "HIT", COLORS.white);
    this.bossAction = null;
    this.bossNextDelay = this.bossHp > 0 ? 0.75 : 0;
    this.applyImpact(0.05, 4);
    if (this.bossHp <= 0) {
      this.feverImpact?.stop();
      this.feverText?.setVisible(false);
      this.bossVisual?.defeat();
      this.time.delayedCall(850, () => {
        if (this.mode === "boss" && this.bossHp <= 0) this.finishResult(true);
      });
    }
  }

  private failBossPattern(text: string) {
    if (!this.bossAction) return;
    this.bossAction = null;
    this.bossVisual?.endPattern(false);
    if (this.bossFeverActive) { this.bossNextDelay = 0.2; this.showFeedback("FEVER", COLORS.cyan); return; }
    if (this.invincibleMode) {
      this.bossNextDelay = 0.2;
      this.showFeedback("INVINCIBLE", COLORS.cyan);
      return;
    }
    this.health -= 1;
    this.bossCombo = 0;
    this.startPlayerHurt();
    this.applyImpact(0.04, 5);
    this.showFeedback(text, COLORS.red);
    if (this.health <= 0) this.finishResult(false);
    else this.bossNextDelay = 0.65;
  }

  private startBossFever() {
    if (this.bossFeverActive) return;
    this.bossFeverActive = true;
    this.bossFever = MAX_FEVER;
    this.bossFeverTimeLeft = 5;
    this.feverImpact?.start();
    this.feverText?.setVisible(true);
    this.showFeedback("BOSS FEVER!", COLORS.cyan);
    this.applyImpact(0.08, 7);
  }

  private spawnBossScrap() {
    const key = "scrap" + Phaser.Math.Between(1, 7);
    const scrap = this.track(this.add.image(840 + Phaser.Math.Between(-80, 80), 360 + Phaser.Math.Between(-60, 80), key).setDisplaySize(70, 70).setDepth(8));
    this.tweens.add({ targets: scrap, x: scrap.x - 130, y: scrap.y - 150, angle: Phaser.Math.Between(-120, 120), alpha: 0, duration: 850, onComplete: () => scrap.destroy() });
    this.bossScraps.push(scrap);
  }

  private togglePause() {
    if (this.mode !== "runner" && this.mode !== "boss") return;
    this.paused = !this.paused;
    this.pauseButton?.setText(this.paused ? "▶" : "Ⅱ");
    if (this.paused) {
      const veil = this.track(this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, COLORS.ink, 0.72).setDepth(40));
      const title = this.track(this.add.text(GAME_WIDTH / 2, 290, "PAUSED", { fontFamily: "Arial", fontSize: "58px", color: "#f7f4ed" }).setOrigin(0.5).setDepth(41));
      const resume = this.track(this.add.rectangle(535, 390, 180, 58, COLORS.gold, 1).setDepth(41).setInteractive({ useHandCursor: true }));
      const resumeText = this.addText(535, 390, "RESUME", 18, COLORS.ink, 0.5, 0.5, 42);
      const quit = this.track(this.add.rectangle(745, 390, 180, 58, 0x29303f, 1).setDepth(41).setInteractive({ useHandCursor: true }));
      const quitText = this.addText(745, 390, "QUIT", 18, COLORS.white, 0.5, 0.5, 42);
      this.stateObjects.push(veil, title, resume, resumeText, quit, quitText);
      resume.on("pointerdown", () => this.togglePause());
      quit.on("pointerdown", () => this.showMenu());
    } else {
      for (const object of this.stateObjects) object.destroy();
      this.stateObjects = [];
    }
  }

  private finishResult(won: boolean) {
    if (this.mode === "result") return;
    this.mode = "result";
    this.paused = false;
    this.bestScore = Math.max(this.bestScore, this.score);
    localStorage.setItem("slashrush-best-score", String(this.bestScore));
    localStorage.setItem("slashrush-coins", String(this.coins));
    this.clearScene();
    this.mode = "result";
    this.addBackdrop(won ? "bossBackground" : "introBg", won ? 0.35 : 0.45);
    if (!won) this.track(this.add.image(255, 500, "playerDead").setDisplaySize(300, 160).setDepth(4));
    this.track(this.add.rectangle(GAME_WIDTH / 2, 375, 560, 320, COLORS.panel, 0.96).setStrokeStyle(2, won ? COLORS.gold : COLORS.red, 1).setDepth(5));
    this.addText(GAME_WIDTH / 2, 284, won ? "FINISH" : "GAME OVER", 46, won ? COLORS.cream : COLORS.white, 0.5, 0.5, 10);
    this.addText(GAME_WIDTH / 2, 350, "SCORE " + String(this.score).padStart(6, "0"), 24, COLORS.white, 0.5, 0.5, 10);
    this.addText(GAME_WIDTH / 2, 390, "COINS " + this.coins + "    BEST " + this.bestScore, 18, COLORS.gold, 0.5, 0.5, 10);
    this.makeButton("RETRY", 540, 465, 170, 56, () => this.startRunner());
    this.makeButton("MENU", 740, 465, 170, 56, () => this.showMenu());
    this.addText(GAME_WIDTH / 2, 555, "SPACE / TAP TO RETRY", 14, COLORS.muted, 0.5, 0.5, 10);
  }

  private createInput() {
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      const swordDebugOpen = this.swordDebugPanel?.visible ?? false;
      const inSwordDebugArea = pointer.x > 990 && pointer.y >= 65 && pointer.y <= (swordDebugOpen ? 580 : 120);
      if ((this.mode === "runner" || this.mode === "boss") && ((pointer.x > 1140 && pointer.y < 100) || inSwordDebugArea)) return;
      if (this.mode === "intro") { this.showMenu(); return; }
      if (this.mode !== "runner" && this.mode !== "boss") return;
      this.pressStartedAt = performance.now();
    });
    this.input.on("pointerup", () => {
      if (this.pressStartedAt < 0) return;
      this.dispatchPress(performance.now() - this.pressStartedAt);
      this.pressStartedAt = -1;
    });
    this.input.keyboard?.on("keydown-SPACE", () => {
      if (this.mode === "intro") this.showMenu();
      else if (this.mode === "menu" || this.mode === "result") this.startRunner();
      else if (this.mode === "runner" || this.mode === "boss") if (!this.keyboardPressed) {
        this.keyboardPressed = true;
        this.pressStartedAt = performance.now();
      }
    });
    this.input.keyboard?.on("keyup-SPACE", () => {
      if (!this.keyboardPressed) return;
      this.keyboardPressed = false;
      this.dispatchPress(performance.now() - this.pressStartedAt);
      this.pressStartedAt = -1;
    });
    this.input.keyboard?.on("keydown-ENTER", () => {
      if (this.mode === "intro") this.showMenu();
      else if (this.mode === "menu" || this.mode === "result") this.startRunner();
    });
    this.input.keyboard?.on("keydown-ESC", () => {
      if (this.mode === "runner" || this.mode === "boss") this.togglePause();
      else if (this.mode !== "intro" && this.mode !== "menu") this.showMenu();
    });
    this.input.keyboard?.on("keydown-B", () => { if (this.mode === "runner") this.startBoss(); });
    this.input.keyboard?.on("keydown-R", () => { if (this.mode === "runner" || this.mode === "boss" || this.mode === "result") this.startRunner(); });
    this.input.keyboard?.on("keydown-C", () => { if (location.hostname === "127.0.0.1" || location.hostname === "localhost") this.triggerDebugCombo(); });
    this.input.keyboard?.on("keydown-F", () => { if (location.hostname === "127.0.0.1" || location.hostname === "localhost") this.triggerDebugFever(); });
    this.input.keyboard?.on("keydown-H", () => { if (location.hostname === "127.0.0.1" || location.hostname === "localhost") this.triggerDebugHurt(); });
    this.input.keyboard?.on("keydown-I", () => {
      if (location.hostname !== "127.0.0.1" && location.hostname !== "localhost") return;
      if (this.mode !== "runner" && this.mode !== "boss") return;
      this.invincibleMode = !this.invincibleMode;
      this.updateSettingsLabels();
      this.updateHud();
    });
  }

  private dispatchPress(durationMs: number) {
    const duration = durationMs / 1000;
    if (duration >= 0.45) {
      if (this.mode === "runner") this.handleRunnerAction("long_tap");
      if (this.mode === "boss") this.handleBossAction("long_tap");
      this.lastTapAt = -10;
      return;
    }
    const now = performance.now() / 1000;
    const doubleTap = now - this.lastTapAt <= 0.25;
    this.lastTapAt = doubleTap ? -10 : now;
    if (doubleTap) {
      if (this.mode === "runner") this.handleRunnerAction("double_tap");
      if (this.mode === "boss") this.handleBossAction("double_tap");
    } else {
      if (this.mode === "runner") this.handleRunnerAction("tap");
      if (this.mode === "boss") this.handleBossAction("tap");
    }
  }
}
