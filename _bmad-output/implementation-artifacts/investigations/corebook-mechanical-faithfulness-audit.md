# Cyberpunk2020VTT Corebook Mechanical Faithfulness Audit

Date: 2026-05-24
Case file: `_bmad-output/implementation-artifacts/investigations/corebook-mechanical-faithfulness-investigation.md`
Rules source: `docs/Cyberpunk 2020 - Core Rules.pdf`, navigated through `docs/cyberpunk-2020-core-rules-extracted.md`

## Executive Conclusion

Cyberpunk2020VTT is mechanically partial, not mechanically faithful, to Cyberpunk 2020 core combat rules. The current implementation has useful foundations: actor/item data models, stat totals, range DCs, basic attack rolls, hit location rolls, wound-state derived penalties, ammo decrement paths, initiative formula, cyberware humanity totals, and pack-backed items. However, the rules that determine actual combat correctness are fragmented or absent: damage is rolled but not resolved against armor/BTM/wound consequences, armor layering is additive instead of proportional, AP and staged armor behavior are not applied, suppressive fire is exposed but not implemented, and melee/martial arts are mostly chat-roll scaffolds rather than complete opposed-action mechanics.

The main blocker is architectural, not just missing formulas. Combat currently lives inside `CyberpunkItem` chat-roll methods, while actor damage state is edited manually from the sheet. To become faithful to the corebook, the project needs a separate mechanical resolution layer for attack result, hit locations, armor, BTM, wounds, stun/death saves, ammo, and follow-up effects. Without that layer, fixes will remain scattered through UI, chat cards, and item methods.

Confidence: High for the static findings below. Live Foundry verification was not run, and the extracted corebook text has OCR noise; page references should be verified against the PDF before final legal/rules wording is copied into user-facing docs.

## Priority Scale

- P0: Blocks core mechanical correctness.
- P1: Produces incorrect or incomplete rules behavior in common play.
- P2: Architecture or data risk likely to cause drift, crashes, or maintenance failure.

## Findings

### P0 - Damage Resolution Is Not Implemented as a Rules Pipeline

Grade: Confirmed.

Corebook evidence: damage must be located, armor SP subtracted, BTM applied, wound boxes advanced, wound effects applied, and stun/death consequences checked. The extracted corebook covers armor SP subtraction on page 105 (`docs/cyberpunk-2020-core-rules-extracted.md:9294`-`9306`), BTM reduction and minimum damage behavior on page 107 (`docs/cyberpunk-2020-core-rules-extracted.md:9606`-`9636`), wound states and effects on page 107 (`docs/cyberpunk-2020-core-rules-extracted.md:9637`-`9666`), limb loss/head-hit cases on page 107 (`docs/cyberpunk-2020-core-rules-extracted.md:9667`-`9676`), stun saves on page 108 (`docs/cyberpunk-2020-core-rules-extracted.md:9765`-`9805`), and death saves on page 108 (`docs/cyberpunk-2020-core-rules-extracted.md:9806`-`9865`).

Code evidence: weapon attacks roll attack, damage, and location into chat cards but do not update target actor damage or resolve armor/BTM. Semi-auto builds a `Multiroll` with attack/damage/location and only decrements ammo (`module/item/item.js:361`-`376`). Full auto and three-round burst aggregate per-location damage rolls but only render chat cards (`module/item/item.js:273`-`318`, `module/item/item.js:320`-`358`). Actor damage is a single manual sheet value changed by clicking wound boxes (`module/actor/actor-sheet.js:201`-`205`). The actor does compute wound-state stat penalties once `system.damage` changes (`module/actor/actor.js:117`-`134`) and provides stun/death threshold rolls (`module/actor/actor.js:268`-`280`), but those are not connected to incoming attacks.

Impact: Even when the hit roll and damage dice are correct, the system cannot determine RAW outcome. It cannot automatically answer whether the target took zero damage, one point through BTM, a limb-loss death save, head double damage, stun failure, or recurring death-save obligation.

Fix direction: Introduce a pure-ish `DamageResolution` or `CombatResolver` service before expanding UI. It should accept attacker, target actor, weapon/action data, attack result, damage rolls, hit locations, ammo mode, and options; return actor updates plus chat payloads. Then item methods become orchestration, not rules engines.

