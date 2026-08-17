import { describe, expect, it, vi } from "vitest";
import {
  changeMasterVolume,
  DEFAULT_GAME_SETTINGS,
  loadGameSettings,
  saveGameSettings,
  SETTINGS_STORAGE_KEY,
  triggerHaptic,
} from "./GameSettings";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
  };
}

describe("GameSettings", () => {
  it("persists volume and haptic toggles", () => {
    const storage = memoryStorage();
    const settings = { masterVolume: 0.4, attackVibration: false, hurtVibration: true };
    saveGameSettings(settings, storage);
    expect(storage.getItem(SETTINGS_STORAGE_KEY)).not.toBeNull();
    expect(loadGameSettings(storage)).toEqual(settings);
  });

  it("clamps volume changes to the supported range", () => {
    expect(changeMasterVolume(DEFAULT_GAME_SETTINGS, 0.5).masterVolume).toBe(1);
    expect(changeMasterVolume({ ...DEFAULT_GAME_SETTINGS, masterVolume: 0.1 }, -0.5).masterVolume).toBe(0);
  });

  it("uses the requested haptic duration and respects toggles", () => {
    const vibrate = vi.fn(() => true);
    expect(triggerHaptic("attack", DEFAULT_GAME_SETTINGS, vibrate)).toBe(true);
    expect(vibrate).toHaveBeenCalledWith(35);
    expect(triggerHaptic("hurt", { ...DEFAULT_GAME_SETTINGS, hurtVibration: false }, vibrate)).toBe(false);
  });
});
