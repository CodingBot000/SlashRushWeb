export type SlashAction = "tap" | "double_tap" | "long_tap";
export type RequiredAction = SlashAction | "no_input";

export const RUNNER_DURATION = 60;
export const STARTING_HP = 3;
export const MAX_HP = 3;
export const MAX_FEVER = 100;
export const FEVER_DURATION = 5.5;
export const BOSS_MAX_HP = 10;

export function actionMatches(required: RequiredAction, actual: SlashAction, feverActive = false): boolean {
  if (feverActive) return true;
  if (required === actual) return true;
  return required === "tap" && actual === "double_tap";
}

export function actionHint(action: RequiredAction): string {
  if (action === "double_tap") return "TAP TAP";
  if (action === "long_tap") return "HOLD";
  if (action === "no_input") return "WAIT";
  return "TAP";
}

export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

export function scoreMultiplier(combo: number): number {
  if (combo >= 10) return 2;
  return 1;
}

// Kept as a compatibility helper for the original prototype's unit tests.
export function comboMultiplier(combo: number): number {
  if (combo >= 10) return 4;
  if (combo >= 5) return 2;
  return 1;
}

export function scoreForDefeat(combo: number): number {
  return 100 * comboMultiplier(combo);
}

export function nextSpawnDelay(elapsedSeconds: number): number {
  return Math.max(420, 1150 - Math.min(elapsedSeconds, 60) * 8);
}

export interface SpawnEvent {
  time: number;
  type: RunnerObjectType;
}

export type RunnerObjectType = "enemy_basic" | "enemy_fast" | "enemy_armor" | "bomb" | "coin" | "heal" | "fever_orb";

export interface ObjectRule {
  required: RequiredAction;
  good: boolean;
  score: number;
  fever: number;
  key: string;
  sliceKey: string;
  height: number;
  yOffset: number;
  tint: number;
}

export const OBJECT_RULES: Record<RunnerObjectType, ObjectRule> = {
  enemy_basic: { required: "tap", good: false, score: 100, fever: 6, key: "enemyBasic", sliceKey: "enemyBasicSlice", height: 248, yOffset: 0, tint: 0xd39a42 },
  enemy_fast: { required: "double_tap", good: false, score: 150, fever: 10, key: "enemyFast", sliceKey: "enemyFastSlice", height: 148, yOffset: 0, tint: 0xb87932 },
  enemy_armor: { required: "long_tap", good: false, score: 150, fever: 10, key: "enemyArmor", sliceKey: "enemyArmorSlice", height: 322, yOffset: 0, tint: 0x7c8da5 },
  bomb: { required: "tap", good: false, score: 80, fever: 4, key: "bomb", sliceKey: "bomb", height: 82, yOffset: -69, tint: 0x181820 },
  coin: { required: "no_input", good: true, score: 20, fever: 0, key: "coin", sliceKey: "coin", height: 82, yOffset: -69, tint: 0xffd84a },
  heal: { required: "no_input", good: true, score: 0, fever: 0, key: "heal", sliceKey: "heal", height: 82, yOffset: -69, tint: 0x38d878 },
  fever_orb: { required: "no_input", good: true, score: 50, fever: 25, key: "feverOrb", sliceKey: "feverOrb", height: 82, yOffset: -69, tint: 0x57b7ff },
};

export function buildRunnerSchedule(): SpawnEvent[] {
  return [
    [1.2, "enemy_basic"], [3.5, "coin"], [4.8, "enemy_basic"], [6.2, "bomb"], [7.8, "enemy_basic"],
    [9.4, "coin"], [10.8, "enemy_fast"], [13.0, "coin"], [14.2, "enemy_basic"], [15.8, "enemy_fast"],
    [18.2, "fever_orb"], [20.8, "enemy_basic"], [22.4, "coin"], [24.2, "heal"], [26.4, "enemy_fast"],
    [28.4, "bomb"], [30.6, "enemy_armor"], [32.8, "coin"], [34.6, "enemy_basic"], [36.2, "enemy_fast"],
    [39.0, "fever_orb"], [41.2, "heal"], [43.8, "enemy_armor"], [46.0, "coin"], [47.8, "bomb"],
    [49.4, "enemy_fast"], [51.3, "enemy_armor"], [53.1, "coin"], [54.8, "enemy_basic"], [56.2, "enemy_fast"],
    [57.9, "heal"], [59.0, "bomb"],
  ].map(([time, type]) => ({ time: Number(time), type: type as RunnerObjectType }));
}
