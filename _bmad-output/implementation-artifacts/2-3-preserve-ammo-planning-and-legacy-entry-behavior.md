# Story 2.3: Preserve Ammo Planning and Legacy Entry Behavior

Status: done

<!-- Completion note: Ultimate context engine analysis completed - comprehensive developer guide created. -->

## Story

As a referee,
I want single-shot ammo use to be planned and applied consistently,
so that weapon state and chat output do not diverge.

## Acceptance Criteria

1. Given a weapon with available shots, when a structured semi-auto/single-shot attack outcome is produced, then the outcome includes an ammo delta of one shot and a state-planner item update for the attacking weapon.
2. Given a weapon with no available shots or missing ammo state, when a structured semi-auto/single-shot attack outcome is requested, then the outcome clearly warns or manualizes the ammo state instead of silently planning an invalid update.
3. Given normal Foundry actor-sheet weapon rolls, when this story is implemented, then legacy visible behavior still works and ammo is not double-spent or routed through the new structured path unless explicitly requested by the resolver migration.
4. Given a structured outcome with planned ammo, when `planCombatUpdates(outcome)` runs, then ammo remains unpersisted data until later commit code applies the planned item update through Foundry document APIs.

## Tasks / Subtasks

- [x] Add single-shot ammo evidence to structured outcomes. (AC: 1, 2)
  - [x] Extend `module/combat/attack-resolver.js` or a focused helper under `module/combat/` to derive ammo from `context.weapon.snapshot.shotsLeft`.
  - [x] For a resolvable single-shot, set outcome-level `ammo` evidence with at least `before`, `delta: -1`, `after`, and an auditable source such as `weapon.snapshot.shotsLeft`.
  - [x] Add a planned item update for the attacking weapon only when `weapon.itemUuid` is available and `shotsLeft` is finite and greater than zero.
  - [x] Do not mutate Foundry documents, do not call `item.update()`, and do not spend ammo inside pure resolver modules.
- [x] Handle insufficient or missing ammo explicitly. (AC: 2, 4)
  - [x] If `shotsLeft` is `0`, negative, missing, non-numeric, or `weapon.itemUuid` is missing, do not create an invalid item update.
  - [x] Add stable warning evidence for insufficient or missing ammo, using existing warning shape from `combat-outcome.js`.
  - [x] Decide whether the outcome should be target-level/manual or outcome-level/manual for insufficient ammo; document the chosen behavior in tests and keep it compatible with later preview/confirm.
  - [x] Preserve attack/hit evidence when appropriate, but make ammo commit blocked or manual where automatic ammo planning is unsafe.
- [x] Preserve legacy entry behavior. (AC: 3)
  - [x] Keep default `CyberpunkItem.__weaponRoll()` behavior on the current legacy fallback path unless this story explicitly passes a structured option through a test or adapter branch.
  - [x] Do not remove or rewrite `__semiAuto()`, `__threeRoundBurst()`, `__fullAuto()`, melee, or martial legacy methods in this story.
  - [x] Do not create chat messages, dialogs, or preview/confirm commit code in this story.
  - [x] Ensure structured ammo planning does not cause legacy `__semiAuto()` to spend ammo twice.
- [x] Integrate with the existing state planner. (AC: 1, 4)
  - [x] Use existing `plannedUpdates.itemUpdates` or `itemDeltas` shape accepted by `planCombatUpdates()`.
  - [x] Assert `planCombatUpdates(outcome)` returns exactly one attacker item update for a valid single shot.
  - [x] Assert invalid/missing ammo does not produce unsafe update payloads and carries warnings.
  - [x] Keep update paths Foundry-compatible, e.g. `{ "system.shotsLeft": after }`.
- [x] Extend deterministic fixture coverage. (AC: 1, 2, 3, 4)
  - [x] Update `tests/combat/fixtures/ranged-single-shot.json` structured single-shot cases for valid ammo evidence and planned item update.
  - [x] Add an insufficient-ammo case for `shotsLeft: 0`.
  - [x] Add a missing/invalid ammo case if not covered by the zero-ammo case.
  - [x] Add or preserve a fallback case proving default legacy behavior still uses the fixture legacy fallback when `options.structured !== true`.
  - [x] Assert the fixture runner consumes no extra rolls for ammo planning.
- [x] Preserve project boundaries. (AC: 1, 2, 3, 4)
  - [x] Do not add npm/package workflow, dependencies, TypeScript, bundlers, Jest, Vitest, or browser app scaffolding.
  - [x] Do not change `system.json`, `template.json`, migrations, compendium packs, SCSS, CSS, chat templates, or localization in this story.
  - [x] Do not implement preview/confirm state application; Story 2.4 owns commit UX.
  - [x] Do not render single-shot combat evidence in chat; Story 2.5 owns chat rendering.
