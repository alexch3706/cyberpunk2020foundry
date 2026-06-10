import assert from "node:assert/strict";
import { DEFERRED_MECHANICS, getDeferredMechanic, getDeferredByStatus } from "../../module/combat/deferred-mechanics.js";

/**
 * Fixture suite for the deferred mechanics registry.
 */
export function runDeferredMechanicsTests() {
  const results = [];

  function test(name, fn) {
    try {
      fn();
      results.push({ name: `deferred-mechanics: ${name}`, passed: true });
    } catch (err) {
      console.error(`FAIL: deferred-mechanics: ${name}`);
      console.error(err);
      results.push({ name: `deferred-mechanics: ${name}`, passed: false, error: err });
    }
  }

  // ── Registry structure ──
  test("DEFERRED_MECHANICS is a non-empty frozen array", () => {
    assert.ok(Array.isArray(DEFERRED_MECHANICS));
    assert.ok(DEFERRED_MECHANICS.length > 0);
    assert.ok(Object.isFrozen(DEFERRED_MECHANICS));
  });

  test("every entry has required fields: id, label, status, reason", () => {
    for (const entry of DEFERRED_MECHANICS) {
      assert.ok(typeof entry.id === "string" && entry.id.length > 0, `Missing id in entry`);
      assert.ok(typeof entry.label === "string" && entry.label.length > 0, `Missing label in ${entry.id}`);
      assert.ok(typeof entry.status === "string", `Missing status in ${entry.id}`);
      assert.ok(typeof entry.reason === "string" && entry.reason.length > 0, `Missing reason in ${entry.id}`);
    }
  });

  test("all status values are valid", () => {
    const validStatuses = ["wired", "deferred", "manual", "partial", "removed"];
    for (const entry of DEFERRED_MECHANICS) {
      assert.ok(validStatuses.includes(entry.status), `Invalid status "${entry.status}" in ${entry.id}`);
    }
  });

  test("no duplicate ids", () => {
    const ids = DEFERRED_MECHANICS.map(e => e.id);
    const uniqueIds = new Set(ids);
    assert.equal(ids.length, uniqueIds.size, `Duplicate ids found: ${ids.length} entries, ${uniqueIds.size} unique`);
  });

  test("baseline entry count is correct", () => {
    assert.equal(DEFERRED_MECHANICS.length, 16, "Registry baseline count changed — update this test if entries were intentionally added/removed.");
  });

  // ── Lookup helpers ──
  test("getDeferredMechanic finds by id", () => {
    const entry = getDeferredMechanic("exotic-attack-types");
    assert.ok(entry !== null);
    assert.equal(entry.id, "exotic-attack-types");
    assert.equal(entry.status, "manual");
  });

  test("getDeferredMechanic returns null for unknown id", () => {
    assert.equal(getDeferredMechanic("nonexistent-id"), null);
  });

  test("getDeferredByStatus returns correct entries", () => {
    const manualEntries = getDeferredByStatus("manual");
    assert.ok(manualEntries.length > 0);
    assert.ok(manualEntries.every(e => e.status === "manual"));
  });

  test("getDeferredByStatus returns wired entries when implemented mechanics are marked wired", () => {
    const wiredEntries = getDeferredByStatus("wired");
    assert.ok(wiredEntries.length >= 1);
    assert.ok(wiredEntries.every(e => e.status === "wired"));
  });

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  console.log(`\nDeferred mechanics: ${passed} passed, ${failed} failed\n`);

  return results;
}
