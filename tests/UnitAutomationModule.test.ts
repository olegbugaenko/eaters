import assert from "assert";
import { describe, test } from "./testRunner";
import { DataBridge } from "../src/logic/core/DataBridge";
import {
  DEFAULT_UNIT_AUTOMATION_STATE,
  UNIT_AUTOMATION_STATE_BRIDGE_KEY,
  UnitAutomationBridgeState,
  UnitAutomationModule,
  selectNextAutomationTarget,
  AutomationSelectionCandidate,
} from "../src/logic/modules/UnitAutomationModule";
import { PLAYER_UNIT_TYPES } from "../src/db/player-units-db";
import { UnitDesignId, UnitDesignerUnitState } from "../src/logic/modules/UnitDesignModule";
import { NecromancerResourceSnapshot } from "../src/logic/modules/NecromancerModule";
import { createEmptyResourceAmount } from "../src/types/resources";
import { PlayerUnitBlueprintStats } from "../src/types/player-units";

const createFullResources = (): NecromancerResourceSnapshot => ({
  mana: { current: 999, max: 999, regenPerSecond: 10 },
  sanity: { current: 999, max: 999 },
});

describe("UnitAutomationModule", () => {
  test("automatically summons enabled units once the skill is unlocked", () => {
    const bridge = new DataBridge();
    const attempts: UnitDesignId[] = [];
    const necromancer = {
      trySpawnDesign: (id: UnitDesignId) => {
        attempts.push(id);
        return true;
      },
      getResources: () => createFullResources(),
    };
    let skillLevel = 0;
    const unitType = PLAYER_UNIT_TYPES[0];
    assert(unitType, "expected at least one unit type for automation tests");
    const blueprint: PlayerUnitBlueprintStats = {
      type: unitType,
      name: "Test",
      base: { maxHp: 10, attackDamage: 5 },
      effective: { maxHp: 10, attackDamage: 5 },
      multipliers: { maxHp: 1, attackDamage: 1 },
      critChance: { base: 0, bonus: 0, effective: 0 },
      critMultiplier: { base: 2, multiplier: 0, effective: 2 },
      armor: 0,
      hpRegenPerSecond: 0,
      hpRegenPercentage: 0,
      armorPenetration: 0,
      baseAttackInterval: 1,
      baseAttackDistance: 100,
      moveSpeed: 1,
      moveAcceleration: 1,
      mass: 1,
      physicalSize: 1,
    };
    const design: UnitDesignerUnitState = {
      id: "design-1",
      type: unitType,
      name: "Test",
      modules: [],
      moduleDetails: [],
      cost: createEmptyResourceAmount(),
      blueprint,
      runtime: {
        rewardMultiplier: 1,
        damageTransferPercent: 0,
        damageTransferRadius: 0,
        attackStackBonusPerHit: 0,
        attackStackBonusCap: 0,
      },
      targetingMode: "nearest",
    };
    const unitDesigns = {
      subscribe: (listener: (designs: readonly UnitDesignerUnitState[]) => void) => {
        listener([design]);
        return () => undefined;
      },
      getDefaultDesignForType: () => design,
      getActiveRosterDesigns: () => [design],
    };
    const module = new UnitAutomationModule({
      bridge,
      necromancer,
      unitDesigns,
      getSkillLevel: () => skillLevel,
      isRunActive: () => true,
    });

    module.initialize();
    const initialState =
      bridge.getValue<UnitAutomationBridgeState>(
        UNIT_AUTOMATION_STATE_BRIDGE_KEY
      ) ?? DEFAULT_UNIT_AUTOMATION_STATE;
    assert.strictEqual(initialState.unlocked, false);

    module.setAutomationEnabled(design.id, true);
    module.tick(16);
    assert.strictEqual(attempts.length, 0, "should not spawn before unlock");

    skillLevel = 1;
    module.tick(16);
    assert(attempts.length > 0, "should attempt to spawn after unlock");
    assert.strictEqual(attempts[0], design.id);

    const unlockedState =
      bridge.getValue<UnitAutomationBridgeState>(
        UNIT_AUTOMATION_STATE_BRIDGE_KEY
      ) ?? DEFAULT_UNIT_AUTOMATION_STATE;
    const unitState = unlockedState.units.find((entry) => entry.designId === design.id);
    assert.strictEqual(unlockedState.unlocked, true);
    assert.strictEqual(unitState?.enabled, true);
    assert.strictEqual(unitState?.weight, 1);
  });

  test("automation weights can be updated", () => {
    const bridge = new DataBridge();
    const attempts: UnitDesignId[] = [];
    const necromancer = {
      trySpawnDesign: (id: UnitDesignId) => {
        attempts.push(id);
        return true;
      },
      getResources: () => createFullResources(),
    };
    const unitType = PLAYER_UNIT_TYPES[0];
    assert(unitType, "expected at least one unit type for automation tests");
    const design: UnitDesignerUnitState = {
      id: "design-weight",
      type: unitType,
      name: "Weight Test",
      modules: [],
      moduleDetails: [],
      cost: createEmptyResourceAmount(),
      blueprint: {
        type: unitType,
        name: "Weight Test",
        base: { maxHp: 1, attackDamage: 1 },
        effective: { maxHp: 1, attackDamage: 1 },
        multipliers: { maxHp: 1, attackDamage: 1 },
        critChance: { base: 0, bonus: 0, effective: 0 },
        critMultiplier: { base: 2, multiplier: 0, effective: 2 },
        armor: 0,
        hpRegenPerSecond: 0,
        hpRegenPercentage: 0,
        armorPenetration: 0,
        baseAttackInterval: 1,
        baseAttackDistance: 100,
        moveSpeed: 1,
        moveAcceleration: 1,
        mass: 1,
        physicalSize: 1,
      },
      runtime: {
        rewardMultiplier: 1,
        damageTransferPercent: 0,
        damageTransferRadius: 0,
        attackStackBonusPerHit: 0,
        attackStackBonusCap: 0,
      },
      targetingMode: "nearest",
    };
    const unitDesigns = {
      subscribe: (listener: (designs: readonly UnitDesignerUnitState[]) => void) => {
        listener([design]);
        return () => undefined;
      },
      getDefaultDesignForType: () => design,
      getActiveRosterDesigns: () => [design],
    };
    const module = new UnitAutomationModule({
      bridge,
      necromancer,
      unitDesigns,
      getSkillLevel: () => 1,
      isRunActive: () => true,
    });

    module.initialize();
    module.setAutomationEnabled(design.id, true);
    module.setAutomationWeight(design.id, 5);

    const state =
      bridge.getValue<UnitAutomationBridgeState>(UNIT_AUTOMATION_STATE_BRIDGE_KEY) ??
      DEFAULT_UNIT_AUTOMATION_STATE;
    const unitState = state.units.find((entry) => entry.designId === design.id);
    assert.strictEqual(unitState?.weight, 5);

    module.tick(16);
    assert(attempts.length > 0, "automation should attempt spawns");
  });

  test("automation distributes spawns according to weights", () => {
    const bridge = new DataBridge();
    const attempts: UnitDesignId[] = [];
    const necromancer = {
      trySpawnDesign: (id: UnitDesignId) => {
        attempts.push(id);
        return true;
      },
      getResources: () => createFullResources(),
    };
    const unitType = PLAYER_UNIT_TYPES[0];
    assert(unitType, "expected at least one unit type for automation tests");
    const lightDesign: UnitDesignerUnitState = {
      id: "light-design",
      type: unitType,
      name: "Light",
      modules: [],
      moduleDetails: [],
      cost: createEmptyResourceAmount(),
      blueprint: {
        type: unitType,
        name: "Light",
        base: { maxHp: 1, attackDamage: 1 },
        effective: { maxHp: 1, attackDamage: 1 },
        multipliers: { maxHp: 1, attackDamage: 1 },
        critChance: { base: 0, bonus: 0, effective: 0 },
        critMultiplier: { base: 2, multiplier: 0, effective: 2 },
        armor: 0,
        hpRegenPerSecond: 0,
        hpRegenPercentage: 0,
        armorPenetration: 0,
        baseAttackInterval: 1,
        baseAttackDistance: 100,
        moveSpeed: 1,
        moveAcceleration: 1,
        mass: 1,
        physicalSize: 1,
      },
      runtime: {
        rewardMultiplier: 1,
        damageTransferPercent: 0,
        damageTransferRadius: 0,
        attackStackBonusPerHit: 0,
        attackStackBonusCap: 0,
      },
      targetingMode: "nearest",
    };
    const heavyDesign: UnitDesignerUnitState = {
      id: "heavy-design",
      type: unitType,
      name: "Heavy",
      modules: [],
      moduleDetails: [],
      cost: createEmptyResourceAmount(),
      blueprint: {
        type: unitType,
        name: "Heavy",
        base: { maxHp: 1, attackDamage: 1 },
        effective: { maxHp: 1, attackDamage: 1 },
        multipliers: { maxHp: 1, attackDamage: 1 },
        critChance: { base: 0, bonus: 0, effective: 0 },
        critMultiplier: { base: 2, multiplier: 0, effective: 2 },
        armor: 0,
        hpRegenPerSecond: 0,
        hpRegenPercentage: 0,
        armorPenetration: 0,
        baseAttackInterval: 1,
        baseAttackDistance: 100,
        moveSpeed: 1,
        moveAcceleration: 1,
        mass: 1,
        physicalSize: 1,
      },
      runtime: {
        rewardMultiplier: 1,
        damageTransferPercent: 0,
        damageTransferRadius: 0,
        attackStackBonusPerHit: 0,
        attackStackBonusCap: 0,
      },
      targetingMode: "nearest",
    };
    const designs: UnitDesignerUnitState[] = [lightDesign, heavyDesign];
    const unitDesigns = {
      subscribe: (listener: (designs: readonly UnitDesignerUnitState[]) => void) => {
        listener(designs);
        return () => undefined;
      },
      getDefaultDesignForType: () => lightDesign,
      getActiveRosterDesigns: () => designs,
    };

    const module = new UnitAutomationModule({
      bridge,
      necromancer,
      unitDesigns,
      getSkillLevel: () => 1,
      isRunActive: () => true,
    });

    module.initialize();
    module.setAutomationEnabled(lightDesign.id, true);
    module.setAutomationEnabled(heavyDesign.id, true);
    module.setAutomationWeight(lightDesign.id, 1);
    module.setAutomationWeight(heavyDesign.id, 3);

    attempts.length = 0;

    for (let index = 0; index < 10; index += 1) {
      module.tick(16);
    }

    const lightCount = attempts.filter((id) => id === lightDesign.id).length;
    const heavyCount = attempts.filter((id) => id === heavyDesign.id).length;
    const totalAttempts = lightCount + heavyCount;

    assert(totalAttempts > 0, "expected automation to attempt spawns");

    const lightShare = lightCount / totalAttempts;
    const heavyShare = heavyCount / totalAttempts;

    const expectedLightShare = 1 / 4;
    const expectedHeavyShare = 3 / 4;

    assert(
      Math.abs(lightShare - expectedLightShare) < 0.1,
      `expected light unit share to be close to ${expectedLightShare}, got ${lightShare}`
    );
    assert(
      Math.abs(heavyShare - expectedHeavyShare) < 0.1,
      `expected heavy unit share to be close to ${expectedHeavyShare}, got ${heavyShare}`
    );
  });

  test("automation eventually summons expensive designs as mana accumulates", () => {
    const bridge = new DataBridge();
    const attempts: UnitDesignId[] = [];
    const unitType = PLAYER_UNIT_TYPES[0];
    assert(unitType, "expected at least one unit type for automation tests");
    const makeCost = (manaCost: number) => {
      const cost = createEmptyResourceAmount();
      cost.mana = manaCost;
      return cost;
    };
    const cheapDesign: UnitDesignerUnitState = {
      id: "cheap-design",
      type: unitType,
      name: "Cheap",
      modules: [],
      moduleDetails: [],
      cost: makeCost(10),
      blueprint: {
        type: unitType,
        name: "Cheap",
        base: { maxHp: 1, attackDamage: 1 },
        effective: { maxHp: 1, attackDamage: 1 },
        multipliers: { maxHp: 1, attackDamage: 1 },
        critChance: { base: 0, bonus: 0, effective: 0 },
        critMultiplier: { base: 2, multiplier: 0, effective: 2 },
        armor: 0,
        hpRegenPerSecond: 0,
        hpRegenPercentage: 0,
        armorPenetration: 0,
        baseAttackInterval: 1,
        baseAttackDistance: 100,
        moveSpeed: 1,
        moveAcceleration: 1,
        mass: 1,
        physicalSize: 1,
      },
      runtime: {
        rewardMultiplier: 1,
        damageTransferPercent: 0,
        damageTransferRadius: 0,
        attackStackBonusPerHit: 0,
        attackStackBonusCap: 0,
      },
      targetingMode: "nearest",
    };
    const expensiveDesign: UnitDesignerUnitState = {
      id: "expensive-design",
      type: unitType,
      name: "Expensive",
      modules: [],
      moduleDetails: [],
      cost: makeCost(30),
      blueprint: {
        type: unitType,
        name: "Expensive",
        base: { maxHp: 1, attackDamage: 1 },
        effective: { maxHp: 1, attackDamage: 1 },
        multipliers: { maxHp: 1, attackDamage: 1 },
        critChance: { base: 0, bonus: 0, effective: 0 },
        critMultiplier: { base: 2, multiplier: 0, effective: 2 },
        armor: 0,
        hpRegenPerSecond: 0,
        hpRegenPercentage: 0,
        armorPenetration: 0,
        baseAttackInterval: 1,
        baseAttackDistance: 100,
        moveSpeed: 1,
        moveAcceleration: 1,
        mass: 1,
        physicalSize: 1,
      },
      runtime: {
        rewardMultiplier: 1,
        damageTransferPercent: 0,
        damageTransferRadius: 0,
        attackStackBonusPerHit: 0,
        attackStackBonusCap: 0,
      },
      targetingMode: "nearest",
    };
    const designs: UnitDesignerUnitState[] = [cheapDesign, expensiveDesign];
    const manaCosts = new Map<UnitDesignId, number>([
      [cheapDesign.id, 10],
      [expensiveDesign.id, 30],
    ]);
    let mana = 0;
    const manaMax = 100;
    const manaRegen = 5;
    const necromancer = {
      trySpawnDesign: (id: UnitDesignId) => {
        const cost = manaCosts.get(id) ?? 0;
        if (mana < cost) {
          return false;
        }
        mana -= cost;
        attempts.push(id);
        return true;
      },
      getResources: () => ({
        mana: { current: mana, max: manaMax, regenPerSecond: manaRegen },
        sanity: { current: 999, max: 999 },
      }),
    };
    const unitDesigns = {
      subscribe: (listener: (designs: readonly UnitDesignerUnitState[]) => void) => {
        listener(designs);
        return () => undefined;
      },
      getDefaultDesignForType: () => cheapDesign,
      getActiveRosterDesigns: () => designs,
    };

    const module = new UnitAutomationModule({
      bridge,
      necromancer,
      unitDesigns,
      getSkillLevel: () => 1,
      isRunActive: () => true,
    });

    module.initialize();
    module.setAutomationEnabled(cheapDesign.id, true);
    module.setAutomationEnabled(expensiveDesign.id, true);
    module.setAutomationWeight(cheapDesign.id, 1);
    module.setAutomationWeight(expensiveDesign.id, 3);

    attempts.length = 0;

    for (let tick = 0; tick < 30; tick += 1) {
      mana += 5;
      module.tick(100);
    }

    const expensiveCount = attempts.filter((id) => id === expensiveDesign.id).length;
    const cheapCount = attempts.filter((id) => id === cheapDesign.id).length;

    assert(cheapCount > 0, "expected cheaper design to spawn at least once");
    assert(expensiveCount > 0, "expected expensive design to eventually spawn");
    assert(
      expensiveCount > cheapCount,
      `expected expensive design to spawn more often, got cheap=${cheapCount}, expensive=${expensiveCount}`
    );
  });

  test("automation waits for mana before spawning the weighted target", () => {
    const bridge = new DataBridge();
    const attempts: UnitDesignId[] = [];
    const unitType = PLAYER_UNIT_TYPES[0];
    assert(unitType, "expected at least one unit type for automation tests");
    const makeCost = (manaCost: number) => {
      const cost = createEmptyResourceAmount();
      cost.mana = manaCost;
      return cost;
    };
    const cheapDesign: UnitDesignerUnitState = {
      id: "wait-cheap",
      type: unitType,
      name: "Cheap",
      modules: [],
      moduleDetails: [],
      cost: makeCost(10),
      blueprint: {
        type: unitType,
        name: "Cheap",
        base: { maxHp: 1, attackDamage: 1 },
        effective: { maxHp: 1, attackDamage: 1 },
        multipliers: { maxHp: 1, attackDamage: 1 },
        critChance: { base: 0, bonus: 0, effective: 0 },
        critMultiplier: { base: 2, multiplier: 0, effective: 2 },
        armor: 0,
        hpRegenPerSecond: 0,
        hpRegenPercentage: 0,
        armorPenetration: 0,
        baseAttackInterval: 1,
        baseAttackDistance: 100,
        moveSpeed: 1,
        moveAcceleration: 1,
        mass: 1,
        physicalSize: 1,
      },
      runtime: {
        rewardMultiplier: 1,
        damageTransferPercent: 0,
        damageTransferRadius: 0,
        attackStackBonusPerHit: 0,
        attackStackBonusCap: 0,
      },
      targetingMode: "nearest",
    };
    const expensiveDesign: UnitDesignerUnitState = {
      id: "wait-expensive",
      type: unitType,
      name: "Expensive",
      modules: [],
      moduleDetails: [],
      cost: makeCost(30),
      blueprint: {
        type: unitType,
        name: "Expensive",
        base: { maxHp: 1, attackDamage: 1 },
        effective: { maxHp: 1, attackDamage: 1 },
        multipliers: { maxHp: 1, attackDamage: 1 },
        critChance: { base: 0, bonus: 0, effective: 0 },
        critMultiplier: { base: 2, multiplier: 0, effective: 2 },
        armor: 0,
        hpRegenPerSecond: 0,
        hpRegenPercentage: 0,
        armorPenetration: 0,
        baseAttackInterval: 1,
        baseAttackDistance: 100,
        moveSpeed: 1,
        moveAcceleration: 1,
        mass: 1,
        physicalSize: 1,
      },
      runtime: {
        rewardMultiplier: 1,
        damageTransferPercent: 0,
        damageTransferRadius: 0,
        attackStackBonusPerHit: 0,
        attackStackBonusCap: 0,
      },
      targetingMode: "nearest",
    };
    const designs: UnitDesignerUnitState[] = [cheapDesign, expensiveDesign];
    const manaCosts = new Map<UnitDesignId, number>([
      [cheapDesign.id, 10],
      [expensiveDesign.id, 30],
    ]);
    let mana = 0;
    const manaMax = 100;
    const manaRegen = 10;
    const necromancer = {
      trySpawnDesign: (id: UnitDesignId) => {
        const cost = manaCosts.get(id) ?? 0;
        if (mana < cost) {
          return false;
        }
        mana -= cost;
        attempts.push(id);
        return true;
      },
      getResources: () => ({
        mana: { current: mana, max: manaMax, regenPerSecond: manaRegen },
        sanity: { current: 999, max: 999 },
      }),
    };
    const unitDesigns = {
      subscribe: (listener: (designs: readonly UnitDesignerUnitState[]) => void) => {
        listener(designs);
        return () => undefined;
      },
      getDefaultDesignForType: () => cheapDesign,
      getActiveRosterDesigns: () => designs,
    };

    const module = new UnitAutomationModule({
      bridge,
      necromancer,
      unitDesigns,
      getSkillLevel: () => 1,
      isRunActive: () => true,
    });

    module.initialize();
    module.setAutomationEnabled(cheapDesign.id, true);
    module.setAutomationEnabled(expensiveDesign.id, true);
    module.setAutomationWeight(cheapDesign.id, 1);
    module.setAutomationWeight(expensiveDesign.id, 3);

    const schedule: Array<{ expectedAttempts: number; expectedId?: UnitDesignId }> = [
      { expectedAttempts: 1, expectedId: cheapDesign.id },
      { expectedAttempts: 1 },
      { expectedAttempts: 1 },
      { expectedAttempts: 2, expectedId: expensiveDesign.id },
    ];

    schedule.forEach((step, index) => {
      mana = Math.min(manaMax, mana + manaRegen);
      module.tick(100);
      assert.strictEqual(
        attempts.length,
        step.expectedAttempts,
        `tick ${index} should result in ${step.expectedAttempts} spawn attempts`
      );
      if (step.expectedId) {
        assert.strictEqual(
          attempts[attempts.length - 1],
          step.expectedId,
          `tick ${index} should spawn ${step.expectedId}`
        );
      }
    });
  });

  test("automation falls back when a design is permanently unaffordable", () => {
    const bridge = new DataBridge();
    const attempts: UnitDesignId[] = [];
    const unitType = PLAYER_UNIT_TYPES[0];
    assert(unitType, "expected at least one unit type for automation tests");
    const makeCost = (manaCost: number) => {
      const cost = createEmptyResourceAmount();
      cost.mana = manaCost;
      return cost;
    };
    const cheapDesign: UnitDesignerUnitState = {
      id: "fallback-cheap",
      type: unitType,
      name: "Cheap",
      modules: [],
      moduleDetails: [],
      cost: makeCost(10),
      blueprint: {
        type: unitType,
        name: "Cheap",
        base: { maxHp: 1, attackDamage: 1 },
        effective: { maxHp: 1, attackDamage: 1 },
        multipliers: { maxHp: 1, attackDamage: 1 },
        critChance: { base: 0, bonus: 0, effective: 0 },
        critMultiplier: { base: 2, multiplier: 0, effective: 2 },
        armor: 0,
        hpRegenPerSecond: 0,
        hpRegenPercentage: 0,
        armorPenetration: 0,
        baseAttackInterval: 1,
        baseAttackDistance: 100,
        moveSpeed: 1,
        moveAcceleration: 1,
        mass: 1,
        physicalSize: 1,
      },
      runtime: {
        rewardMultiplier: 1,
        damageTransferPercent: 0,
        damageTransferRadius: 0,
        attackStackBonusPerHit: 0,
        attackStackBonusCap: 0,
      },
      targetingMode: "nearest",
    };
    const expensiveDesign: UnitDesignerUnitState = {
      id: "fallback-expensive",
      type: unitType,
      name: "Expensive",
      modules: [],
      moduleDetails: [],
      cost: makeCost(30),
      blueprint: {
        type: unitType,
        name: "Expensive",
        base: { maxHp: 1, attackDamage: 1 },
        effective: { maxHp: 1, attackDamage: 1 },
        multipliers: { maxHp: 1, attackDamage: 1 },
        critChance: { base: 0, bonus: 0, effective: 0 },
        critMultiplier: { base: 2, multiplier: 0, effective: 2 },
        armor: 0,
        hpRegenPerSecond: 0,
        hpRegenPercentage: 0,
        armorPenetration: 0,
        baseAttackInterval: 1,
        baseAttackDistance: 100,
        moveSpeed: 1,
        moveAcceleration: 1,
        mass: 1,
        physicalSize: 1,
      },
      runtime: {
        rewardMultiplier: 1,
        damageTransferPercent: 0,
        damageTransferRadius: 0,
        attackStackBonusPerHit: 0,
        attackStackBonusCap: 0,
      },
      targetingMode: "nearest",
    };
    const designs: UnitDesignerUnitState[] = [cheapDesign, expensiveDesign];
    const manaCosts = new Map<UnitDesignId, number>([
      [cheapDesign.id, 10],
      [expensiveDesign.id, 30],
    ]);
    let mana = 0;
    const manaMax = 20;
    const manaRegen = 5;
    const necromancer = {
      trySpawnDesign: (id: UnitDesignId) => {
        const cost = manaCosts.get(id) ?? 0;
        if (mana < cost) {
          return false;
        }
        mana -= cost;
        attempts.push(id);
        return true;
      },
      getResources: () => ({
        mana: { current: mana, max: manaMax, regenPerSecond: manaRegen },
        sanity: { current: 999, max: 999 },
      }),
    };
    const unitDesigns = {
      subscribe: (listener: (designs: readonly UnitDesignerUnitState[]) => void) => {
        listener(designs);
        return () => undefined;
      },
      getDefaultDesignForType: () => cheapDesign,
      getActiveRosterDesigns: () => designs,
    };

    const module = new UnitAutomationModule({
      bridge,
      necromancer,
      unitDesigns,
      getSkillLevel: () => 1,
      isRunActive: () => true,
    });

    module.initialize();
    module.setAutomationEnabled(cheapDesign.id, true);
    module.setAutomationEnabled(expensiveDesign.id, true);
    module.setAutomationWeight(cheapDesign.id, 1);
    module.setAutomationWeight(expensiveDesign.id, 3);

    attempts.length = 0;

    for (let tick = 0; tick < 120; tick += 1) {
      mana = Math.min(manaMax, mana + 5);
      module.tick(100);
    }

    const expensiveCount = attempts.filter((id) => id === expensiveDesign.id).length;
    const cheapCount = attempts.filter((id) => id === cheapDesign.id).length;

    assert.strictEqual(expensiveCount, 0, "expensive design should never spawn when unaffordable");
    assert(cheapCount > 0, "cheaper design should still spawn when available");
  });

  test("selectNextAutomationTarget balances according to weights", () => {
    const baseCandidates: Array<Omit<AutomationSelectionCandidate, "spawned">> = [
      { designId: "light", weight: 1, order: 0 },
      { designId: "heavy", weight: 3, order: 1 },
    ];

    const spawnCounts = new Map<UnitDesignId, number>();
    const totalIterations = 12;
    for (let index = 0; index < totalIterations; index += 1) {
      const candidates: AutomationSelectionCandidate[] = baseCandidates.map((entry) => ({
        ...entry,
        spawned: spawnCounts.get(entry.designId) ?? 0,
      }));
      const next = selectNextAutomationTarget(candidates);
      assert.notStrictEqual(next, null);
      const current = spawnCounts.get(next!);
      spawnCounts.set(next!, (current ?? 0) + 1);
    }

    const totalWeight = baseCandidates.reduce((sum, entry) => sum + entry.weight, 0);
    baseCandidates.forEach((candidate) => {
      const spawned = spawnCounts.get(candidate.designId) ?? 0;
      const expected = (totalIterations * candidate.weight) / totalWeight;
      const deviation = Math.abs(spawned - expected);
      assert(
        deviation <= 1,
        `expected spawn count for ${candidate.designId} to be close to ${expected}, got ${spawned}`
      );
    });
  });

  test("selectNextAutomationTarget respects skipped candidates", () => {
    const candidates: AutomationSelectionCandidate[] = [
      { designId: "alpha", weight: 2, spawned: 1, order: 0 },
      { designId: "beta", weight: 1, spawned: 0, order: 1 },
    ];

    const skipped = new Set<UnitDesignId>(["beta"]);
    const next = selectNextAutomationTarget(candidates, skipped);
    assert.strictEqual(next, "alpha");
  });

  test("selectNextAutomationTarget falls back when weights are non-positive", () => {
    const candidates: AutomationSelectionCandidate[] = [
      { designId: "alpha", weight: 0, spawned: 0, order: 0 },
      { designId: "beta", weight: -2, spawned: 0, order: 1 },
    ];

    const next = selectNextAutomationTarget(candidates);
    assert.strictEqual(next, "alpha");
  });
});