- [x] Add focused verification. (AC: 1, 2, 3, 4)
  - [x] Run syntax checks for changed combat modules, `module/item/item.js` if touched, and changed tests.
  - [x] Run `node tests/run-combat-fixtures.mjs`.
  - [x] Static-check new/changed combat runtime code for forbidden side effects: no `ChatMessage`, no `renderTemplate`, no document `.update(`, no `updateEmbeddedDocuments`, no `createEmbeddedDocuments`.
  - [x] Document that Foundry runtime/manual check is optional only if normal UI roll behavior remains on the existing legacy fallback path.

### Review Findings

- [x] [Review][Patch] Fractional ammo can plan a negative item update [module/combat/attack-resolver.js:81]
- [x] [Review][Patch] Blank or null ammo state is reported as insufficient ammo instead of missing ammo [module/combat/attack-resolver.js:81]
- [x] [Review][Patch] Missing ammo state returns no `ammo` evidence object [module/combat/attack-resolver.js:87]
- [x] [Review][Patch] Missing weapon item UUID ammo branch lacks fixture coverage [module/combat/attack-resolver.js:121]

## Dev Notes

### Scope Boundary

This story adds ammo evidence and planned ammo update data for the structured single-shot path created in Story 2.2. It must not commit ammo, open preview/confirm dialogs, render chat cards, apply damage, resolve armor/BTM/wounds/saves, or change visible legacy actor-sheet behavior.

The critical outcome is: structured single-shot data can say "this action would spend one round" and `state-planner.js` can turn that into a valid item update plan, but no Foundry document is updated until later commit work.

### Epic 2 Context

Epic 2 builds the first end-to-end single-shot firearm path:

1. Story 2.1 normalized selected targets to actor-aware references.
2. Story 2.2 resolved structured hit/miss and hit-location attack evidence.
3. Story 2.3 adds ammo evidence/planning while preserving legacy entry behavior.
4. Story 2.4 adds preview/confirm state application.
5. Story 2.5 renders single-shot combat evidence in chat.
6. Story 2.6 adds end-to-end fixtures and Foundry manual checks.

Story 2.3 is therefore a state-planning slice, not a runtime commit slice. Keep it narrow.

### Requirements Traceability

- FR-3: ammo state changes must be represented through planned updates before commit and later committed through Foundry document APIs.
- FR-4: ranged attacks include fire mode and ammo usage as part of ranged firearm behavior.
- Architecture AD-2: `CombatOutcome` includes `ammo` evidence.
- Architecture AD-5: ammo can be included in the same later preview/confirm flow for consistency.
- Architecture AD-6: `state-planner.js` produces `itemUpdates` such as `{ itemUuid, update: { "system.shotsLeft": 8 } }`; commit code later applies item ammo updates first.

### Current Code To Preserve

`module/item/item.js` remains the public weapon-roll entry point:

- `__weaponRoll(attackMods, targetTokens)` currently calls `resolveCombatAction(this.__buildCombatResolverContext(...))` without `{ structured: true }`.
- `resolveCombatAction()` therefore uses `context.legacy.fallback(...)` for normal Foundry UI behavior.
- `__legacyWeaponRoll()` routes `fireModes.semiAuto` to `__semiAuto(attackMods)`.
- `__semiAuto()` currently renders a `Multiroll` and calls `this.update({ "system.shotsLeft": system.shotsLeft - 1 })` immediately.

Do not change that visible path in Story 2.3 unless the implementation can prove no visible behavior changes and no double-spend risk. The safer expected approach is to add ammo planning to the structured path used by Node fixtures, while leaving normal UI on legacy fallback until Story 2.4 owns preview/confirm.

### Current Structured Resolver State

Story 2.2 created `module/combat/attack-resolver.js` with:

- `resolveSingleShotRangedAttack(context, options, roller)`
- attack roll request/evidence with REF, weapon skill, modifiers, and weapon accuracy
- target hit/miss and hit-location outcomes
- top-level `manualResolution` aggregation for target manual-resolution
- no ammo, damage, armor, BTM, saves, chat rendering, or document mutation

`module/combat/combat-resolver.js` currently routes to the structured path only when:

- `options.structured === true`
- action type is ranged
- fire mode lowercases to `semiauto`
- deterministic `roller` is provided
- range/targetNumber, attacker stats, weapon attack skill, and at least one target exist

This guard was added during Story 2.2 review to preserve legacy fallback for incomplete data. Do not weaken it without replacing it with an equally explicit fallback/manual strategy.

### Ammo Planning Contract

Use plain data only. A valid single-shot ammo result should be representable like:

