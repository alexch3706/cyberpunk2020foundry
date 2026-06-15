import assert from "node:assert/strict";
import { getRangeBracketForDistance, getMaxRangeBracketDistance, ranges } from "../../module/lookups.js";

export function runRangeBracketTests() {
  const results = [];

  function test(name, fn) {
    try {
      fn();
      results.push({ name: `range-bracket: ${name}`, passed: true });
    } catch (err) {
      console.error(`FAIL: range-bracket: ${name}`);
      console.error(err);
      results.push({ name: `range-bracket: ${name}`, passed: false, error: err });
    }
  }

  const weaponRange = 50;

  // Max distances
  test("getMaxRangeBracketDistance PointBlank is 2", () => {
    assert.equal(getMaxRangeBracketDistance(weaponRange, ranges.pointBlank), 2);
  });

  test("getMaxRangeBracketDistance Close is 12.5", () => {
    assert.equal(getMaxRangeBracketDistance(weaponRange, ranges.close), 12.5);
  });

  test("getMaxRangeBracketDistance Medium is 25", () => {
    assert.equal(getMaxRangeBracketDistance(weaponRange, ranges.medium), 25);
  });

  test("getMaxRangeBracketDistance Long is 50", () => {
    assert.equal(getMaxRangeBracketDistance(weaponRange, ranges.long), 50);
  });

  test("getMaxRangeBracketDistance Extreme is 100", () => {
    assert.equal(getMaxRangeBracketDistance(weaponRange, ranges.extreme), 100);
  });

  // Target brackets
  test("getRangeBracketForDistance maps 1m to PointBlank", () => {
    assert.equal(getRangeBracketForDistance(1, weaponRange), ranges.pointBlank);
  });

  test("getRangeBracketForDistance maps 2m to PointBlank", () => {
    assert.equal(getRangeBracketForDistance(2, weaponRange), ranges.pointBlank);
  });

  test("getRangeBracketForDistance maps 5m to Close", () => {
    assert.equal(getRangeBracketForDistance(5, weaponRange), ranges.close);
  });

  test("getRangeBracketForDistance maps 20m to Medium", () => {
    assert.equal(getRangeBracketForDistance(20, weaponRange), ranges.medium);
  });

  test("getRangeBracketForDistance maps 40m to Long", () => {
    assert.equal(getRangeBracketForDistance(40, weaponRange), ranges.long);
  });

  test("getRangeBracketForDistance maps 80m to Extreme", () => {
    assert.equal(getRangeBracketForDistance(80, weaponRange), ranges.extreme);
  });

  test("getRangeBracketForDistance maps 150m to Extreme", () => {
    // Everything beyond Extreme is still Extreme or out of range, let's say Extreme
    assert.equal(getRangeBracketForDistance(150, weaponRange), ranges.extreme);
  });

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  console.log(`\nRange Brackets: ${passed} passed, ${failed} failed\n`);

  return results;
}

if (process.argv[1] === import.meta.url || process.argv[1]?.endsWith("range-bracket.test.js")) {
  const results = runRangeBracketTests();
  const failed = results.filter(r => !r.passed).length;
  if (failed > 0) process.exit(1);
}
