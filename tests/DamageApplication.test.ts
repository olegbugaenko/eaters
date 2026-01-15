import assert from "assert";
import { describe, test } from "./testRunner";
import { applyDamagePipeline, sanitizeDamageOptions } from "../src/logic/helpers/damage-application";
import { calculateMitigatedDamage } from "../src/logic/helpers/damage-formula";
import { SceneObjectManager } from "../src/core/logic/provided/services/scene-object-manager/SceneObjectManager";
import { DataBridge } from "../src/core/logic/ui/DataBridge";
import { ExplosionModule } from "../src/logic/modules/scene/explosion/explosion.module";
import { BonusesModule } from "../src/logic/modules/shared/bonuses/bonuses.module";
import { MapRunState } from "../src/logic/modules/active-map/map/MapRunState";
import { StatusEffectsModule } from "../src/logic/modules/active-map/status-effects/status-effects.module";
import { BricksModule } from "../src/logic/modules/active-map/bricks/bricks.module";
import type { BrickData } from "../src/logic/modules/active-map/bricks/bricks.types";
import { ProjectileSpellBehavior } from "../src/logic/modules/active-map/spellcasting/implementations/ProjectileSpellBehavior";
import { PersistentAoeSpellBehavior } from "../src/logic/modules/active-map/spellcasting/implementations/PersistentAoeSpellBehavior";
import type { SpellBehaviorDependencies } from "../src/logic/modules/active-map/spellcasting/SpellBehavior";
import type { SpellConfig } from "../src/db/spells-db";
import { FILL_TYPES } from "../src/core/logic/provided/services/scene-object-manager/scene-object-manager.const";
import { DamageService } from "../src/logic/modules/active-map/targeting/DamageService";
import { TargetingService } from "../src/logic/modules/active-map/targeting/TargetingService";
import { BricksTargetingProvider } from "../src/logic/modules/active-map/targeting/BricksTargetingProvider";
import type { UnitProjectileSpawn } from "../src/logic/modules/active-map/projectiles/projectiles.types";
import { getBrickConfig } from "../src/db/bricks-db";

class FakeProjectiles {
  public lastSpawn: UnitProjectileSpawn | null = null;

  public spawn(projectile: UnitProjectileSpawn): string {
    this.lastSpawn = projectile;
    return "projectile-1";
  }

  public tick(): void {}

  public clear(): void {}

  public cleanupExpired(): void {}
}

const createBricksModule = () => {
  const scene = new SceneObjectManager();
  const bridge = new DataBridge();
  const runState = new MapRunState();
  runState.start();
  const explosions = new ExplosionModule({ scene });
  const bonuses = new BonusesModule();
  bonuses.initialize();
  const statusEffects = new StatusEffectsModule({
    damage: { applyTargetDamage: () => 0 } as unknown as DamageService,
  });
  const resources = {
    grantResources: () => undefined,
    notifyBrickDestroyed: () => undefined,
  };
  const bricks = new BricksModule({
    scene,
    bridge,
    explosions,
    resources,
    bonuses,
    runState,
    statusEffects,
  });
  return { bricks, scene };
};

const createDamageServices = (bricks: BricksModule) => {
  const targeting = new TargetingService();
  targeting.registerProvider(new BricksTargetingProvider(bricks));
  const damage = new DamageService({
    bricks: () => bricks,
    targeting,
  });
  return { targeting, damage };
};

describe("Damage pipeline", () => {
  test("applies mitigation for direct hits", () => {
    const options = sanitizeDamageOptions({
      armorPenetration: 10,
      overTime: 0.5,
      rewardMultiplier: 2,
      skipKnockback: true,
    });
    const expected = calculateMitigatedDamage({
      rawDamage: 100,
      armor: 50,
      armorDelta: 0,
      armorPenetration: options.armorPenetration,
      incomingMultiplier: 1,
      overTime: options.overTime,
    });
    const result = applyDamagePipeline(
      {
        rawDamage: 100,
        armor: 50,
        armorDelta: 0,
        armorPenetration: options.armorPenetration,
        incomingMultiplier: 1,
        overTime: options.overTime,
        currentHp: 200,
        maxHp: 200,
      },
      { skipKnockback: options.skipKnockback },
    );
    assert.strictEqual(result.inflictedDamage, expected);
    assert.strictEqual(result.nextHp, 200 - expected);
  });

  test("mitigates counter damage from bricks", () => {
    const brickConfig = getBrickConfig("smallSquareGray");
    const rawCounterDamage = brickConfig.destructubleData?.baseDamage ?? 10;
    const expected = calculateMitigatedDamage({
      rawDamage: rawCounterDamage,
      armor: 25,
      armorDelta: 0,
      armorPenetration: 0,
    });
    const result = applyDamagePipeline({
      rawDamage: rawCounterDamage,
      armor: 25,
      armorDelta: 0,
      armorPenetration: 0,
      currentHp: 100,
      maxHp: 100,
    });
    assert.strictEqual(result.inflictedDamage, expected);
    assert.strictEqual(result.nextHp, 100 - expected);
  });
});

