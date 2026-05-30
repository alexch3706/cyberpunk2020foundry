/**
 * Humanity Persistence Fixture — Pure-data contract test for cyberware humanity cost resolution.
 *
 * Tests the resolveHumanityCost and deriveCurrentEmp functions which simulate the logic
 * used in item-sheet.js for cyberware humanity rolls.
 *
 * Design: No Foundry imports. Pure functions that verify the contract expected by
 * the Foundry update() API. Integration is verified manually in Story 6-7.
 *
 * CP2020 p.25: Humanity Cost and EMP derivation
 */

import assert from "node:assert/strict";

/**
 * Resolve a humanity cost expression into a numeric loss value.
 * Supports: fixed number string ("1"), dice expression ("1d6"), complex math ("1d6/2"), or undefined.
 * @param {string|number|undefined} cost
 * @param {(formula: string) => number} roller — deterministic roll function
 * @returns {number|undefined} resolved humanity loss, or undefined if cost is empty
 */
export function resolveHumanityCost(cost, roller) {
  if (cost === undefined || cost === null || cost === "") return undefined;
  const costStr = String(cost).trim();
  if (costStr.toLowerCase() === "n/a" || costStr.toLowerCase() === "special") return undefined;

  let expr = costStr.toLowerCase();

  // Replace dice expressions (e.g., 1d6, 2d6) with evaluated rolls
  expr = expr.replace(/(\d+)d(\d+)/g, (match, count, faces) => {
    if (!roller) return 0;
    let total = 0;
    for (let i = 0; i < parseInt(count, 10); i++) {
      total += roller(`1d${faces}`);
    }
    return total;
  });

  try {
    // Evaluate simple math string securely
    if (!/^[0-9+\-*/.\s()]+$/.test(expr)) return undefined;
    const numValue = new Function(`return ${expr}`)();
    if (Number.isNaN(numValue)) return undefined;
    return Math.max(0, Math.round(numValue));
  } catch (e) {
    return undefined;
  }
}

/**
 * Derive current EMP after humanity loss.
 * @param {number} baseEmp — base EMP stat (e.g. 10)
 * @param {number} humanityLoss — accumulated humanity loss
 * @returns {number} current EMP value (floored at 0)
 */
export function deriveCurrentEmp(baseEmp, humanityLoss) {
  if (typeof baseEmp !== "number") return 0;
  // CP2020 Rule: -1 EMP per full 10 points of Humanity Loss
  return Math.max(0, baseEmp - Math.floor((humanityLoss || 0) / 10));
}

/**
 * Run all humanity persistence fixture tests.
 * @returns {{ name: string, passed: boolean }[]}
 */
export function runHumanityPersistenceTests() {
  const results = [];

  function test(name, fn) {
    try {
      fn();
      results.push({ name: `humanity: ${name}`, passed: true });
    } catch (err) {
      console.error(`FAIL: humanity: ${name}`);
      console.error(err);
      results.push({ name: `humanity: ${name}`, passed: false, error: err });
    }
  }

  // --- Deterministic roller helpers ---
  const identityRoller = () => 0; // Not strictly needed for fixed numbers
  const d6Roller4 = (f) => f === "1d6" ? 4 : 0;

  // ── Test cases ──

  // Fixed number cost
  test("Fixed number cost", () => {
    assert.equal(resolveHumanityCost("1", identityRoller), 1);
  });

  // Dice cost resolves correctly
  test("Dice cost resolves correctly", () => {
    assert.equal(resolveHumanityCost("1d6", d6Roller4), 4);
  });

  // 2d6 cost
  test("2d6 cost", () => {
    // With a two-pass roller that returns pre-scripted values
    let callCount = 0;
    const sequentialRoller = (f) => {
      callCount++;
      return callCount === 1 ? 3 : 5;
    };
    assert.equal(resolveHumanityCost("2d6", sequentialRoller), 8);
  });

  // Fractional dice (Skinweave pattern) — roller returns 5 on 1d6, 5/2=2.5 rounds to 3
  test("Fractional dice", () => {
    const roller5 = (f) => f === "1d6" ? 5 : 0;
    assert.equal(resolveHumanityCost("1d6/2", roller5), 3);
  });

  // Dice with modifier
  test("Dice with modifier", () => {
    assert.equal(resolveHumanityCost("1d6+1", d6Roller4), 5);
  });

  // Text cost (N/A)
  test("Text cost N/A", () => {
    assert.equal(resolveHumanityCost("N/A", identityRoller), undefined);
  });

  // Undefined cost
  test("Undefined cost", () => {
    assert.equal(resolveHumanityCost(undefined, identityRoller), undefined);
  });

  // Empty string cost
  test("Empty string cost", () => {
    assert.equal(resolveHumanityCost("", identityRoller), undefined);
  });

  // Zero cost rounds
  test("Zero cost rounds", () => {
    assert.equal(resolveHumanityCost("0", identityRoller), 0);
  });

  // Negative cost clamps to 0
  test("Negative cost clamps to 0", () => {
    assert.equal(resolveHumanityCost("-1", identityRoller), 0);
  });

  // Null cost
  test("Null cost", () => {
    assert.equal(resolveHumanityCost(null, identityRoller), undefined);
  });

  // "special" text
  test("Special text cost", () => {
    assert.equal(resolveHumanityCost("special", identityRoller), undefined);
  });

  // ── EMP derivation tests ──

  test("EMP derivation — no loss (less than 10)", () => {
    assert.equal(deriveCurrentEmp(10, 9), 10);
  });

  test("EMP derivation — normal loss", () => {
    assert.equal(deriveCurrentEmp(10, 12), 9);
  });

  test("EMP derivation — total loss", () => {
    assert.equal(deriveCurrentEmp(10, 100), 0);
  });

  test("EMP derivation — overflow loss (floor at 0)", () => {
    assert.equal(deriveCurrentEmp(10, 150), 0);
  });

  test("EMP derivation — zero loss", () => {
    assert.equal(deriveCurrentEmp(10, 0), 10);
  });

  test("EMP derivation — partial loss", () => {
    assert.equal(deriveCurrentEmp(8, 24), 6);
  });

  test("EMP derivation — loss undefined", () => {
    assert.equal(deriveCurrentEmp(10, undefined), 10);
  });

  // ── Summary ──

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  console.log(`\nHumanity persistence: ${passed} passed, ${failed} failed\n`);

  return results;
}

// Self-run when executed directly
if (process.argv[1] === import.meta.url || process.argv[1]?.endsWith("humanity-persistence.test.js")) {
  const results = runHumanityPersistenceTests();
  const failed = results.filter(r => !r.passed).length;
  if (failed > 0) process.exit(1);
}