import assert from "assert";
import { describe, test } from "./testRunner";
import { UnitRuntimeController } from "../src/logic/modules/active-map/player-units/units/UnitRuntimeController";
import type { BrickRuntimeState } from "../src/logic/modules/active-map/bricks/bricks.types";
import type { EnemyRuntimeState } from "../src/logic/modules/active-map/enemies/enemies.types";
import type { PlayerUnitState } from "../src/logic/modules/active-map/player-units/units/UnitTypes";

describe("UnitRuntimeController enemy-first", () => {
  test("chooses a brick when enemy approach is blocked by bricks (clock-like enclosure)", () => {
    const blocker = {
      id: "brick-blocker",
      hp: 100,
      physicalSize: 16,
      position: { x: 70, y: 0 },
      passableFor: [],
    } as unknown as BrickRuntimeState;

    const enemy = {
      id: "enemy-1",
      hp: 100,
      physicalSize: 14,
      position: { x: 100, y: 0 },
      passableFor: [],
    } as unknown as EnemyRuntimeState;

    const controller = new UnitRuntimeController({
      scene: {
        getMapSize: () => ({ width: 500, height: 500 }),
      } as any,
      movement: {} as any,
      bricks: {
        getNavigationRevision: () => 1,
        findBricksNear: () => [blocker],
        forEachBrickNear: (_position: any, _radius: number, visitor: (brick: BrickRuntimeState) => void) => {
          visitor(blocker);
        },
        getBrickState: (id: string) => (id === blocker.id ? blocker : null),
      } as any,
      targeting: {
        findTargetsNear: () => [
          {
            id: enemy.id,
            type: "enemy",
            position: enemy.position,
            hp: enemy.hp,
            maxHp: enemy.hp,
            armor: 0,
            baseDamage: 0,
            effectiveDamage: 0,
            physicalSize: enemy.physicalSize,
            data: enemy,
          },
        ],
        findNearestTarget: () => null,
      } as any,
      abilities: { processUnitAbilities: () => null } as any,
      explosions: {} as any,
      projectiles: { tick: () => {} } as any,
      damage: {} as any,
      enemies: {
        getEnemyState: (id: string) => (id === enemy.id ? enemy : null),
      } as any,
      navigation: {
        getActorMemory: () => undefined,
        setActorMemory: () => {},
        clearActorMemory: () => {},
        probePath: () => ({ goalReached: false, waypoints: [{ x: 48, y: 0 }] }),
      } as any,
      statusEffects: {} as any,
      getDesignTargetingMode: () => "firstEnemy",
      syncUnitTargetingMode: () => "firstEnemy",
      removeUnit: () => {},
      updateSceneState: () => {},
    });

    const unit = {
      id: "unit-1",
      position: { x: 0, y: 0 },
      physicalSize: 10,
      baseAttackDistance: 20,
    } as unknown as PlayerUnitState;

    const target = (controller as any).findEnemyFirstTarget(unit) as
      | { target: BrickRuntimeState | EnemyRuntimeState; type: "brick" | "enemy" }
      | null;

    assert(target, "expected enemy-first to return a target");
    assert.strictEqual(target!.type, "brick");
    assert.strictEqual(target!.target.id, blocker.id);
  });
});

