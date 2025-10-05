import assert from "assert";
import { describe, test } from "./testRunner";
import { SceneObjectManager } from "../src/logic/services/SceneObjectManager";
import { DataBridge } from "../src/logic/core/DataBridge";
import { BricksModule } from "../src/logic/modules/BricksModule";
import { PlayerUnitsModule } from "../src/logic/modules/PlayerUnitsModule";
import { MovementService } from "../src/logic/services/MovementService";
import { MapModule, PLAYER_UNIT_SPAWN_SAFE_RADIUS } from "../src/logic/modules/MapModule";
import { ExplosionModule } from "../src/logic/modules/ExplosionModule";
import { NecromancerModule } from "../src/logic/modules/NecromancerModule";

const distanceSq = (a: { x: number; y: number }, b: { x: number; y: number }): number => {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
};

describe("MapModule", () => {
  test("bricks spawn outside of the player unit safe radius", () => {
    const scene = new SceneObjectManager();
    const bridge = new DataBridge();
    const explosions = new ExplosionModule({ scene });
    const resources = {
      startRun: () => {
        // no-op for tests
      },
      grantResources: () => {
        // no-op for tests
      },
    };
    const bricks = new BricksModule({ scene, bridge, explosions, resources });
    const movement = new MovementService();
    const playerUnits = new PlayerUnitsModule({ scene, bricks, bridge, movement });
    const necromancer = new NecromancerModule({
      bridge,
      playerUnits,
      scene,
    });
    const maps = new MapModule({
      scene,
      bridge,
      bricks,
      playerUnits,
      necromancer,
      resources,
    });

    necromancer.initialize();
    maps.initialize();
    maps.selectMap("initial");

    const unitsSave = playerUnits.save() as { units?: { position?: { x: number; y: number } }[] };
    assert(unitsSave.units && unitsSave.units[0]?.position, "unit should be spawned");
    const unitPosition = unitsSave.units[0]!.position!;

    const safetyRadiusSq = PLAYER_UNIT_SPAWN_SAFE_RADIUS * PLAYER_UNIT_SPAWN_SAFE_RADIUS;
    bricks.getBrickStates().forEach((brick) => {
      assert(
        distanceSq(brick.position, unitPosition) >= safetyRadiusSq,
        "brick should be spawned outside of the safety radius"
      );
    });
  });
});
