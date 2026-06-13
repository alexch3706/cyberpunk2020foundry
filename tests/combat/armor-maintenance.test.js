import assert from "node:assert/strict";

import {
  buildArmorRepairUpdate,
  getCyberwareArmorStatus
} from "../../module/combat/armor-maintenance.js";

export function runArmorMaintenanceTests() {
  const results = [];

  function test(name, fn) {
    try {
      fn();
      results.push({ name: `armor maintenance: ${name}`, passed: true });
    } catch (err) {
      console.error(`FAIL: armor maintenance: ${name}`);
      console.error(err);
      results.push({ name: `armor maintenance: ${name}`, passed: false, error: err });
    }
  }

  test("Skinweave repair restores ablated armor cyberware", () => {
    const skinweave = {
      id: "skinweave",
      name: "Skinweave",
      type: "cyberware",
      system: {
        notes: "Armors whole body to SP 12. Diff 20 to spot",
        ablation: 4
      }
    };

    assert.deepEqual(getCyberwareArmorStatus(skinweave), {
      isArmor: true,
      baseStoppingPower: 12,
      ablation: 4,
      currentStoppingPower: 8,
      repairable: true
    });
    assert.deepEqual(buildArmorRepairUpdate(skinweave), {
      "system.ablation": 0
    });
  });

  return results;
}

if (process.argv[1] === import.meta.url || process.argv[1]?.endsWith("armor-maintenance.test.js")) {
  const results = runArmorMaintenanceTests();
  const failed = results.filter(r => !r.passed).length;
  if (failed > 0) process.exit(1);
}
