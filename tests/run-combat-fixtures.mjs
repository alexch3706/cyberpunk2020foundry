import { runCombatFixtures } from "./combat/combat-fixtures.test.js";

const results = await runCombatFixtures();

for(const result of results) {
  console.log(`ok ${result.name}`);
}

console.log(`${results.length} combat fixture(s) passed`);