```js
{
  ammo: {
    before: 10,
    delta: -1,
    after: 9,
    source: "weapon.snapshot.shotsLeft"
  },
  plannedUpdates: {
    itemUpdates: [
      {
        itemUuid: "Actor.attacker.Item.heavy-pistol",
        update: {
          "system.shotsLeft": 9
        }
      }
    ],
    chatStatus: "preview"
  }
}
```

It is also acceptable to use `itemDeltas` if that remains compatible with `planCombatUpdates()`, but prefer `plannedUpdates.itemUpdates` for clarity because Story 1.3 already established that shape.

Invalid ammo must not create updates such as `NaN`, `undefined`, negative accidental values, or missing item UUID updates. Add warning evidence with stable codes such as `insufficient-ammo` or `missing-ammo-state`.

### State Planner Behavior

`module/combat/state-planner.js` already:

- collects outcome-level `plannedUpdates`
- collects per-target `plannedUpdates`
- collects `actorDeltas`, `itemDeltas`, and `embeddedItemDeltas`
- validates JSON-safe update payloads
- merges item updates by `itemUuid`
- warns on invalid/missing item update payloads

Do not duplicate merge/conflict logic in the resolver. Let `planCombatUpdates(outcome)` perform update normalization and warning collection.

### Fixture Harness Patterns

`tests/combat/combat-fixtures.test.js` currently:

- runs one baseline fixture through legacy fallback to preserve Epic 1/Story 1.5 coverage
- runs `fixture.singleShotCases` through `resolveCombatAction(context, { structured: true }, roller)`
- supports `expectedRequest` assertions on deterministic roller requests
- supports `legacyExpected` for explicit fallback cases
- uses `assertObjectIncludes()` for partial structured assertions

Extend this harness rather than adding a new framework or package workflow.

### Previous Story Intelligence

Story 2.2 review findings matter directly:

- Missing/incomplete structured contexts must fall back instead of returning invalid evidence.
- Options-only `targetArea` is normalized before hit-location resolution.
- Target-level manual-resolution must aggregate to top-level `manualResolution`.
- Existing ranged modifier evidence includes `targetsCount`.
- `CyberpunkItem.__buildCombatResolverContext()` snapshots item-backed actor skills so structured roll data uses real current skill values.

Do not regress any of those fixes while adding ammo planning.

Recent relevant commits:

- `6e95610 Resolve single-shot ranged attack outcome`
- `d956d4b Normalize selected combat targets`
- `35d3360 Complete combat resolver foundation epic`

### Expected Files

Likely updates:

```text
module/combat/attack-resolver.js
tests/combat/combat-fixtures.test.js
tests/combat/fixtures/ranged-single-shot.json
_bmad-output/implementation-artifacts/2-3-preserve-ammo-planning-and-legacy-entry-behavior.md
_bmad-output/implementation-artifacts/sprint-status.yaml
```

Possible updates only if needed:

```text
module/combat/combat-resolver.js
module/combat/combat-outcome.js
module/item/item.js
```

Avoid touching:

```text
templates/chat/
module/templates.js
system.json
template.json
module/migrate.js
packs/
scss/
css/
package.json
```

### Architecture Compliance

- Pure resolver modules under `module/combat/` must stay importable from Node tests and Foundry runtime.
- Runtime modules under `module/` must not use Node-only APIs.
- Do not import Foundry globals into `attack-resolver.js`.
- Do not call Foundry document APIs from pure resolver code.
- Use plain JavaScript ES modules and relative `.js` imports.
- Keep state changes as planned update data; commit code belongs to later stories.

### Testing Requirements

Required checks for this story:

```text
node --check module/combat/combat-outcome.js
node --check module/combat/combat-resolver.js
node --check module/combat/attack-resolver.js
node --check module/combat/target-normalizer.js
node --check module/combat/state-planner.js
node --check tests/combat/combat-fixtures.test.js
node --check tests/run-combat-fixtures.mjs
node tests/run-combat-fixtures.mjs
rg -n "ChatMessage|renderTemplate|game\\.|ui\\.|new Roll|\\.update\\(|updateEmbeddedDocuments|createEmbeddedDocuments" module/combat tests
```

If implementation touches `module/item/item.js`, also run:

```text
node --check module/item/item.js
```

Required fixture assertions:

- Valid ammo case: `ammo.before`, `ammo.delta`, `ammo.after`, one planned `itemUpdates` entry, and `planCombatUpdates(outcome).itemUpdates`.
- Insufficient ammo case: no unsafe item update and warning/manual evidence.
- Missing/invalid ammo case: no unsafe item update and warning/manual evidence.
- Legacy fallback case: default resolver call without `{ structured: true }` still uses `context.legacy.fallback`.
- No additional roll consumption for ammo planning.

