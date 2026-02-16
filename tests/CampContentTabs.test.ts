import assert from "assert";
import { describe, test } from "./testRunner";
import {
  buildCampTabHasNew,
  normalizeCampTab,
  sanitizeCampTab,
} from "../src/ui/screens/VoidCamp/components/CampContent/CampContent.helpers";

describe("Camp content tabs", () => {
  test("normalizes legacy buildings tab to stronghold", () => {
    assert.strictEqual(normalizeCampTab("buildings"), "stronghold");
    assert.strictEqual(normalizeCampTab("maps"), "maps");
  });

  test("sanitizes locked tabs to fallback", () => {
    const unlockState = {
      moduleWorkshopUnlocked: true,
      buildingsUnlocked: false,
      craftingUnlocked: false,
    };

    assert.strictEqual(sanitizeCampTab("buildings", unlockState, "maps"), "maps");
    assert.strictEqual(sanitizeCampTab("stronghold", unlockState, "skills"), "skills");
    assert.strictEqual(sanitizeCampTab("crafting", unlockState, "maps"), "maps");
  });

  test("maps stronghold new badge from buildings prefix", () => {
    const noNew = buildCampTabHasNew({});
    assert.deepStrictEqual(noNew, {
      maps: false,
      skills: false,
      modules: false,
      stronghold: false,
      crafting: false,
    });

    const withBuildings = buildCampTabHasNew({
      buildings: ["buildings.tower"],
      biolab: ["biolab.organ"],
      maps: ["maps.alpha"],
    });

    assert.strictEqual(withBuildings.stronghold, true);
    assert.strictEqual(withBuildings.modules, true);
    assert.strictEqual(withBuildings.maps, true);
  });
});
