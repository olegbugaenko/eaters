import { strict as assert } from "assert";

import { describe, test } from "./testRunner";
import {
  getResourceAbundanceLabel,
  getResourceAbundanceLevel,
} from "../src/shared/helpers/resource-abundance.helper";

describe("resource abundance helper", () => {
  test("calculates levels with logarithmic scaling", () => {
    assert.equal(getResourceAbundanceLevel(1, 100, 5), 1);
    assert.equal(getResourceAbundanceLevel(5, 100, 5), 2);
    assert.equal(getResourceAbundanceLevel(20, 100, 5), 4);
    assert.equal(getResourceAbundanceLevel(50, 100, 5), 5);
  });

  test("maps levels to labels for UI display", () => {
    assert.equal(getResourceAbundanceLabel(1), "Sparse");
    assert.equal(getResourceAbundanceLabel(2), "Limited");
    assert.equal(getResourceAbundanceLabel(3), "Moderate");
    assert.equal(getResourceAbundanceLabel(4), "Rich");
    assert.equal(getResourceAbundanceLabel(5), "Abundant");
  });

  test("handles empty totals safely", () => {
    assert.equal(getResourceAbundanceLevel(0, 0, 0), 1);
    assert.equal(getResourceAbundanceLevel(10, 0, 2), 1);
  });
});
