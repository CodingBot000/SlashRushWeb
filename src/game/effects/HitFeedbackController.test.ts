import { describe, expect, it } from "vitest";
import { HitFeedbackController } from "./HitFeedbackController";

describe("HitFeedbackController", () => {
  it("stops the world for hitstop and then restores it", () => {
    const feedback = new HitFeedbackController();
    feedback.startHitstop(0.05);
    expect(feedback.motionScale).toEqual({ background: 0, objects: 0, world: 0 });
    feedback.update(0.05);
    expect(feedback.motionScale).toEqual({ background: 1, objects: 1, world: 1 });
  });

  it("slows the background and freezes objects during hurt", () => {
    const feedback = new HitFeedbackController();
    feedback.startHurt();
    expect(feedback.motionScale).toEqual({ background: 0.1, objects: 0, world: 1 });
    feedback.update(0.4);
    expect(feedback.isHurt).toBe(false);
  });
});
