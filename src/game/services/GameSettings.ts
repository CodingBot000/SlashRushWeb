export const SETTINGS_STORAGE_KEY = "slashrush-settings-v1";

export interface GameSettingsState {
  masterVolume: number;
  attackVibration: boolean;
  hurtVibration: boolean;
}

export type HapticKind = "attack" | "hurt";
export type VibrateFunction = (pattern: number | number[]) => boolean;

export const DEFAULT_GAME_SETTINGS: GameSettingsState = {
  masterVolume: 1,
  attackVibration: true,
  hurtVibration: true,
};

type SettingsStorage = Pick<Storage, "getItem" | "setItem">;

function clampVolume(value: number) {
  return Math.min(Math.max(Number.isFinite(value) ? value : 1, 0), 1);
}

export function loadGameSettings(storage?: SettingsStorage): GameSettingsState {
  if (!storage) return { ...DEFAULT_GAME_SETTINGS };
  try {
    const raw = storage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_GAME_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<GameSettingsState>;
    return {
      masterVolume: clampVolume(Number(parsed.masterVolume)),
      attackVibration: typeof parsed.attackVibration === "boolean" ? parsed.attackVibration : true,
      hurtVibration: typeof parsed.hurtVibration === "boolean" ? parsed.hurtVibration : true,
    };
  } catch {
    return { ...DEFAULT_GAME_SETTINGS };
  }
}

export function saveGameSettings(settings: GameSettingsState, storage?: SettingsStorage) {
  if (!storage) return;
  try {
    storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({
      ...settings,
      masterVolume: clampVolume(settings.masterVolume),
    }));
  } catch {
    // Storage can be unavailable in private or restricted browser contexts.
  }
}

export function changeMasterVolume(settings: GameSettingsState, delta: number): GameSettingsState {
  return {
    ...settings,
    masterVolume: Math.round(clampVolume(settings.masterVolume + delta) * 10) / 10,
  };
}

export function hapticDuration(kind: HapticKind) {
  return kind === "attack" ? 35 : 140;
}

export function triggerHaptic(
  kind: HapticKind,
  settings: GameSettingsState,
  vibrate?: VibrateFunction,
) {
  const enabled = kind === "attack" ? settings.attackVibration : settings.hurtVibration;
  if (!enabled) return false;
  const vibration = vibrate ?? (typeof navigator !== "undefined" && typeof navigator.vibrate === "function"
    ? navigator.vibrate.bind(navigator)
    : undefined);
  if (!vibration) return false;
  try {
    return vibration(hapticDuration(kind));
  } catch {
    return false;
  }
}
