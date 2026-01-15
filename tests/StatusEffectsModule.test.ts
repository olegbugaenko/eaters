import assert from "assert";
import { describe, test } from "./testRunner";
import { StatusEffectsModule } from "../src/logic/modules/active-map/status-effects/status-effects.module";
import { STATUS_EFFECT_OVERLAY_IDS } from "../src/db/status-effects-db";
import { createDamageServiceStub } from "./testHelpers";

type OverlayEntry = {
  effectId: string;
  target: "fill" | "stroke";
  overlay: unknown | null;
};

const createOverlayStore = () => {
  const overlayState = new Map<string, OverlayEntry>();
  return {
    overlayState,
    applyOverlay: (
      unitId: string,
      effectId: string,
      target: "fill" | "stroke",
      overlay: unknown | null
    ) => {
      const key = `${unitId}:${effectId}:${target}`;
      if (!overlay) {
        overlayState.delete(key);
        return;
      }
      overlayState.set(key, { effectId, target, overlay });
    },
  };
};

describe("StatusEffectsModule visuals cleanup", () => {
  test("clears missing overlays when one of multiple effects is removed", () => {
    const module = new StatusEffectsModule({ damage: createDamageServiceStub() });
    const overlays = createOverlayStore();
    module.registerUnitAdapter({
      hasUnit: () => true,
      applyOverlay: overlays.applyOverlay,
      applyAura: () => {},
      removeAura: () => {},
      damageUnit: () => {},
    });

    module.applyEffect(
      "freeze",
      { type: "unit", id: "u1" },
      { speedMultiplier: 0.5 }
    );
    module.applyEffect(
      "burn",
      { type: "unit", id: "u1" },
      { damagePerSecond: 10 }
    );

    assert.ok(
      overlays.overlayState.has("u1:freeze:fill") &&
        overlays.overlayState.has("u1:freeze:stroke"),
      "freeze overlays should be applied"
    );
    assert.ok(
      overlays.overlayState.has("u1:burn:fill"),
      "burn overlay should be applied"
    );

    module.removeEffect("freeze", { type: "unit", id: "u1" });

    assert.ok(
      !overlays.overlayState.has("u1:freeze:fill") &&
        !overlays.overlayState.has("u1:freeze:stroke"),
      "freeze overlays should be cleared"
    );
    assert.ok(
      overlays.overlayState.has("u1:burn:fill"),
      "burn overlay should remain"
    );
  });

  test("clears overlays when the last effect expires", () => {
    const module = new StatusEffectsModule({ damage: createDamageServiceStub() });
    const overlays = createOverlayStore();
    module.registerUnitAdapter({
      hasUnit: () => true,
      applyOverlay: overlays.applyOverlay,
      applyAura: () => {},
      removeAura: () => {},
      damageUnit: () => {},
    });

    module.applyEffect(
      "freeze",
      { type: "unit", id: "u1" },
      { durationMs: 5, speedMultiplier: 0.5 }
    );
    module.tick(10);

    STATUS_EFFECT_OVERLAY_IDS.forEach((effectId) => {
      assert.ok(
        !overlays.overlayState.has(`u1:${effectId}:fill`),
        `overlay ${effectId} should be cleared on fill`
      );
      assert.ok(
        !overlays.overlayState.has(`u1:${effectId}:stroke`),
        `overlay ${effectId} should be cleared on stroke`
      );
    });
  });

  test("damage over time routes through DamageService with overTime defaults", () => {
    const calls: Array<{
      target: { type: string; id: string };
      amount: number;
      options: { overTime?: number; skipKnockback?: boolean };
    }> = [];
    const module = new StatusEffectsModule({
      damage: createDamageServiceStub({
        applyStatusEffectDamage: (target, amount, options) => {
          calls.push({ target, amount, options: options ?? {} });
          return amount;
        },
      }),
    });

    module.applyEffect("burn", { type: "brick", id: "b1" }, { damagePerSecond: 10 });
    module.tick(1000);

    assert.strictEqual(calls.length, 1, "should apply one damage tick");
    assert.deepStrictEqual(calls[0]?.target, { type: "brick", id: "b1" });
    assert.strictEqual(calls[0]?.options.overTime, 1);
    assert.strictEqual(calls[0]?.options.skipKnockback, true);
  });
});
