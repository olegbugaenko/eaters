import assert from "assert";
import { describe, test } from "./testRunner";
import { SceneObjectManager } from "../src/logic/services/SceneObjectManager";
import { DataBridge } from "../src/logic/core/DataBridge";
import { BricksModule } from "../src/logic/modules/active-map/BricksModule";
import { ExplosionModule } from "../src/logic/modules/scene/ExplosionModule";
import { MovementService } from "../src/logic/services/MovementService";
import { PlayerUnitsModule } from "../src/logic/modules/active-map/units/PlayerUnitsModule";
import { NecromancerModule } from "../src/logic/modules/active-map/NecromancerModule";
import { BonusesModule } from "../src/logic/modules/shared/BonusesModule";
import type { UnitDesignModule } from "../src/logic/modules/camp/UnitDesignModule";

const createUnitDesignerStub = (): UnitDesignModule =>
  ({
    subscribe: (listener: (designs: never[]) => void) => {
      listener([]);
      return () => {};
    },
    getDefaultDesignForType: () => null,
    getDesign: () => null,
    getAllDesigns: () => [],
    getActiveRosterDesigns: () => [],
  }) as unknown as UnitDesignModule;

const createNecromancer = (onSanityDepleted: () => void): NecromancerModule => {
  const scene = new SceneObjectManager();
  const bridge = new DataBridge();
  const explosions = new ExplosionModule({ scene });
  const bonuses = new BonusesModule();
  bonuses.initialize();
  const resources = {
    startRun: () => {},
    cancelRun: () => {},
    grantResources: () => {},
    notifyBrickDestroyed: () => {},
  };
  const bricks = new BricksModule({ scene, bridge, explosions, resources, bonuses });
  const movement = new MovementService();
  const playerUnits = new PlayerUnitsModule({
    scene,
    bricks,
    bridge,
    movement,
    bonuses,
    explosions,
    getModuleLevel: () => 0,
    hasSkill: () => false,
    getDesignTargetingMode: () => "nearest",
  });

  return new NecromancerModule({
    bridge,
    playerUnits,
    scene,
    bonuses,
    unitDesigns: createUnitDesignerStub(),
    onSanityDepleted,
  });
};

describe("NecromancerModule", () => {
  test("detects sanity depletion even if the map flag is stale", () => {
    let depletionCalls = 0;
    const necromancer = createNecromancer(() => {
      depletionCalls += 1;
    });
    necromancer.initialize();
    necromancer.configureForMap({ spawnPoints: [{ x: 0, y: 0 }] });

    (necromancer as unknown as { mapActive: boolean }).mapActive = false;
    (necromancer as unknown as { sanity: { current: number } }).sanity.current = 0;

    necromancer.tick(16);

    assert.strictEqual(depletionCalls, 1, "sanity depletion should trigger once");
    assert.strictEqual(
      (necromancer as unknown as { sanityDepleted: boolean }).sanityDepleted,
      true,
      "sanity should be marked as depleted"
    );
  });
});
