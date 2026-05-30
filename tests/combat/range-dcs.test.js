/**
 * Range DC Table Fixture
 *
 * Validates all five Range DC values from CP2020 p.99 against the shared lookup module.
 * Runs outside Foundry — module/lookups.js has no Foundry-global import dependency.
 */

import assert from "node:assert/strict";
import { rangeDCs, ranges } from "../../module/lookups.js";

/**
 * Run all Range DC table fixture tests.
 * @returns {{ name: string, passed: boolean }[]}
 */
export function runRangeDcTests() {
  const results = [];

  function test(name, fn) {
    try {
      fn();
      results.push({ name: `range-dc: ${name}`, passed: true });
    } catch (err) {
      console.error(`FAIL: range-dc: ${name}`);
      console.error(err);
      results.push({ name: `range-dc: ${name}`, passed: false, error: err });
    }
  }

  // PointBlank DC
  test("PointBlank DC is 10", () => {
    assert.equal(rangeDCs[ranges.pointBlank], 10);
  });

  // Close DC
  test("Close DC is 15", () => {
    assert.equal(rangeDCs[ranges.close], 15);
  });

  // Medium DC
  test("Medium DC is 20", () => {
    assert.equal(rangeDCs[ranges.medium], 20);
  });

  // Long DC
  test("Long DC is 25", () => {
    assert.equal(rangeDCs[ranges.long], 25);
  });

  // Extreme DC
  test("Extreme DC is 30", () => {
    assert.equal(rangeDCs[ranges.extreme], 30);
  });

  // All 5 range keys present
  test("All 5 range keys present", () => {
    assert.equal(Object.keys(rangeDCs).length, 5);
  });

  // All values are numbers
  test("All DC values are numbers", () => {
    for (const key of Object.keys(rangeDCs)) {
      assert.equal(typeof rangeDCs[key], "number", `DC for ${key} must be a number`);
    }
  });

  // No negative DCs
  test("No negative DC values", () => {
    for (const key of Object.keys(rangeDCs)) {
      assert.ok(rangeDCs[key] >= 10, `DC for ${key} must be >= 10`);
    }
  });

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  console.log(`\nRange DCs: ${passed} passed, ${failed} failed\n`);

  return results;
}

// Self-run when executed directly
if (process.argv[1] === import.meta.url || process.argv[1]?.endsWith("range-dcs.test.js")) {
  const results = runRangeDcTests();
  const failed = results.filter(r => !r.passed).length;
  if (failed > 0) process.exit(1);
}