### P0 - Armor Layering and AP Are Mechanically Wrong or Missing

Grade: Confirmed.

Corebook evidence: armor SP subtracts from damage on page 105 (`docs/cyberpunk-2020-core-rules-extracted.md:9294`-`9306`). Armor encumbrance affects REF, with max three layers and hard/soft restrictions on page 105 (`docs/cyberpunk-2020-core-rules-extracted.md:9363`-`9387`). Layered armor uses proportional armor, not straight addition, on page 105 (`docs/cyberpunk-2020-core-rules-extracted.md:9388`-`9404`) with a table on page 106 (`docs/cyberpunk-2020-core-rules-extracted.md:9518`-`9533`). AP halves armor SP and then halves remaining damage on page 106 (`docs/cyberpunk-2020-core-rules-extracted.md:9534`-`9561`). Staged penetration is described on page 106 (`docs/cyberpunk-2020-core-rules-extracted.md:9569`-`9576`).

Code evidence: equipped armor simply subtracts each armor's `encumbrance` from REF (`module/actor/actor.js:84`-`101`) and adds every covered armor SP into the actor hit location (`module/actor/actor.js:92`-`99`). The data model has armor `coverage.*.stoppingPower` and `ablation` (`template.json:811`-`839`) and weapon `ap` (`template.json:788`-`803`), but no code path applies proportional armor, hard/soft limits, AP, SP ablation, or staged penetration. Armor item preparation also mutates owned armor directly and has a deletion bug: `delete system.coverage.armorArea` deletes a literal property rather than the dynamic area (`module/item/item.js:35`-`80`, especially `module/item/item.js:65`).

Impact: Layered armor can become too strong, AP weapons do not behave as AP, and `ablation` is dead state. This blocks any faithful combat resolution and will also make pack data validation misleading because the data fields imply mechanics that do not run.

Fix direction: Treat armor as ordered layers per hit location and calculate effective SP at resolution time. Store armor material category or explicit layer metadata if the project wants to enforce hard/soft limits. Do not pre-sum layered SP in `prepareData` except as display-only derived state.

### P0 - Suppressive Fire Is Offered but Has No Resolver

Grade: Confirmed.

Corebook evidence: automatic weapons have three distinct modes: three-round burst, full auto, and suppressive fire on page 110 (`docs/cyberpunk-2020-core-rules-extracted.md:10044`-`10069`). Suppressive fire requires a fire zone, target Athletics + REF + 1d10 save, and failed saves take 1d6 random rounds; save number is rounds divided by fire-zone width on pages 110-111 (`docs/cyberpunk-2020-core-rules-extracted.md:10111`-`10131`, `docs/cyberpunk-2020-core-rules-extracted.md:10145`-`10150`).

Code evidence: automatic weapons expose `Suppressive` as an available fire mode (`module/lookups.js:97`-`103`, `module/item/item.js:231`-`240`). `__weaponRoll` dispatches full auto, three-round burst, and semi-auto only; there is no suppressive branch (`module/item/item.js:217`-`228`). Comments describe suppressive fire as future work (`module/item/item.js:185`-`189`).

Impact: A core automatic-weapon mode is selectable but nonfunctional. Depending on UI behavior, selecting it may do nothing silently.

Fix direction: Either hide suppressive fire until implemented or add a resolver with fire-zone width, rounds fired, target save rolls, random hit counts, locations, ammo update, and chat output.

### P0 - Melee and Martial Arts Are Incomplete Opposed Mechanics

Grade: Confirmed.

Corebook evidence: melee is opposed attacker REF + skill + 1d10 vs defender REF + applicable skill + 1d10 on page 115 (`docs/cyberpunk-2020-core-rules-extracted.md:10645`-`10662`). Martial/brawling actions include strike, kick, block/parry, dodge, disarm, throw, hold, escape, choke, sweep/trip, and grapple on pages 115-116 (`docs/cyberpunk-2020-core-rules-extracted.md:10663`-`10690`). Martial arts key attacks grant style bonuses and martial arts skill adds damage on page 116 (`docs/cyberpunk-2020-core-rules-extracted.md:10691`-`10768`). Dodge/parry have declared-turn consequences on page 116 (`docs/cyberpunk-2020-core-rules-extracted.md:10769`-`10795`).

