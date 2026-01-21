import assert from "assert";
import { describe, test } from "./testRunner";
import { DataBridge } from "../src/core/logic/ui/DataBridge";
import { NecromancerModule } from "../src/logic/modules/active-map/necromancer/necromancer.module";
import { NECROMANCER_RESOURCES_BRIDGE_KEY } from "../src/logic/modules/active-map/necromancer/necromancer.const";
import type { PlayerUnitsModule } from "../src/logic/modules/active-map/player-units/player-units.module";
import type { BonusesModule } from "../src/logic/modules/shared/bonuses/bonuses.module";
import type { UnitDesignModule } from "../src/logic/modules/camp/unit-design/unit-design.module";
import type { BonusValueMap } from "../src/logic/modules/shared/bonuses/bonuses.types";
import type { SceneObjectManager } from "../src/core/logic/provided/services/scene-object-manager/SceneObjectManager";
import { MapRunState } from "../src/logic/modules/active-map/map/MapRunState";

const createBonusesStub = (values: BonusValueMap): BonusesModule =>
  ({
    subscribe: (listener: (updated: BonusValueMap) => void) => {
      listener(values);
      return () => {};
    },
    getAllValues: () => values,
  } as BonusesModule);

const createUnitDesignsStub = (): UnitDesignModule =>
  ({
    subscribe: (listener: () => void) => {
      listener();
      return () => {};
    },
    getActiveRosterDesigns: () => [],
  } as UnitDesignModule);

const createPlayerUnitsStub = (): PlayerUnitsModule =>
  ({
    getActiveUnitCount: () => 0,
  } as PlayerUnitsModule);

const createSceneStub = (): SceneObjectManager =>
  ({
    getMapSize: () => ({ width: 1000, height: 1000 }),
  } as SceneObjectManager);

describe("NecromancerModule", () => {
  test("ensureMinSanity clamps sanity to the minimum without exceeding max", () => {
    const bridge = new DataBridge();
    const runState = new MapRunState();
    const bonuses = createBonusesStub({ mana_cap: 0, sanity_cap: 3, mana_regen: 0 });
    const necromancer = new NecromancerModule({
      bridge,
      playerUnits: createPlayerUnitsStub(),
      scene: createSceneStub(),
      bonuses,
      unitDesigns: createUnitDesignsStub(),
      runState,
    });

    necromancer.initialize();
    necromancer.load({ mana: 0, sanity: 0 });
    necromancer.configureForMap({ spawnPoints: [] });

    const initial = bridge.getValue(NECROMANCER_RESOURCES_BRIDGE_KEY);
    assert(initial);
    assert.strictEqual(initial.sanity.current, 0);
    assert.strictEqual(initial.sanity.max, 3);

    necromancer.ensureMinSanity(2);
    const raised = bridge.getValue(NECROMANCER_RESOURCES_BRIDGE_KEY);
    assert(raised);
    assert.strictEqual(raised.sanity.current, 2);

    necromancer.ensureMinSanity(10);
    const capped = bridge.getValue(NECROMANCER_RESOURCES_BRIDGE_KEY);
    assert(capped);
    assert.strictEqual(capped.sanity.current, 3);
  });
});
