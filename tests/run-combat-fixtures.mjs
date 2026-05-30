import { runCombatFixtures } from "./combat/combat-fixtures.test.js";
import { runCombatCommitTests } from "./combat/combat-commit.test.js";
import { runMartialArtsDataTests } from "./combat/martial-arts-data.test.js";
import { runConformanceHelpersTests } from "./combat/conformance-helpers.test.js";
import { runDeferredMechanicsTests } from "./combat/deferred-mechanics.test.js";
import { runAttackTypeClassificationTests } from "./combat/attack-type-classification.test.js";

const results = [
  ...await runCombatFixtures(),
  await runCombatCommitTests(),
  await runMartialArtsDataTests(),
  ...await runConformanceHelpersTests(),
  ...await runDeferredMechanicsTests(),
  ...await runAttackTypeClassificationTests()
];

for(const result of results) {
  if (result.passed !== false) {
    console.log(`ok ${result.name}`);
  } else {
    console.log(`FAIL ${result.name}`);
  }
}

const failed = results.filter(r => r.passed === false).length;
const passed = results.length - failed;
console.log(`\n${results.length} fixture(s): ${passed} passed, ${failed} failed`);

if (failed > 0) process.exit(1);

