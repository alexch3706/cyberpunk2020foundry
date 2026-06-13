import assert from "node:assert/strict";

import { applyDerivedStatOverrides } from "../../module/actor/derived-stats.js";

export function runDerivedStatOverrideTests() {
  const results = [];

  function test(name, fn) {
    try {
      fn();
      results.push({ name: `derived stat overrides: ${name}`, passed: true });
    } catch (err) {
      console.error(`FAIL: derived stat overrides: ${name}`);
      console.error(err);
      results.push({ name: `derived stat overrides: ${name}`, passed: false, error: err });
    }
  }

  test("manual overrides replace prepared derived stat values", () => {
    const system = {
      stats: {
        bt: {
          modifier: -4,
          carry: 50,
          lift: 200,
          modifierOverride: -6,
          carryOverride: "",
          liftOverride: 250
        },
        ma: {
          run: 15,
          leap: 3,
          runOverride: 18,
          leapOverride: null
        },
        emp: {
          humanityTotalOverride: 42,
          humanity: {
            total: 38,
            base: 50
          }
        }
      }
    };

    applyDerivedStatOverrides(system);

    assert.equal(system.stats.bt.modifier, -6);
    assert.equal(system.stats.bt.carry, 50);
    assert.equal(system.stats.bt.lift, 250);
    assert.equal(system.stats.ma.run, 18);
    assert.equal(system.stats.ma.leap, 3);
    assert.equal(system.stats.emp.humanity.total, 42);
  });

  return results;
}

if (process.argv[1] === import.meta.url || process.argv[1]?.endsWith("derived-stat-overrides.test.js")) {
  const results = runDerivedStatOverrideTests();
  const failed = results.filter(r => !r.passed).length;
  if (failed > 0) process.exit(1);
}
