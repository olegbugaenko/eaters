import { strict as assert } from "assert";

import { describe, test } from "./testRunner";
import { formatNumber } from "../src/ui/shared/format/number";

describe("formatNumber", () => {
  test("formats compact thousands", () => {
    assert.equal(formatNumber(6721), "6.72K");
    assert.equal(formatNumber(10920), "10.9K");
    assert.equal(formatNumber(999982), "999K");
  });

  test("formats compact millions", () => {
    assert.equal(formatNumber(2_986_099), "2.98M");
  });

  test("respects compact option override", () => {
    assert.equal(formatNumber(6721, { compact: false }), "6721");
  });
});
