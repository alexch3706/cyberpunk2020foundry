import assert from "node:assert/strict";
import { classifyAttackTypeSupport } from "../../module/combat/conformance-helpers.js";

/**
 * Fixture suite for attack type classification.
 * Covers every row in the I/O & Edge-Case Matrix from the story spec.
 */
export function runAttackTypeClassificationTests() {
  const results = [];

  function test(name, fn) {
    try {
      fn();
      results.push({ name: `attack-type-classification: ${name}`, passed: true });
    } catch (err) {
      console.error(`FAIL: attack-type-classification: ${name}`);
      console.error(err);
      results.push({ name: `attack-type-classification: ${name}`, passed: false, error: err });
    }
  }

  // ── Supported ──
  test('classifies "Auto" as supported', () => {
    assert.equal(classifyAttackTypeSupport("Auto"), "supported");
  });

  test('classifies "auto" as supported', () => {
    assert.equal(classifyAttackTypeSupport("auto"), "supported");
  });

  // ── Partial ──
  test('classifies "Autoshotgun" as partial', () => {
    assert.equal(classifyAttackTypeSupport("Autoshotgun"), "partial");
  });

  test('classifies "autoshotgun" as partial', () => {
    assert.equal(classifyAttackTypeSupport("autoshotgun"), "partial");
  });

  // ── Manual: exotic weapons ──
  test('classifies "Laser" as manual', () => {
    assert.equal(classifyAttackTypeSupport("Laser"), "manual");
  });

  test('classifies "Flamethrow" as manual', () => {
    assert.equal(classifyAttackTypeSupport("Flamethrow"), "manual");
  });

  test('classifies "Shotgun" as supported (non-auto)', () => {
    assert.equal(classifyAttackTypeSupport("Shotgun"), "supported");
  });

  test('classifies "Grenade" as manual', () => {
    assert.equal(classifyAttackTypeSupport("Grenade"), "manual");
  });

  test('classifies "Gas" as manual', () => {
    assert.equal(classifyAttackTypeSupport("Gas"), "manual");
  });

  test('classifies "Microwave" as manual', () => {
    assert.equal(classifyAttackTypeSupport("Microwave"), "manual");
  });

  test('classifies "RPG" as manual', () => {
    assert.equal(classifyAttackTypeSupport("RPG"), "manual");
  });

  // ── Edge cases ──
  test('classifies empty string as unknown', () => {
    assert.equal(classifyAttackTypeSupport(""), "unknown");
  });

  test('classifies undefined as unknown', () => {
    assert.equal(classifyAttackTypeSupport(undefined), "unknown");
  });

  test('classifies unknown attack type as unknown', () => {
    assert.equal(classifyAttackTypeSupport("Weird3"), "unknown");
  });

  // ── Case insensitivity and whitespace ──
  test('normalizes mixed-case "LaSeR" to lowercase', () => {
    assert.equal(classifyAttackTypeSupport("LaSeR"), "manual");
  });

  test('trims whitespace " Auto " to "auto"', () => {
    assert.equal(classifyAttackTypeSupport(" Auto "), "supported");
  });

  test('trims whitespace "  laser  " to "laser"', () => {
    assert.equal(classifyAttackTypeSupport("  laser  "), "manual");
  });

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  console.log(`\nAttack type classification: ${passed} passed, ${failed} failed\n`);

  return results;
}