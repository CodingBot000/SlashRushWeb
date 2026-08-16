export const MAX_COMBO = 12;

export function comboMultiplier(combo: number): number {
  if (combo >= 10) return 4;
  if (combo >= 5) return 2;
  return 1;
}

export function nextSpawnDelay(elapsedSeconds: number): number {
  return Math.max(420, 1150 - Math.min(elapsedSeconds, 60) * 8);
}

export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

export function scoreForDefeat(combo: number): number {
  return 100 * comboMultiplier(combo);
}