Code evidence: melee rolls only the attacker's roll, damage, and location; it has no defender roll or success comparison (`module/item/item.js:378`-`391`). Martial actions have UI choices (`module/lookups.js:105`-`117`, `module/lookups.js:212`-`245`), but the resolver sets `keyTechniqueBonus = 0` and implements only damage formulas for strike/kick/throw/choke (`module/item/item.js:393`-`437`). It does not implement grapple prerequisites, hold/escape state, dodge/parry effects, disarm, sweep/trip modifiers, declared action penalties, or style-specific key attacks.

Impact: Common melee outcomes are not mechanically resolvable. Martial arts can look supported in UI while omitting the core stateful parts that make styles distinct.

Fix direction: Build melee as an opposed-action resolver with explicit defender response, action state, prerequisites, and per-style key technique data. This likely needs a small data table for martial art styles rather than hard-coding names in actor/item methods.

### P1 - Full Auto Has Correct Shape but Incorrect Edge Behavior

Grade: Confirmed.

Corebook evidence: for multi-target full auto, divide ROF by number of targets and round down before individual rolls (`docs/cyberpunk-2020-core-rules-extracted.md:10091`-`10096`). Full auto range modifiers are per 10 rounds at close or medium/long/extreme (`docs/cyberpunk-2020-core-rules-extracted.md:10097`-`10110`).

Code evidence: the modifier uses all available bullets up to ROF and applies close `+floor(bullets/10)`, point blank `0`, and all other ranges negative (`module/item/item.js:150`-`162`). The target loop computes `system.rof / targetCount` without rounding down (`module/item/item.js:278`-`285`). It updates `shotsLeft` inside the loop using the same local `system.shotsLeft` base (`module/item/item.js:284`-`285`), so multi-target ammo accounting can be wrong. Each target reuses the same attack modifiers even though target-specific range/cover is called out as a known TODO (`module/item/item.js:280`).

Impact: Full auto can generate fractional rounds fired and stale ammo updates. It is directionally based on the corebook but not reliable enough for correctness-sensitive combat.

Fix direction: Resolve shots fired once, integer-floor per target, then compute ammo delta once. Store per-target range and target data, not only target count/name.

### P1 - Criticals, Fumbles, Reliability, and Jams Are Not Implemented

Grade: Confirmed.

Corebook evidence: ranged attacks use REF + weapon skill + 1d10 on page 109 (`docs/cyberpunk-2020-core-rules-extracted.md:9906`-`9919`), critical success on natural 10 adds another d10 (`docs/cyberpunk-2020-core-rules-extracted.md:9946`-`9949`), and fumbles on natural 1 use fumble handling (`docs/cyberpunk-2020-core-rules-extracted.md:9950`-`9957`). Automatic weapons have reliability-based jams on page 110 (`docs/cyberpunk-2020-core-rules-extracted.md:10032`-`10043`).

Code evidence: all attack rolls use `makeD10Roll`, which creates `1d10x10` exploding dice (`module/dice.js:1`-`15`) and adds terms in item attack rolls (`module/item/item.js:243`-`266`). Weapon `reliability` exists in the template (`template.json:788`-`809`) and lookup (`module/lookups.js:91`-`95`), but no attack path checks natural 1 fumbles or reliability jams.

Impact: Exploding 10 is close to the critical-success part, but fumbles and automatic jams are absent. This changes combat risk significantly, especially for automatic weapons.

Fix direction: Return structured die metadata from attack rolls or inspect `Roll` terms; attach fumble/jam outcomes before damage resolution.

### P1 - Humanity Loss Mostly Matches the Formula but Persistence Is Broken in One UI Path

Grade: Confirmed.

Corebook evidence: every 10 Humanity Cost points reduces EMP by 1, rounded down, on page 77 (`docs/cyberpunk-2020-core-rules-extracted.md:6464`-`6491`). Humanity Cost is randomly rolled by category on page 79 (`docs/cyberpunk-2020-core-rules-extracted.md:6665`-`6684`), and cyberpsychosis occurs at EMP 0 or less on page 77 (`docs/cyberpunk-2020-core-rules-extracted.md:6521`-`6529`).

