import assert from "assert";
import { describe, test } from "./testRunner";
import { SceneObjectManager } from "../src/logic/services/SceneObjectManager";
import { DataBridge } from "../src/logic/core/DataBridge";
import { BonusesModule } from "../src/logic/modules/shared/BonusesModule";
import { ExplosionModule } from "../src/logic/modules/scene/ExplosionModule";
import { BricksModule } from "../src/logic/modules/active-map/BricksModule";
import { MovementService } from "../src/logic/services/MovementService";
import { PlayerUnitsModule } from "../src/logic/modules/active-map/units/PlayerUnitsModule";
import { NecromancerModule } from "../src/logic/modules/active-map/NecromancerModule";
import { SpellcastingModule } from "../src/logic/modules/active-map/spells/SpellcastingModule";
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

describe("SpellcastingModule", () => {
  test("ends the run instead of casting when sanity is depleted", () => {
    const scene = new SceneObjectManager();
    const bridge = new DataBridge();
    const bonuses = new BonusesModule();
    bonuses.initialize();
    const explosions = new ExplosionModule({ scene });
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

    let sanityDepletedCalls = 0;
    const necromancer = new NecromancerModule({
      bridge,
      playerUnits,
      scene,
      bonuses,
      unitDesigns: createUnitDesignerStub(),
      onSanityDepleted: () => {
        sanityDepletedCalls += 1;
      },
    });
    necromancer.initialize();
    playerUnits.setSanityGuard(() => necromancer.enforceSanityBoundary());
    necromancer.configureForMap({ spawnPoints: [{ x: 0, y: 0 }] });
    (necromancer as unknown as { sanity: { current: number } }).sanity.current = 0;

    const spellcasting = new SpellcastingModule({
      bridge,
      scene,
      necromancer,
      bricks,
      bonuses,
      explosions,
      getSkillLevel: () => 10,
    });
    spellcasting.initialize();

    const castResult = spellcasting.tryCastSpell("magic-arrow", { x: 0, y: 0 });

    assert.strictEqual(castResult, false, "spell should not cast when sanity is 0");
    assert.strictEqual(sanityDepletedCalls, 1, "sanity depletion should be triggered");
  });
});
