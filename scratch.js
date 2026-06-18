import { resolveSavePromptsForTarget } from "./module/combat/save-resolver.js";
const out = resolveSavePromptsForTarget({
  targets: [{
    snapshot: { damage: 0, stats: { bt: { total: 6 } } }
  }],
  target: { snapshot: { damage: 0, stats: { bt: { total: 6 } } } },
  hits: [
    { location: "torso", finalDamage: 5 },
    { location: "torso", finalDamage: 5 },
    { location: "torso", finalDamage: 5 }
  ]
});
console.log(JSON.stringify(out, null, 2));
