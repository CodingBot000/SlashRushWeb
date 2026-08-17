import Phaser from "phaser";

const PLAYER_X = 210;
const PLAYER_FLOOR_Y = 610;
const PLAYER_WIDTH = 231;
const PLAYER_HEIGHT = 230;
const RUN_FPS = 12;
const SLASH_ACTIVE_SECONDS = 0.12;
const DAMAGE_SECONDS = 0.4;
const DAMAGE_PHASES = 8;

export class PlayerVisualController {
  private readonly scene: Phaser.Scene;
  private readonly root: Phaser.GameObjects.Container;
  private readonly shadow: Phaser.GameObjects.Ellipse;
  private readonly player: Phaser.GameObjects.Sprite;
  private readonly swordSheath: Phaser.GameObjects.Image;
  private readonly swordSlash: Phaser.GameObjects.Image;
  private frame = 0;
  private frameTimer = 0;
  private slashRemaining = 0;
  private hurtRemaining = 0;
  private dead = false;
  private debugAlwaysVisible = true;
  private swordX: number;
  private swordY: number;
  private swordWidth: number;
  private swordHeight: number;

  constructor(
    scene: Phaser.Scene,
    sword: { x: number; y: number; width: number; height: number; debugAlwaysVisible: boolean },
  ) {
    this.scene = scene;
    this.swordX = sword.x;
    this.swordY = sword.y;
    this.swordWidth = sword.width;
    this.swordHeight = sword.height;
    this.debugAlwaysVisible = sword.debugAlwaysVisible;

    this.root = scene.add.container(0, 0).setDepth(4).setName("PlayerVisual");
    this.shadow = scene.add.ellipse(PLAYER_X + 10, PLAYER_FLOOR_Y - 3, 92, 18, 0x000000, 0.34).setName("PlayerFootShadow");
    this.swordSlash = scene.add.image(this.swordX, this.swordY, "swordSlash")
      .setDisplaySize(this.swordWidth, this.swordHeight)
      .setRotation(Phaser.Math.DegToRad(20))
      .setName("PlayerSwordSlash");
    this.player = scene.add.sprite(PLAYER_X, PLAYER_FLOOR_Y, "playerRun1").setOrigin(0.5, 1).setName("PlayerSprite");
    this.swordSheath = scene.add.image(PLAYER_X, PLAYER_FLOOR_Y, "swordSheath").setOrigin(0.5, 1).setName("PlayerSwordSheath");
    this.root.add([this.shadow, this.swordSlash, this.player, this.swordSheath]);
    this.fitPlayerTexture("playerRun1");
    this.fitSheath();
    this.updateWeaponLayers();
  }

  update(deltaSeconds: number, runSpeedMultiplier: number) {
    const delta = Math.max(0, deltaSeconds);
    this.slashRemaining = Math.max(0, this.slashRemaining - delta);
    this.hurtRemaining = Math.max(0, this.hurtRemaining - delta);

    if (this.dead) {
      this.updateWeaponLayers();
      return;
    }

    if (this.hurtRemaining > 0) {
      this.updateDamageFlash();
    } else {
      this.player.clearTint().setAlpha(1);
      const speed = Math.max(0.01, runSpeedMultiplier);
      this.frameTimer += delta;
      const frameSeconds = 1 / (RUN_FPS * speed);
      while (this.frameTimer >= frameSeconds) {
        this.frameTimer -= frameSeconds;
        this.frame = (this.frame + 1) % 4;
      }
      this.fitPlayerTexture(`playerRun${this.frame + 1}`);
    }

    const bob = Math.sin(this.scene.time.now / 90) * 2.5;
    this.player.y = PLAYER_FLOOR_Y + bob;
    this.swordSheath.y = PLAYER_FLOOR_Y + bob;
    this.updateWeaponLayers();
  }

  playSlash(strong = false) {
    if (this.hurtRemaining > 0 || this.dead) return false;
    this.slashRemaining = SLASH_ACTIVE_SECONDS;
    const scale = strong && !this.debugAlwaysVisible ? 1.08 : 1;
    this.swordSlash.setDisplaySize(this.swordWidth * scale, this.swordHeight * scale);
    this.updateWeaponLayers();
    return true;
  }

  startHurt() {
    if (this.dead) return;
    this.hurtRemaining = DAMAGE_SECONDS;
    this.slashRemaining = 0;
    this.fitPlayerTexture("playerDamage");
    this.player.setTint(0xff4040).setAlpha(1);
    this.updateWeaponLayers();
  }

  setDead() {
    this.dead = true;
    this.slashRemaining = 0;
    this.hurtRemaining = 0;
    this.fitPlayerTexture("playerDead");
    this.player.clearTint().setAlpha(1);
    this.updateWeaponLayers();
  }

  setSwordTransform(x: number, y: number, width: number, height: number) {
    this.swordX = x;
    this.swordY = y;
    this.swordWidth = width;
    this.swordHeight = height;
    this.swordSlash.setPosition(x, y).setDisplaySize(width, height);
    this.updateWeaponLayers();
  }

  setDebugAlwaysVisible(enabled: boolean) {
    this.debugAlwaysVisible = enabled;
    this.updateWeaponLayers();
  }

  destroy() {
    this.root.destroy(true);
  }

  get sprite() {
    return this.player;
  }

  get slashSprite() {
    return this.swordSlash;
  }

  get sheathSprite() {
    return this.swordSheath;
  }

  get isHurt() {
    return this.hurtRemaining > 0;
  }

  private fitPlayerTexture(key: string) {
    if (this.player.texture.key !== key) this.player.setTexture(key);
    const source = this.scene.textures.get(key).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
    const scale = Math.min(PLAYER_WIDTH / source.width, PLAYER_HEIGHT / source.height);
    this.player.setDisplaySize(source.width * scale, source.height * scale);
  }

  private fitSheath() {
    const source = this.scene.textures.get("swordSheath").getSourceImage() as HTMLImageElement | HTMLCanvasElement;
    const scale = Math.min(PLAYER_WIDTH / source.width, PLAYER_HEIGHT / source.height);
    this.swordSheath.setDisplaySize(source.width * scale, source.height * scale);
  }

  private updateDamageFlash() {
    this.fitPlayerTexture("playerDamage");
    const elapsed = DAMAGE_SECONDS - this.hurtRemaining;
    const phase = Math.min(DAMAGE_PHASES - 1, Math.floor(elapsed / (DAMAGE_SECONDS / DAMAGE_PHASES)));
    if (phase % 2 === 0) this.player.setTint(0xffffff).setAlpha(0.45);
    else this.player.setTint(0xff4040).setAlpha(1);
  }

  private updateWeaponLayers() {
    const canShowWeapon = !this.dead && this.hurtRemaining <= 0;
    if (!canShowWeapon) {
      this.swordSlash.setVisible(false);
      this.swordSheath.setVisible(false);
      return;
    }
    if (this.debugAlwaysVisible) {
      this.swordSlash.setPosition(this.swordX, this.swordY).setDisplaySize(this.swordWidth, this.swordHeight).setVisible(true);
      this.swordSheath.setVisible(false);
      return;
    }
    const slashing = this.slashRemaining > 0;
    this.swordSlash.setVisible(slashing);
    this.swordSheath.setVisible(!slashing);
    if (!slashing) this.swordSlash.setDisplaySize(this.swordWidth, this.swordHeight);
  }
}
