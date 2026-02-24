import assert from "assert";
import { describe, test } from "./testRunner";
import { getSkillConfig } from "../src/db/skills-db";

const getSkillMultiplier = (
  skillId: "inspiration" | "perseverance",
  bonusId: "all_units_attack_multiplier" | "all_units_hp_multiplier",
  level: number,
  clearedMapLevelsTotal: number,
): number => {
  const config = getSkillConfig(skillId);
  const effect = config.effects[bonusId];
  assert(effect && typeof effect.multiplier === "function", `${skillId} should expose multiplier effect`);
  return effect.multiplier(level, { clearedMapLevelsTotal });
};

describe("skills soft cap", () => {
  test("inspiration uses linear scaling up to 10 cleared levels", () => {
    const level = 3;
    const value = getSkillMultiplier("inspiration", "all_units_attack_multiplier", level, 10);
    assert.strictEqual(value, 1 + 0.01 * level * 10);
  });

  test("inspiration uses soft cap scaling after 10 cleared levels", () => {
    const level = 3;
    const cleared = 50;
    const effectiveCleared = 10 + Math.pow(cleared - 10, 0.4);
    const value = getSkillMultiplier("inspiration", "all_units_attack_multiplier", level, cleared);
    assert.strictEqual(value, 1 + 0.01 * level * effectiveCleared);
  });

  test("perseverance uses the same soft cap scaling", () => {
    const level = 4;
    const cleared = 90;
    const effectiveCleared = 10 + Math.pow(cleared - 10, 0.4);
    const value = getSkillMultiplier("perseverance", "all_units_hp_multiplier", level, cleared);
    assert.strictEqual(value, 1 + 0.01 * level * effectiveCleared);
  });
});