Code evidence: actor preparation sums equipped cyberware `humanityLoss`, computes humanity total, and subtracts `Math.floor(humanity.loss/10)` from EMP (`module/actor/actor.js:135`-`149`). Cyberware fields exist (`template.json:841`-`850`). The item sheet roll button computes a numeric or dice humanity loss but directly mutates `cyber.system.humanityLoss` and rerenders instead of persisting through `update` (`module/item/item-sheet.js:115`-`132`).

Impact: The derived EMP formula is aligned with the corebook, but a user can roll humanity loss and see an apparent value that may not persist. Cyberpsychosis threshold is not surfaced as an automated state or warning.

Fix direction: Replace direct mutation with `await cyber.update({"system.humanityLoss": loss})` and consider derived status/warnings when EMP reaches 0 or below.

### P1 - Initiative Formula Is Faithful for Solo Combat Sense, but Party/Fast-Draw Semantics Are Missing

Grade: Deduced.

Corebook evidence: initiative is 1d10 + REF, highest first, on page 101 (`docs/cyberpunk-2020-core-rules-extracted.md:8832`-`8837`). Combat Sense adds to initiative on page 101 (`docs/cyberpunk-2020-core-rules-extracted.md:8873`-`8880`). Party initiative and fast-draw details are also on page 101 (`docs/cyberpunk-2020-core-rules-extracted.md:8838`-`8857`).

Code evidence: Foundry initiative is `1d10x10 + @stats.ref.total + @skills.CombatSense.value` (`system.json:197`). `1d10x10` is the project's exploding d10 term (`module/dice.js:1`). Actor sheet initiative just rolls actor initiative through Foundry (`module/actor/actor.js:252`-`265`). Fast draw exists only as an attack modifier checkbox applying `-3` to hit (`module/item/item.js:134`-`135`, `module/lookups.js:201`-`208`), not as an initiative modifier.

Impact: Solo initiative is broadly right, but group initiative and fast-draw initiative behavior are not modeled. This is less severe than damage/armor because Foundry can still order combatants.

Fix direction: Decide whether party initiative is in scope. If fast draw is in scope, model it at initiative/action declaration time, not only as an attack modifier.

### P2 - Target Actors Are Reduced to Token Names/IDs, Limiting Rules Correctness

Grade: Confirmed.

Code evidence: the actor sheet maps selected targets to objects with only `name` and `id` (`module/actor/actor-sheet.js:232`-`236`). Those target token objects are passed to item roll methods (`module/actor/actor-sheet.js:249`-`254`). `rollLocation` can use target-specific hit locations only if it receives target actor location data (`module/utils.js:41`-`59`), but attack options do not provide a target actor.

Impact: Current attack flows cannot reliably resolve target-specific hit-location layouts, target armor, target BTM, wound updates, or defender skills. This reinforces the need for a target-aware resolver rather than chat-only item rolls.

Fix direction: Pass actual target token/actor references or stable document UUIDs into the resolver, then dereference actors for armor/wounds/defense.

### P2 - Async and Direct-Mutation Patterns Can Corrupt State or Hide Failures

Grade: Confirmed.

Code evidence: actor creation and skill sorting call `this.update(...)` without awaiting (`module/actor/actor.js:13`-`32`, `module/actor/actor.js:155`-`166`). Several item roll methods decrement ammo without awaiting or with stale local system state (`module/item/item.js:357`, `module/item/item.js:375`, `module/item/item.js:284`-`285`). Migration loops call async migration functions without awaiting, and mark success/version before async work completes (`module/migrate.js:18`-`30`, `module/migrate.js:44`-`52`, `module/migrate.js:178`-`191`). Cyberware humanity roll directly mutates system data (`module/item/item-sheet.js:130`-`131`).

Impact: Mechanical correctness depends on persisted state: ammo, skills, humanity, migrated data, and actor defaults. These patterns can create intermittent mismatch between chat output, sheet state, and stored documents.

