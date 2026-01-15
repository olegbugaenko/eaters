import assert from "assert";
import { describe, test } from "./testRunner";
import { StatusEffectsModule } from "../src/logic/modules/active-map/status-effects/status-effects.module";
import type { DamageService } from "../src/logic/modules/active-map/targeting/DamageService";
import { STATUS_EFFECT_OVERLAY_IDS } from "../src/db/status-effects-db";

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
    const module = new StatusEffectsModule({
      damage: { applyTargetDamage: () => 0 } as unknown as DamageService,
    });
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
    const module = new StatusEffectsModule({
      damage: { applyTargetDamage: () => 0 } as unknown as DamageService,
    });
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
});
