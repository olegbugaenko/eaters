import assert from "assert";
import { describe, test } from "./testRunner";
import { DataBridge } from "../src/core/logic/ui/DataBridge";
import { CraftingModule } from "../src/logic/modules/camp/crafting/crafting.module";
import { CRAFTING_STATE_BRIDGE_KEY } from "../src/logic/modules/camp/crafting/crafting.const";
import { ResourcesModule } from "../src/logic/modules/shared/resources/resources.module";
import { UnlockService } from "../src/logic/services/unlock/UnlockService";
import { BonusesModule } from "../src/logic/modules/shared/bonuses/bonuses.module";
import { BonusesValueAdapter } from "../src/logic/modules/shared/bonuses/bonuses.adapter";
import { MapRunState } from "../src/logic/modules/active-map/map/MapRunState";
import { MapRunContextAdapter } from "../src/logic/modules/active-map/map/map-run-context.adapter";
import { UnlockProgressionAdapter } from "../src/logic/services/unlock/unlock-progression.adapter";
import { NewUnlockNotificationService } from "../src/logic/services/new-unlock-notification/NewUnlockNotification";
import type { CraftingBridgeState } from "../src/logic/modules/camp/crafting/crafting.types";

const createCraftingModule = (overdriveMax: number) => {
  const bridge = new DataBridge();
  const unlocks = new UnlockService({
    getMapStats: () => ({}),
    getSkillLevel: () => 1,
  });
  const bonuses = new BonusesModule();
  bonuses.initialize();
  bonuses.registerSource(
    "test",
    {
      crafting_overdrive_max: {
        income: (level) => level,
      },
    },
    "misc"
  );
  bonuses.setSourceLevel("test", overdriveMax);
  const runState = new MapRunState();
  runState.start();
  const resources = new ResourcesModule({
    bridge,
    progression: new UnlockProgressionAdapter(unlocks),
    bonusValues: new BonusesValueAdapter(bonuses),
    runtimeContext: new MapRunContextAdapter(runState),
  });
  resources.initialize();
  const newUnlocks = new NewUnlockNotificationService({ bridge });
  newUnlocks.initialize();
  const crafting = new CraftingModule({
    bridge,
    resources,
    unlocks,
    bonuses,
    newUnlocks,
  });
  crafting.initialize();

  return { bridge, crafting };
};

const createCraftingModuleWithMaterialDiscount = (
  overdriveMax: number,
  materialDiscount: number,
) => {
  const bridge = new DataBridge();
  const unlocks = new UnlockService({
    getMapStats: () => ({}),
    getSkillLevel: () => 1,
  });
  const bonuses = new BonusesModule();
  bonuses.initialize();
  bonuses.registerSource(
    "test",
    {
      crafting_overdrive_max: {
        income: (level) => level,
      },
      crafting_material_discount: {
        multiplier: () => materialDiscount,
      },
    },
    "misc"
  );
  bonuses.setSourceLevel("test", overdriveMax);
  const runState = new MapRunState();
  runState.start();
  const resources = new ResourcesModule({
    bridge,
    progression: new UnlockProgressionAdapter(unlocks),
    bonusValues: new BonusesValueAdapter(bonuses),
    runtimeContext: new MapRunContextAdapter(runState),
  });
  resources.initialize();
  const newUnlocks = new NewUnlockNotificationService({ bridge });
  newUnlocks.initialize();
  const crafting = new CraftingModule({
    bridge,
    resources,
    unlocks,
    bonuses,
    newUnlocks,
  });
  crafting.initialize();

  return { bridge, crafting };
};

const findRecipe = (state: CraftingBridgeState, id: string) => {
  const recipe = state.recipes.find((entry) => entry.id === id);
  assert(recipe, `recipe ${id} should exist`);
  return recipe;
};

describe("CraftingModule overdrive", () => {
  test("multiplies recipe cost by 2^level", () => {
    const { bridge, crafting } = createCraftingModule(3);
    crafting.setRecipeOverdriveLevel("tools", 2);

    const payload = bridge.getValue(CRAFTING_STATE_BRIDGE_KEY) as CraftingBridgeState;
    const recipe = findRecipe(payload, "tools");

    assert.strictEqual(recipe.cost.iron, 200);
    assert.strictEqual(recipe.cost.wood, 40);
  });

  test("reduces recipe duration by 2^level", () => {
    const { bridge, crafting } = createCraftingModule(2);
    crafting.setRecipeOverdriveLevel("paper", 1);

    const payload = bridge.getValue(CRAFTING_STATE_BRIDGE_KEY) as CraftingBridgeState;
    const recipe = findRecipe(payload, "paper");

    assert.strictEqual(recipe.durationMs, 1500);
  });

  test("persists overdrive per recipe", () => {
    const { bridge, crafting } = createCraftingModule(3);
    crafting.setRecipeOverdriveLevel("tools", 2);
    crafting.setRecipeOverdriveLevel("paper", 1);

    const saved = crafting.save();

    const { bridge: nextBridge, crafting: nextCrafting } = createCraftingModule(3);
    nextCrafting.load(saved);

    const payload = nextBridge.getValue(CRAFTING_STATE_BRIDGE_KEY) as CraftingBridgeState;
    const tools = findRecipe(payload, "tools");
    const paper = findRecipe(payload, "paper");

    assert.strictEqual(tools.overdriveLevel, 2);
    assert.strictEqual(paper.overdriveLevel, 1);
  });
});

describe("CraftingModule material discount", () => {
  test("divides recipe ingredient costs by crafting_material_discount", () => {
    const { bridge } = createCraftingModuleWithMaterialDiscount(0, 2);
    const payload = bridge.getValue(CRAFTING_STATE_BRIDGE_KEY) as CraftingBridgeState;
    const recipe = findRecipe(payload, "tools");
    assert.strictEqual(recipe.cost.iron, 25);
    assert.strictEqual(recipe.cost.wood, 5);
  });

  test("applies material discount after overdrive cost scaling", () => {
    const { bridge, crafting } = createCraftingModuleWithMaterialDiscount(3, 2);
    crafting.setRecipeOverdriveLevel("tools", 2);
    const payload = bridge.getValue(CRAFTING_STATE_BRIDGE_KEY) as CraftingBridgeState;
    const recipe = findRecipe(payload, "tools");
    assert.strictEqual(recipe.cost.iron, 100);
    assert.strictEqual(recipe.cost.wood, 20);
  });
});
