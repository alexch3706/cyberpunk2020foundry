# Deferred Work

This file tracks technical debt and deferred items from code reviews.

## Deferred from: code review of 2-5-render-single-shot-combat-evidence-in-chat.md (2026-05-27)

- **Incomplete Test Coverage for Failure Paths**: The current test coverage does not verify error handling during adapter rendering or ChatMessage creations/updates.
- **Redundant Adapter Parameter Defaults**: `options.adapter || createFoundryCombatAdapter()` is duplicated across functions.
- **Concurrency - Double Click on Confirm**: **Resolved in Story 7.4 (2026-05-31)** via one-shot commit guard in `combat-commit.js`.

## Deferred from: code review of 2-6-add-single-shot-fixtures-and-foundry-manual-checks.md (2026-05-27)

- **Critical Success and Fumble manual verification**: The guide lacks step-by-step instructions for verifying fumbles (weapon jams) and critical success (exploding 10s) on the preview and chat cards.
- **Untargeted Ranged Attack Flow**: Documentation of UI behavior and resolution path when zero targets are selected on the scene.
- **Node.js ES Module Parsing Warning**: Standardizing the package layout to avoid ES module warnings by setting `"type": "module"` in `package.json`.

## Deferred from: code review of 3-3-apply-armor-piercing-and-staged-penetration.md (2026-05-27)

- **Multiple penetrations against the same armor item can collapse to one ablation**: Future multi-hit outcomes should plan cumulative armor ablation instead of repeated absolute `before + 1` updates from one snapshot.
- **Stale preview can overwrite newer armor ablation on confirm**: **Resolved in Story 7.4 (2026-05-31)** via baseline freshness validation before commit.

## Deferred from: code review of 3-5-apply-wound-state-and-special-damage-cases.md (2026-05-27)

- **Stale preview can overwrite newer target damage on confirm**: **Resolved in Story 7.4 (2026-05-31)** via baseline freshness validation before commit.

## Deferred from: code review of 3-6-generate-stun-and-death-save-prompts.md (2026-05-28)

- **Missing checks for deceased status**: Save resolution does not check if the target is already dead (deceased status or failed saves) before generating new Stun or Death save prompts.

## Deferred from: code review of 3-7-add-damage-pipeline-fixtures-and-foundry-checks.md (2026-05-28)

- **Duplication of `woundStateLabel` function**: Duplicate implementations in `module/combat/state-planner.js` and `module/combat/save-resolver.js`.
- **Duplication of `normalizeDamageValue` function**: Duplicate implementations in `module/combat/state-planner.js` and `module/combat/save-resolver.js`.
- **Hardcoded limb keys in `LIMB_LOCATION_KEYS`**: Key limb locations like hands and feet are not recognized as limbs for severing/crushing warnings.
- **Missing check for stabilized status in Mortal target reminders**: Recurring death save reminders are created even if the Mortal target is already stabilized.
- **Death saves generated for guaranteed dead targets**: Death saves are generated for targets above Mortal 6 who should be considered deceased automatically.
- **Inconsistent validation of wound damage**: Discrepancy in `cannotResolveTargetSaves` and `resolveDamageEvidence` validation checks.
- **Death save reminders bound to attacks instead of target turns**: Reminder prompts are triggered on attacks (even 0-damage ones) rather than target turn changes.

## Deferred from: code review of 6-4-close-direct-mutation-and-awaited-update-audit-findings.md (2026-05-30)

- **Unused import `fireModes`** — pre-existing, scaffold for Story 6-8 [actor-sheet.js:1]
- **Duplicate-item concat bug (no repair migration)** — pre-existing bug in worlds that already ran migration [migrate.js:161]
- **Stale ammo count in legacy full-auto chat messages** — pre-existing, legacy path to be removed in Story 6-8 [item.js:430]
- **Sequential compendium migration performance** — documented as DEFERRED-6.4-1 [migrate.js:190]
- **Empty updateData guard in compendium migration inner callback** — pre-existing, now guarded with `isEmpty()` check [migrate.js:197]
- **`item.roll()` called without arguments** — pre-existing Foundry internal lifecycle pattern [item.js:93]

## Deferred from: code review of 4-1-migrate-three-round-burst-to-resolver-outcome.md (2026-05-28)

- **Cyberware armor updatePath in staged penetration**: Edge Case Hunter noted that cyberware layers might not have their `system.ablation` updated correctly because of how `updatePath` is resolved. This is a pre-existing issue related to cyberware ablation logic, not introduced by story 4.1.

## Deferred from: code review of 4-3-resolve-full-auto-across-multiple-targets.md (2026-05-28)