Foundry runtime/manual check is optional if normal actor-sheet behavior remains legacy. If the implementation changes `__weaponRoll()` routing or `__semiAuto()`, a Foundry manual check becomes required.

### Anti-Regression Notes

- Do not double-spend ammo: structured planned update and legacy `__semiAuto().update()` must not both run for the same normal UI action.
- Do not create chat messages in Story 2.3.
- Do not introduce preview/confirm dialogs in Story 2.3.
- Do not calculate or plan damage/armor/wound/saves in Story 2.3.
- Do not add a package workflow to make tests run.
- Do not stage or include unrelated untracked `scripts/`; it is outside Story 2.3 scope unless the user explicitly says otherwise.

### References

- `_bmad-output/planning-artifacts/epics.md` - Epic 2 and Story 2.3 requirements.
- `_bmad-output/planning-artifacts/architecture.md` - AD-2, AD-5, AD-6, sections 4.1/4.7, and Phase 2 single-shot preview plan.
- `_bmad-output/planning-artifacts/prds/prd-Cyberpunk2020VTT-2026-05-24/prd.md` - FR-3, FR-4, state consistency success metric SM-3.
- `_bmad-output/planning-artifacts/prds/prd-Cyberpunk2020VTT-2026-05-24/addendum.md` - current `module/item/item.js` coupling and ammo-risk notes.
- `_bmad-output/implementation-artifacts/1-3-add-state-planner-contract.md` - planned update contract and state-planner expectations.
- `_bmad-output/implementation-artifacts/1-4-add-deterministic-fixture-baseline.md` - fixture runner patterns and deterministic roll guidance.
- `_bmad-output/implementation-artifacts/2-1-normalize-selected-targets-to-actor-aware-references.md` - target refs and snapshot/manual-resolution behavior.
- `_bmad-output/implementation-artifacts/2-2-resolve-single-shot-ranged-attack-outcome.md` - structured attack resolver and review fixes to preserve.
- `_bmad-output/project-context.md` - FoundryVTT brownfield rules and no package workflow.

## Project Structure Notes

This story should stay inside the existing resolver/test spine. The expected implementation is a small data-extension to `CombatOutcome`, not a new runtime surface.

No new folders, build scripts, package files, template files, style files, migrations, or compendium data should be needed.

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Implementation Plan

- Added pure ammo planning to the structured single-shot resolver using `weapon.snapshot.shotsLeft`.
- Kept valid ammo as outcome-level `ammo` evidence and `plannedUpdates.itemUpdates` for `planCombatUpdates()`.
- Marked insufficient, missing, and unsafe ammo-update targets as outcome-level manual resolution with stable warnings and no item updates.
- Preserved normal Foundry UI behavior by leaving `CyberpunkItem.__weaponRoll()` on the default legacy fallback path.

### Debug Log References

- `node tests/run-combat-fixtures.mjs` (red phase, failed before `outcome.ammo` existed)
- `node --check module/combat/combat-outcome.js`
- `node --check module/combat/combat-resolver.js`
- `node --check module/combat/attack-resolver.js`
- `node --check module/combat/target-normalizer.js`
- `node --check module/combat/state-planner.js`
- `node --check tests/combat/combat-fixtures.test.js`
- `node --check tests/run-combat-fixtures.mjs`
- `node tests/run-combat-fixtures.mjs`
- `rg -n "ChatMessage|renderTemplate|game\\.|ui\\.|new Roll|\\.update\\(|updateEmbeddedDocuments|createEmbeddedDocuments" module/combat tests`

### Completion Notes List

- Structured single-shot outcomes now include ammo evidence for valid ammo: `before`, `delta`, `after`, and source.
- Valid ammo produces one attacker item planned update at `system.shotsLeft`.
- Insufficient or missing ammo produces outcome-level manual-resolution and warning evidence without unsafe planned updates.
- Code review fixes added strict integer ammo-state normalization, consistent missing-ammo evidence, and fixture coverage for missing ammo update targets.
- Legacy actor-sheet behavior remains on the existing fallback path; no chat, dialog, commit, damage, armor, BTM, wound, or save behavior was added.
- Foundry runtime/manual check was not run because normal UI roll behavior remains on legacy fallback.

### File List

- `module/combat/attack-resolver.js`
- `tests/combat/combat-fixtures.test.js`
- `tests/combat/fixtures/ranged-single-shot.json`
- `_bmad-output/implementation-artifacts/2-3-preserve-ammo-planning-and-legacy-entry-behavior.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

## Change Log

- 2026-05-27: Created Story 2.3 context and marked ready for development.
- 2026-05-27: Added structured single-shot ammo planning and marked ready for review.
- 2026-05-27: Applied code-review fixes for ammo-state edge cases.
