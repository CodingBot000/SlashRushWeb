import Phaser from "phaser";

const ASSET = "/assets/godot-source/assets";
const GENERATED_ASSET = "/assets/generated";

export const assetPath = (relativePath: string) => `${ASSET}/${relativePath}`;
const generatedAssetPath = (relativePath: string) => `${GENERATED_ASSET}/${relativePath}`;

export class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  preload() {
    this.load.image("introBg", assetPath("background/intro/intro_background.png"));
    this.load.image("logo", assetPath("ui/logo.png"));
    this.load.image("menuButton", assetPath("ui/button_rectangle_depth_flat.png"));
    this.load.image("settingsIcon", assetPath("ui/icon_setting.png"));
    this.load.image("combo", assetPath("ui/combo.png"));
    for (let digit = 0; digit <= 9; digit += 1) {
      this.load.image(`num${digit}`, assetPath(`ui/num${digit}.png`));
    }
    this.load.image("waitCue", assetPath("ui/window_01.png"));
    for (let index = 1; index <= 5; index += 1) {
      this.load.image(`circle${index}`, assetPath(`ui/circle_0${index}.png`));
    }

    this.load.image("sky", assetPath("background/stage1/sky_static.png"));
    this.load.image("clouds", assetPath("background/stage1/cloud_01.png"));
    this.load.image("farMountains", assetPath("background/stage1/far_mountains_01.png"));
    this.load.image("midStructures", assetPath("background/stage1/mid_structures_01.png"));
    this.load.image("nearForeground", assetPath("background/stage1/near_foreground_01.png"));
    this.load.image("ground", assetPath("background/stage1/ground_tile_01.png"));
    this.load.image("bossBackground", assetPath("background/stage1/boss_background.png"));

    this.load.image("playerPreview", assetPath("characters/player1.png"));
    for (let index = 1; index <= 5; index += 1) {
      this.load.image(`character${index}`, assetPath(`characters/player${index}.png`));
    }
    this.load.image("playerRun1", assetPath("sprites/samurai/run/frame_01.png"));
    this.load.image("playerRun2", assetPath("sprites/samurai/run/frame_02.png"));
    this.load.image("playerRun3", assetPath("sprites/samurai/run/frame_03.png"));
    this.load.image("playerRun4", assetPath("sprites/samurai/run/frame_04.png"));
    this.load.image("playerIdle", assetPath("sprites/samurai/idle/player_stand.png"));
    this.load.image("playerDamage", assetPath("sprites/samurai/damage/player_damage.png"));
    this.load.image("playerDead", assetPath("sprites/samurai/dead/dead.png"));
    this.load.image("swordSheath", assetPath("sprites/samurai/run/sword_sheath.png"));
    this.load.image("swordSlash", assetPath("sprites/samurai/run/sword_slash.png"));
    this.load.image("slashEffect", assetPath("sprites/effect/slash_sword/slash_effect.png"));

    this.load.image("enemyBasic", generatedAssetPath("enemies/scarecrow_pixel.png"));
    this.load.image("enemyBasicSlice", generatedAssetPath("enemies/scarecrow_pixel.png"));
    this.load.image("enemyFast", generatedAssetPath("enemies/fire_ghost_pixel.png"));
    this.load.image("enemyFastSlice", generatedAssetPath("enemies/fire_ghost_pixel.png"));
    this.load.image("enemyArmor", generatedAssetPath("enemies/iron_kettle_armor_pixel.png"));
    this.load.image("enemyArmorSlice", generatedAssetPath("enemies/iron_kettle_armor_pixel.png"));
    this.load.image("bomb", generatedAssetPath("enemies/rotten_apple_bomb_pixel.png"));
    this.load.image("coin", assetPath("objects/coin.png"));
    this.load.image("heal", assetPath("objects/apple.png"));
    this.load.image("feverOrb", assetPath("items/fever_orb.png"));

    this.load.spritesheet("bossPixelSpiritBody", generatedAssetPath("boss-pixel-v1/sprites/spirit_body_sheet.png"), {
      frameWidth: 508,
      frameHeight: 719,
    });
    this.load.spritesheet("bossPixelSpiritAura", generatedAssetPath("boss-pixel-v1/sprites/spirit_aura_sheet.png"), {
      frameWidth: 497,
      frameHeight: 648,
    });
    this.load.image("bossPixelArmorWaist", generatedAssetPath("boss-pixel-v1/layers/armor_waist.png"));
    this.load.image("bossPixelArmorHead", generatedAssetPath("boss-pixel-v1/layers/armor_head.png"));
    this.load.image("bossPixelArmorRight", generatedAssetPath("boss-pixel-v1/layers/armor_right_arm_shoulder.png"));
    this.load.image("bossPixelArmorLeftSword", generatedAssetPath("boss-pixel-v1/layers/armor_left_arm_shoulder_sword.png"));
    for (let index = 1; index <= 7; index += 1) {
      this.load.image(`scrap${index}`, assetPath(`boss/robot_samurai/scrap${index}.png`));
    }

    this.load.audio("lobbyMusic", assetPath("audio/music/lobby.wav"));
    this.load.audio("runningMusic", assetPath("audio/music/runningplay.mp3"));
    this.load.audio("bossMusic", assetPath("audio/music/boss.mp3"));
    this.load.audio("uiClick", assetPath("audio/sfx/ui-button-click.ogg"));
    this.load.audio("startGame", assetPath("audio/sfx/start_game.ogg"));
    this.load.audio("slashSfx", assetPath("audio/sfx/sword-slash.mp3"));
    this.load.audio("pickupSfx", assetPath("audio/sfx/pickup_item.ogg"));
    this.load.audio("errorSfx", assetPath("audio/sfx/error_002.ogg"));
  }

  create() {
    const pixelBossTextures = [
      "bossPixelSpiritBody",
      "bossPixelSpiritAura",
      "bossPixelArmorWaist",
      "bossPixelArmorHead",
      "bossPixelArmorRight",
      "bossPixelArmorLeftSword",
    ];
    for (const key of pixelBossTextures) {
      this.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
    }

    if (!this.anims.exists("bossPixelSpiritBodyIdle")) {
      this.anims.create({
        key: "bossPixelSpiritBodyIdle",
        frames: [0, 1, 2, 1].map((frame) => ({ key: "bossPixelSpiritBody", frame })),
        frameRate: 1000 / 220,
        repeat: -1,
      });
    }
    if (!this.anims.exists("bossPixelSpiritAuraIdle")) {
      this.anims.create({
        key: "bossPixelSpiritAuraIdle",
        frames: [0, 1, 2, 3].map((frame) => ({ key: "bossPixelSpiritAura", frame })),
        frameRate: 1000 / 120,
        repeat: -1,
      });
    }

    this.scene.start("GameScene");
  }
}
