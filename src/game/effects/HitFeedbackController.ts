export const PLAYER_HURT_SECONDS = 0.4;

export interface WorldMotionScale {
  background: number;
  objects: number;
  world: number;
}

export class HitFeedbackController {
  private hitstopRemaining = 0;
  private hurtRemaining = 0;

  update(deltaSeconds: number) {
    const delta = Math.max(0, deltaSeconds);
    this.hitstopRemaining = Math.max(0, this.hitstopRemaining - delta);
    this.hurtRemaining = Math.max(0, this.hurtRemaining - delta);
  }

  startHitstop(seconds: number) {
    this.hitstopRemaining = Math.max(this.hitstopRemaining, Math.max(0, seconds));
  }

  startHurt(seconds = PLAYER_HURT_SECONDS) {
    this.hurtRemaining = Math.max(this.hurtRemaining, Math.max(0, seconds));
  }

  reset() {
    this.hitstopRemaining = 0;
    this.hurtRemaining = 0;
  }

  get isHitstopped() {
    return this.hitstopRemaining > 0;
  }

  get isHurt() {
    return this.hurtRemaining > 0;
  }

  get hurtTimeLeft() {
    return this.hurtRemaining;
  }

  get motionScale(): WorldMotionScale {
    if (this.isHitstopped) return { background: 0, objects: 0, world: 0 };
    if (this.isHurt) return { background: 0.1, objects: 0, world: 1 };
    return { background: 1, objects: 1, world: 1 };
  }
}