- **Semiauto/Single fire modes multi-targeting**: `canResolveSingleShotRangedContext` only blocks multi-targeting if the fire mode is `"threeroundburst"`. Other modes like `"semiauto"` or `"standard"` (single shot) are not restricted, allowing them to resolve against multiple targets using one roll and one bullet. This is pre-existing legacy behavior.
- **Zero targets consuming ammo**: If a full auto attack is resolved with 0 targets, it goes to the `else` branch: `roundsFired = finalMaxRoundsFired` (which is `Math.min(shotsLeft, rof)`). So it fires ROF rounds, even though there are no targets. This is pre-existing legacy behavior.
- **Mutation of input parameter `action.targetArea`**: The function directly mutates `action.targetArea = action.targetArea || action.options?.targetArea`, modifying the caller-provided object. This is pre-existing legacy behavior.

## Deferred from: code review of 4-4-implement-suppressive-fire-resolver.md (2026-05-28)

- **Multi-target full-auto target-specific modifier evidence is lost**: For multi-target full auto attacks, target-specific modifier evidence and attack roll details are only saved for the first target in the top-level outcome, losing target-specific information for subsequent targets.

## Deferred from: adversarial review of 6-5-fix-cyberware-humanity-roll-persistence.md (2026-05-30)

- **Uncaught `new Roll(evaluate())` on malformed dice strings**: `humanityCost: "3d6+"` (Kiroshi Optics Tricloptics pack data) throws silently in the humanity cost roll handler. No try/catch. Pre-existing.
- **Uncaught `cyber.update()` failure**: Permission denial or network error during `item.update()` shows no user feedback. Pre-existing risk.
- **`humanityCost: "50% HC"` / `"1-2"` silently resolves to 0**: Non-standard cost formats (percentage-style, range notation) parse to NaN → loss = 0 with no user feedback. Pre-existing pack data issue.
- **`humanityCost: ""` silently resolves to 0 via JS quirk**: Empty string → `Number("")` = 0. Functionally fine but masks bad data. Pre-existing.
- **`humanityCost: "-1d6/2"` (negative dice)**: Returns negative total, reducing total humanity loss. May be intentional (RealSkinn Covering reduces visible cyberware impact) or a bug. Pre-existing data semantics.

## Deferred from: code review of 5-6-enforce-grapple-family-prerequisites-and-pending-state.md (2026-05-29)

- **Technique bonus applied to untrained martial arts attackers**: The key technique bonus from a martial art is applied to the roll even if the attacker has the martial art skill at level 0 (e.g. they fall back to Brawling or lack training in Aikido but still get the Aikido technique bonus). This is pre-existing behavior from Story 5.4.
- **Incomplete test assertions for blocked prerequisite outcomes**: The test fixtures for unconfirmed prerequisites (such as `martial-throw-requires-grapple-without-state`) only specify `"required"` and `"reason"` in the expected `manualResolution` object. They fail to assert the added properties (`message`, `action`, `requires`, `missing`, `combatState`) that are produced by the code.

## Deferred from: code review of 6-6-complete-mvp-regression-fixture-suite.md (2026-05-30)

- **Naive JSON Overwriting**: `annotate-fixtures.mjs` parses and rewrites the entire JSON file using `JSON.stringify(..., null, 2)` every time it touches a file. If the original fixture had different formatting, this causes unnecessary and annoying whitespace diff churn. [tests/combat/annotate-fixtures.mjs]
- **Reinventing the Test Runner Wheel**: Every new `.test.js` file duplicates the exact same ugly boilerplate to self-run (`if (process.argv[1]?.endsWith(...))`) and manually tallies passed/failed arrays. This is a pre-existing architectural pattern. [all .test.js files]
- **Tech Debt (Tests)**: JSON Fixtures have massive monolithic bloat, brittle state coupling (hardcoded UUIDs), redundant value hardcoding, and view-layer coupling (chat status). They test implementation details over behavior.

## Deferred from: code review of 6-8-remove-or-fence-legacy-combat-paths.md (2026-05-30)
- Synchronous dice evaluation is deprecated [module/combat/combat-resolver.js]: Deprecated in V10+, but required by current architecture.
- activeRoller formula extraction and exploding dice logic [module/combat/combat-resolver.js]: Dice logic is brittle but functional for MVP.
- Hardcoded module ID for settings [module/item/item.js]: cyberpunk2020-rilerena is the pre-existing module key.

## Deferred from: code review of 7-5-wounds-and-death-saves-refactor.md (2026-06-10)

- [x] [Review][Defer] Magic numbers for wound levels [module/combat/save-resolver.js] — deferred, pre-existing