describe("Spell damage integration", () => {
  test("projectile spells apply mitigated hit and splash damage", () => {
    const { bricks, scene } = createBricksModule();
    bricks.setBricks([
      {
        position: { x: 100, y: 100 },
        rotation: 0,
        level: 1,
        type: "smallSquareGray",
      } as BrickData,
      {
        position: { x: 140, y: 100 },
        rotation: 0,
        level: 1,
        type: "smallSquareGray",
      } as BrickData,
    ]);

    const [primary, splash] = bricks.getBrickStates();
    assert(primary && splash, "expected two bricks");

    const { damage, targeting } = createDamageServices(bricks);
    const projectiles = new FakeProjectiles();
    const dependencies: SpellBehaviorDependencies = {
      scene,
      bricks,
      bonuses: {},
      projectiles: projectiles as unknown as any,
      explosions: undefined,
      damage,
      targeting,
      getSpellPowerMultiplier: () => 1,
    };

    const behavior = new ProjectileSpellBehavior(dependencies);
    const config: SpellConfig = {
      id: "magic-arrow",
      type: "projectile",
      name: "Magic Arrow",
      description: "test",
      cost: { mana: 0, sanity: 0 },
      cooldownSeconds: 1,
      damage: { min: 10, max: 10 },
      projectile: {
        radius: 4,
        speed: 100,
        lifetimeMs: 1000,
        fill: { fillType: FILL_TYPES.SOLID, color: { r: 1, g: 1, b: 1, a: 1 } },
        tail: {
          lengthMultiplier: 1,
          widthMultiplier: 1,
          startColor: { r: 1, g: 1, b: 1, a: 1 },
          endColor: { r: 1, g: 1, b: 1, a: 1 },
        },
        aoe: { radius: 60, splash: 0.5 },
        targetTypes: ["brick"],
      },
    };

    behavior.cast({
      spellId: "magic-arrow",
      config,
      origin: { x: 0, y: 0 },
      target: primary.position,
      direction: { x: 1, y: 0 },
      spellPowerMultiplier: 1,
    });

    const spawn = projectiles.lastSpawn;
    assert(spawn?.onHit, "expected onHit callback");
    spawn.onHit({
      targetId: primary.id,
      targetType: "brick",
      brickId: primary.id,
      position: { ...primary.position },
    });

    const [afterPrimary, afterSplash] = bricks.getBrickStates();
    assert(afterPrimary && afterSplash, "expected updated bricks");

    const expectedPrimary = calculateMitigatedDamage({
      rawDamage: 10,
      armor: primary.armor,
      armorDelta: 0,
      armorPenetration: 0,
    });
    const expectedSplash = calculateMitigatedDamage({
      rawDamage: 5,
      armor: splash.armor,
      armorDelta: 0,
      armorPenetration: 0,
    });

    assert.strictEqual(afterPrimary.hp, primary.hp - expectedPrimary);
    assert.strictEqual(afterSplash.hp, splash.hp - expectedSplash);
  });

  test("persistent AOE damages only targets inside the ring", () => {
    const { bricks, scene } = createBricksModule();
    bricks.setBricks([
      {
        position: { x: 200, y: 200 },
        rotation: 0,
        level: 1,
        type: "smallSquareGray",
      } as BrickData,
      {
        position: { x: 400, y: 400 },
        rotation: 0,
        level: 1,
        type: "smallSquareGray",
      } as BrickData,
    ]);
    const [inside, outside] = bricks.getBrickStates();
    assert(inside && outside, "expected two bricks");

    const { damage, targeting } = createDamageServices(bricks);
    const dependencies: SpellBehaviorDependencies = {
      scene,
      bricks,
      bonuses: {},
      projectiles: {} as any,
      explosions: undefined,
      damage,
      targeting,
      getSpellPowerMultiplier: () => 1,
    };

    const behavior = new PersistentAoeSpellBehavior(dependencies);
    const config: SpellConfig = {
      id: "ring-of-fire",
      type: "persistent-aoe",
      name: "Ring of Fire",
      description: "test",
      cost: { mana: 0, sanity: 0 },
      cooldownSeconds: 1,
      persistentAoe: {
        durationMs: 2000,
        damagePerSecond: 10,
        ring: { shape: "ring", startRadius: 60, endRadius: 60, thickness: 10 },
        targetTypes: ["brick"],
      },
    };

    behavior.cast({
      spellId: "ring-of-fire",
      config,
      origin: { ...inside.position },
      target: { ...inside.position },
      direction: { x: 1, y: 0 },
      spellPowerMultiplier: 1,
    });

    behavior.tick(1000);

    const [afterInside, afterOutside] = bricks.getBrickStates();
    assert(afterInside && afterOutside, "expected updated bricks");

    const expectedInside = calculateMitigatedDamage({
      rawDamage: 10,
      armor: inside.armor,
      armorDelta: 0,
      armorPenetration: 0,
      overTime: 1,
    });

    assert.strictEqual(afterInside.hp, inside.hp - expectedInside);
    assert.strictEqual(afterOutside.hp, outside.hp);
  });
});
