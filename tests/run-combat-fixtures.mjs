import { runCombatFixtures } from "./combat/combat-fixtures.test.js";
import { runCombatCommitTests } from "./combat/combat-commit.test.js";

const results = [
  ...await runCombatFixtures(),
  await runCombatCommitTests()
];

for(const result of results) {
  console.log(`ok ${result.name}`);
}

console.log(`${results.length} combat fixture(s) passed`);
