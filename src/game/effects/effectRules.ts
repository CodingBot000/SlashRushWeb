export const COMBO_DIGIT_START_X = 490;
export const COMBO_DIGIT_SIZE = 250;
export const COMBO_DIGIT_ADVANCE = 180;

export type BossMotionPhase = "windup" | "strike" | "recover";

export function comboDigits(combo: number) {
  return String(Math.max(0, Math.floor(combo))).split("").map(Number);
}

export function comboLayoutWidth(digitCount: number) {
  return COMBO_DIGIT_START_X + COMBO_DIGIT_SIZE + Math.max(0, digitCount - 1) * COMBO_DIGIT_ADVANCE;
}

export function feverTapPulse(elapsedSeconds: number) {
  const phase = (Math.max(0, elapsedSeconds) % 0.16) / 0.16;
  if (phase < 0.5) return 1 + 0.26 * phase * 2;
  return 1.26 + (0.96 - 1.26) * (phase - 0.5) * 2;
}

export function bossMotionPhase(progress: number): { phase: BossMotionPhase; progress: number } {
  const value = Math.min(Math.max(progress, 0), 1);
  if (value < 0.56) return { phase: "windup", progress: value / 0.56 };
  if (value < 0.72) return { phase: "strike", progress: (value - 0.56) / 0.16 };
  return { phase: "recover", progress: (value - 0.72) / 0.28 };
}