Fix direction: Audit every Foundry `update`, `updateEmbeddedDocuments`, compendium update, and chat execution path. Await state changes where later mechanics depend on them; use direct mutation only for derived transient data in `prepareData`.

### P2 - Data Packs Mix Corebook and Non-Core Sources Without a Conformance Boundary

Grade: Confirmed.

Code evidence: weapon packs include items whose `source` fields are not only Cyberpunk 2020, including `Solo of Fortune`, `Blackhand's Street Weapons`, `Shadowrun`, external websites, and empty/undefined values in pack rows (for example `packs/pistols.db` entries found by static scan). The manifest exposes many packs directly (`system.json:23`-`177`).

Impact: The project goal is consistency with the CP2020 corebook. Mixed-source pack data can make rules conformance look wrong even if the engine is correct. It also creates a product decision: core-only mode versus extended source mode.

Fix direction: Add source normalization and a corebook-conformance flag per pack item. Audit corebook packs separately from extended material.

## Confirmed Correct or Partially Correct Foundations

- Range DCs match the corebook hit numbers: point blank 10, close 15, medium 20, long 25, extreme 30 (`module/lookups.js:119`-`139`; corebook page 109 at `docs/cyberpunk-2020-core-rules-extracted.md:9914`-`9919`).
- Ranged attack rolls use REF + weapon skill + d10 plus modifiers and accuracy (`module/item/item.js:243`-`266`; corebook page 109 at `docs/cyberpunk-2020-core-rules-extracted.md:9906`-`9919`).
- Aimed location `-4`, ambush `+5`, blinded `-3`, two weapons `-3`, fast draw `-3`, hipfire `-2`, ricochet `-5`, running `-3`, turning `-2`, and aiming up to +3 are represented in attack modifiers (`module/item/item.js:102`-`174`; corebook page 103 at `docs/cyberpunk-2020-core-rules-extracted.md:9029`-`9065` and page 109 at `docs/cyberpunk-2020-core-rules-extracted.md:9933`-`9945`).
- Wound-state stat penalties are directionally correct once `system.damage` is manually set: Serious applies REF -2, Critical halves REF/INT/COOL, Mortal thirds those stats (`module/actor/actor.js:117`-`134`; corebook page 107 at `docs/cyberpunk-2020-core-rules-extracted.md:9649`-`9666`).
- BTM lookup maps body type to reduction values and strength damage bonus mostly follows the table (`module/lookups.js:261`-`300`; corebook page 107 at `docs/cyberpunk-2020-core-rules-extracted.md:9606`-`9628` and page 116 at `docs/cyberpunk-2020-core-rules-extracted.md:10796`-`10814`). Note: Body Type 13-14 should be rechecked because code returns `5` at `module/lookups.js:296`-`298`, while extracted page 116 indicates `+6`.

## Refactor Boundary Recommendation

Do not start with a broad UI rewrite. The minimum necessary refactor is a mechanics-core extraction:

1. `rollAttack`: creates structured attack results with natural die metadata, fumble/jam info, modifiers, range DC, and action cost.
2. `resolveHitLocations`: target-aware random or aimed hit locations.
3. `resolveArmor`: proportional armor, AP, cover, optional staged penetration, and effective SP per hit.
4. `resolveDamage`: damage dice, head/limb special cases, BTM, minimum damage, wound increment.
5. `resolveSaves`: stun/death threshold, immediate save prompts/results, recurring mortal save state if in scope.
6. `commitCombatResult`: one place for actor/item updates and chat rendering.

This keeps Foundry sheets and chat cards thin and testable. It also lets you write fixture tests directly against corebook examples before touching more UI.

## Verification Plan

1. Add test fixtures for the corebook examples and tables: range DCs, armor SP subtraction, AP, BTM minimum damage, wound thresholds, stun/death thresholds, burst hit counts, full-auto multi-target rounding.
2. Add static data audit for corebook-only item packs: required fields, numeric types, source attribution, reliability values, weapon type/skill mapping.
3. Run live Foundry checks after resolver extraction: single shot, AP shot, layered armor, full auto two targets, suppressive fire, melee opposed roll, martial throw/choke/grapple path, cyberware humanity roll persistence.

