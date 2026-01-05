import assert from "assert";
import { describe, test } from "./testRunner";
import { SceneObjectManager } from "../src/logic/services/scene-object-manager/SceneObjectManager";
import {
  PlayerUnitAbilities,
  PlayerUnitAbilityState,
} from "../src/logic/modules/active-map/player-units/PlayerUnitAbilities";
import type { AbilitySoundPlayer } from "../src/logic/modules/active-map/player-units/PlayerUnitAbilities";
import type { EffectsModule } from "../src/logic/modules/scene/effects/effects.module";
import type { FireballModule } from "../src/logic/modules/scene/fireball/fireball.module";
import type { ExplosionModule } from "../src/logic/modules/scene/explosion/explosion.module";
import type { PlayerUnitType } from "../src/db/player-units-db";
import { AbilityVisualService } from "../src/logic/modules/active-map/player-units/abilities/AbilityVisualService";

describe("PlayerUnitAbilities sound effects", () => {
  const createBaseState = (overrides: Partial<PlayerUnitAbilityState> = {}): PlayerUnitAbilityState => ({
    id: overrides.id ?? "unit", 
    type: overrides.type ?? ("bluePentagon" as PlayerUnitType),
    position: overrides.position ?? { x: 0, y: 0 },
    hp: overrides.hp ?? 10,
    maxHp: overrides.maxHp ?? 10,
    baseAttackDamage: overrides.baseAttackDamage ?? 10,
    baseAttackInterval: overrides.baseAttackInterval ?? 1,
    pheromoneHealingMultiplier: overrides.pheromoneHealingMultiplier ?? 0,
    pheromoneAggressionMultiplier: overrides.pheromoneAggressionMultiplier ?? 0,
    pheromoneAttackBonuses: overrides.pheromoneAttackBonuses ?? [],
    timeSinceLastAttack: overrides.timeSinceLastAttack ?? 0,
    timeSinceLastSpecial: overrides.timeSinceLastSpecial ?? 5,
    fireballDamageMultiplier: overrides.fireballDamageMultiplier ?? 0,
    equippedModules: overrides.equippedModules ?? [],
    ownedSkills: overrides.ownedSkills ?? [],
  });

  const createAbilities = (
    units: PlayerUnitAbilityState[],
    options: {
      audio?: AbilitySoundPlayer;
      effects?: EffectsModule;
      fireballs?: FireballModule;
      explosions?: ExplosionModule;
      findNearestBrick?: () => string | null;
      damageUnit?: (id: string, damage: number) => void;
    } = {}
  ) => {
    const scene = new SceneObjectManager();
    const explosions =
      options.explosions ?? ({ spawnExplosionByType: () => {} } as unknown as ExplosionModule);
    const effects = options.effects;
    const fireballs = options.fireballs;
    const audio = options.audio;
    const findNearestBrick = options.findNearestBrick ?? (() => null);
    const damageUnit = options.damageUnit ?? (() => {});

    const visuals = new AbilityVisualService({
      scene,
      explosions,
      getArcs: () => undefined,
      getEffects: () => effects,
      getFireballs: () => fireballs,
    });

    return new PlayerUnitAbilities({
      sceneService: visuals,
      logEvent: () => {},
      formatUnitLabel: (unit) => unit.id,
      getUnits: () => units,
      getUnitById: (id) => units.find((unit) => unit.id === id),
      getBrickPosition: () => null,
      damageBrick: () => {},
      getBricksInRadius: () => [],
      damageUnit,
      findNearestBrick: () => findNearestBrick(),
      audio,
    });
  };

  test("plays heal sound when pheromone heal triggers", () => {
    const audioCalls: string[] = [];
    const audio: AbilitySoundPlayer = {
      playSoundEffect: (url) => audioCalls.push(url),
    };

    const healer = createBaseState({
      id: "healer",
      pheromoneHealingMultiplier: 1,
      equippedModules: ["mendingGland"],
      ownedSkills: ["pheromones"],
    });
    const ally = createBaseState({
      id: "ally",
      hp: 2,
      maxHp: 10,
    });
    const units = [healer, ally];
    const abilities = createAbilities(units, { audio });

    const result = abilities.processUnitAbilities(healer, 5);

    assert.strictEqual(result?.abilityId, "heal");
    assert.deepStrictEqual(audioCalls, ["/audio/sounds/brick_effects/heal.mp3"]);
  });

  test("plays frenzy sound when pheromone buff triggers", () => {
    const audioCalls: string[] = [];
    const audio: AbilitySoundPlayer = {
      playSoundEffect: (url) => audioCalls.push(url),
    };
    const effects = {
      hasEffect: () => false,
      applyEffect: () => {},
      removeEffect: () => {},
    } as unknown as EffectsModule;

    const source = createBaseState({
      id: "buffer",
      pheromoneAggressionMultiplier: 1,
      pheromoneHealingMultiplier: 0,
      equippedModules: ["frenzyGland"],
      ownedSkills: ["pheromones"],
    });
    const ally = createBaseState({ id: "ally" });
    const units = [source, ally];
    const abilities = createAbilities(units, { audio, effects });

    const result = abilities.processUnitAbilities(source, 5);

    assert.strictEqual(result?.abilityId, "frenzy");
    assert.deepStrictEqual(audioCalls, ["/audio/sounds/brick_effects/buff.mp3"]);
  });

  test("plays fireball sound when fireball ability triggers", () => {
    const audioCalls: string[] = [];
    const audio: AbilitySoundPlayer = {
      playSoundEffect: (url) => audioCalls.push(url),
    };
    let spawnedDamage = 0;
    const fireballs = {
      spawnFireball: (_options: unknown) => {},
    } as unknown as FireballModule;

    const source = createBaseState({
      id: "pyro",
      pheromoneHealingMultiplier: 0,
      pheromoneAggressionMultiplier: 0,
      fireballDamageMultiplier: 1.5,
      equippedModules: ["fireballOrgan"],
      ownedSkills: [],
    });
    const units = [source];
    const abilities = createAbilities(units, {
      audio,
      fireballs,
      findNearestBrick: () => "brick-1",
      damageUnit: (_id, damage) => {
        spawnedDamage = damage;
      },
    });

    const result = abilities.processUnitAbilities(source, 5);

    assert.strictEqual(result?.abilityId, "fireball");
    assert.strictEqual(audioCalls.length, 1);
    assert.strictEqual(audioCalls[0], "/audio/sounds/brick_effects/fireball.mp3");
    assert(spawnedDamage > 0, "fireball should inflict self-damage");
  });

});
