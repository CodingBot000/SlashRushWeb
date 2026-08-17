import { describe, expect, it } from "vitest";
import { bossMotionPhase, comboDigits, comboLayoutWidth, feverTapPulse } from "./effectRules";

describe("effect parity rules", () => {
  it("maps combo values to reusable digit textures", () => {
    expect(comboDigits(-1)).toEqual([0]);
    expect(comboDigits(7)).toEqual([7]);
    expect(comboDigits(42)).toEqual([4, 2]);
    expect(comboLayoutWidth(1)).toBe(740);
    expect(comboLayoutWidth(3)).toBe(1100);
  });

  it("uses the original fever tap pulse extrema", () => {
    expect(feverTapPulse(0)).toBeCloseTo(1);
    expect(feverTapPulse(0.08)).toBeCloseTo(1.26);
    expect(feverTapPulse(0.159)).toBeCloseTo(0.96, 1);
  });

  it("splits boss attacks into windup, strike, and recovery", () => {
    expect(bossMotionPhase(0.2).phase).toBe("windup");
    expect(bossMotionPhase(0.6).phase).toBe("strike");
    expect(bossMotionPhase(0.9).phase).toBe("recover");
  });
});
