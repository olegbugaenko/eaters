import { strict as assert } from "assert";

import { describe, test } from "./testRunner";
import { formatNumber } from "../src/ui/shared/format/number";

describe("formatNumber", () => {
  test("formats compact thousands", () => {
    assert.equal(formatNumber(6721), "6.72K");
    assert.equal(formatNumber(10920), "10.9K");
    assert.equal(formatNumber(999982), "1M");
  });

  test("rounds compact thousands with fraction digits", () => {
    assert.equal(
      formatNumber(2560, { minimumFractionDigits: 1, maximumFractionDigits: 2 }),
      "2.56K",
    );
    assert.equal(
      formatNumber(11794, { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
      "11.8K",
    );
  });

  test("formats compact millions", () => {
    assert.equal(formatNumber(2_986_099), "2.99M");
  });

  test("respects compact option override", () => {
    assert.equal(formatNumber(6721, { compact: false }), "6721");
  });
});
