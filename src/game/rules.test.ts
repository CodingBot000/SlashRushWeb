import { describe, expect, it } from "vitest";
import { clamp, comboMultiplier, nextSpawnDelay, OBJECT_RULES, scoreForDefeat } from "./rules";

describe("SlashRush scoring rules", () => {
  it("ramps combo multipliers without exceeding four times", () => {
    expect(comboMultiplier(0)).toBe(1);
    expect(comboMultiplier(5)).toBe(2);
    expect(comboMultiplier(10)).toBe(4);
    expect(comboMultiplier(30)).toBe(4);
  });

  it("uses the active combo to award defeat points", () => {
    expect(scoreForDefeat(1)).toBe(100);
    expect(scoreForDefeat(6)).toBe(200);
    expect(scoreForDefeat(10)).toBe(400);
  });

  it("accelerates spawns with a safe lower bound", () => {
    expect(nextSpawnDelay(0)).toBe(1150);
    expect(nextSpawnDelay(60)).toBe(670);
    expect(nextSpawnDelay(120)).toBe(670);
  });

  it("clamps values into the requested range", () => {
    expect(clamp(-4, 0, 10)).toBe(0);
    expect(clamp(4, 0, 10)).toBe(4);
    expect(clamp(14, 0, 10)).toBe(10);
  });

  it("keeps the requested runner enemy scale tuning", () => {
    expect(OBJECT_RULES.enemy_basic.height).toBe(248);
    expect(OBJECT_RULES.enemy_fast.height).toBe(148);
    expect(OBJECT_RULES.enemy_armor.height).toBe(322);
  });
});
