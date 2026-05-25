# Story 1.4: Add Deterministic Fixture Baseline

Status: done

<!-- Completion note: Ultimate context engine analysis completed - comprehensive developer guide created. -->

## Story

As a maintainer,
I want deterministic combat fixtures and dice control,
so that mechanics changes can be verified without a full Foundry world where possible.

## Acceptance Criteria

1. Given the repo has no existing test harness, when fixture baseline files are added, then deterministic dice/RNG, actor/item/weapon/armor snapshots, and a minimal single-shot fixture can run outside sheet UI.
2. The fixture asserts outcome shape and planned state updates.

## Tasks / Subtasks

- [x] Add a lightweight plain JavaScript fixture harness. (AC: 1, 2)
  - [x] Create `tests/combat/fixtures/`.
  - [x] Create `tests/combat/combat-fixtures.test.js`.
  - [x] Create `tests/run-combat-fixtures.mjs` or the closest equivalent small Node runner.
  - [x] Do not add `package.json`, npm dependencies, TypeScript, bundlers, Jest, Vitest, or a standalone app runtime.
- [x] Add deterministic dice/RNG support for fixture execution. (AC: 1)
  - [x] Provide a fixture roller utility that returns scripted d10/damage/location values and records roll metadata.
  - [x] Pass deterministic roller data through existing `resolveCombatAction(context, options, roller)` instead of importing Foundry `Roll` or using Foundry globals.
  - [x] Keep deterministic control local to tests or plain mechanics helpers; do not alter current legacy weapon roll behavior.
- [x] Add plain actor, target, weapon, and armor snapshots. (AC: 1)
  - [x] Add a minimal ranged attacker snapshot with stats/skills required by future attack resolution.
  - [x] Add a minimal target actor snapshot with damage, hit locations, and equipped armor shape.
  - [x] Add a weapon snapshot using existing contract fields: damage, ap, shotsLeft, rof, reliability, range, accuracy, attackType, and attackSkill.
  - [x] Keep snapshots JSON-serializable and independent from live Foundry `Actor`, `Item`, `Token`, `Roll`, or sheet objects.
- [x] Add a minimal single-shot fixture baseline. (AC: 1, 2)
  - [x] Add `tests/combat/fixtures/ranged-single-shot.json`.
  - [x] Include deterministic input context, roll script, expected `CombatOutcome` shape, and expected planned updates.
  - [x] The fixture may use a deliberately minimal resolver path if full ranged mechanics are not implemented yet, but it must assert the current contracts rather than fake a pass with no outcome checks.
- [x] Assert state planner integration using plain data. (AC: 2)
  - [x] Import `planCombatUpdates` from `module/combat/state-planner.js`.
  - [x] Assert actor/item/embedded item update arrays and `chatStatus` from a fixture outcome.
  - [x] Assert warnings or manual status when planned updates cannot be safely normalized.
- [x] Preserve current Foundry runtime behavior. (AC: 1, 2)
  - [x] Do not change `CyberpunkItem.__weaponRoll()` dispatch or legacy fallback behavior unless strictly needed for injected test data.
  - [x] Do not create chat messages, mutate Foundry documents, or apply planned updates from fixture code.
  - [x] Do not change `system.json`, `template.json`, migrations, templates, localization, compendium packs, SCSS, or CSS for this story.
- [x] Add focused verification and documentation. (AC: 1, 2)
  - [x] Run syntax checks for changed JS/MJS files.
  - [x] Run the fixture harness locally.
  - [x] Static-check fixture/runtime code for forbidden Foundry side effects.
  - [x] Document that Foundry runtime/manual checks were not required unless the implementation intentionally touches runtime UI or document behavior.

### Review Findings

- [x] [Review][Patch] Align fixture input target shape with resolver input contract [tests/combat/combat-fixtures.test.js:95]
- [x] [Review][Patch] Remove provisional armor/BTM/damage formula duplication from fixture stub [tests/combat/combat-fixtures.test.js:98]
- [x] [Review][Patch] Assert deterministic roll metadata, not only roll totals [tests/combat/combat-fixtures.test.js:192]
- [x] [Review][Patch] Move unsafe planned-update warning coverage into fixture data contract [tests/combat/combat-fixtures.test.js:38]

## Dev Notes

### Scope Boundary

This story creates the first deterministic fixture baseline. It should prove that plain combat contracts and planned state updates can be verified outside Foundry, but it must not migrate real single-shot rules, target actor normalization, preview/confirm dialogs, chat rendering, armor/AP/BTM/wound mechanics, or legacy combat routes. Those are later stories.

The correct outcome is a small runner plus one meaningful fixture. Avoid turning this into a broad test platform or npm/tooling migration.

### Previous Story Intelligence

Story 1.1 added `module/combat/combat-outcome.js` as the contract source for `CombatOutcome`, `CombatTargetOutcome`, `RollMetadata`, `PlannedCombatUpdates`, warnings, manual resolution, actor snapshots, weapon snapshots, and target references.

Story 1.2 added `module/combat/combat-resolver.js` and changed `CyberpunkItem.__weaponRoll()` to delegate through `resolveCombatAction(context, options, roller)` while preserving the legacy fallback. Important constraints:

- `CyberpunkItem` remains the public weapon-roll entry point.
- The resolver shell currently requires `context.legacy.fallback` and returns the fallback result unchanged.
- The `roller` parameter is reserved for deterministic tests, but current fallback paths do not use it.
- Resolver context snapshots should avoid live object aliases; clone failures should not leak live Foundry data.

Story 1.3 added `module/combat/state-planner.js` with `planCombatUpdates(outcome, options = {})`. Important constraints:

- The planner accepts plain outcome/update data and returns `actorUpdates`, `itemUpdates`, `embeddedItemUpdates`, `chatStatus`, and `warnings`.
- Compatible update paths are coalesced; conflicting paths stay separate with warnings.
- JSON-unsafe values are skipped with warnings.
- No runtime combat path is wired to the planner yet.

Build this fixture baseline against those established modules instead of creating duplicate outcome, update-plan, or resolver contracts. [Source: `_bmad-output/implementation-artifacts/1-1-define-combatoutcome-and-resolver-input-contracts.md`; `_bmad-output/implementation-artifacts/1-2-add-resolver-shell-and-cyberpunkitem-adapter.md`; `_bmad-output/implementation-artifacts/1-3-add-state-planner-contract.md`]

### Required Fixture Shape

Use the architecture's intended folder shape, scoped to the first fixture:

```text
tests/
  combat/
    fixtures/
      ranged-single-shot.json
    combat-fixtures.test.js
  run-combat-fixtures.mjs
```

The fixture JSON should include enough data for repeatable assertions:

```js
{
  "name": "ranged-single-shot-baseline",
  "context": {
    "action": { "type": "ranged", "fireMode": "semiAuto", "range": "medium" },
    "attacker": { "actorUuid": "Actor.attacker", "name": "Solo", "snapshot": {} },
    "weapon": { "itemUuid": "Actor.attacker.Item.weapon", "name": "Heavy Pistol", "snapshot": {} },
    "targets": [{ "target": { "actorUuid": "Actor.target", "name": "Target", "snapshot": {} } }]
  },
  "rolls": [],
  "expected": {
    "outcome": {},
    "plannedUpdates": {}
  }
}
```

Adjust the exact fields to match the implementation, but keep them plain JSON and aligned with `combat-outcome.js`. Do not store live Foundry objects, functions, circular references, or `Roll` instances in fixtures.

### Deterministic Roller Guidance

The fixture runner needs deterministic dice control before real attack/damage resolver stories arrive. Prefer a small utility inside `tests/combat/combat-fixtures.test.js` or a helper under `tests/combat/` that:

- consumes a scripted list of roll results from the fixture;
- exposes a function compatible with the `roller` argument accepted by `resolveCombatAction`;
- returns plain roll metadata compatible with `RollMetadata` (`formula`, `total`, natural die evidence, seed/id where useful);
- throws a clear error when the fixture consumes rolls out of order or leaves scripted rolls unused.

Do not modify `module/dice.js` for this story unless the implementation has a narrow, backwards-compatible reason. `module/dice.js` is Foundry roll/chat-facing code, while this story needs Foundry-free fixture execution. [Source: `_bmad-output/planning-artifacts/architecture.md` AD-3, AD-9; `docs/architecture.md` Roll and Chat Layer]

### Minimal Outcome Strategy

Because real single-shot mechanics are not implemented yet, the fixture baseline can validate contracts in one of two acceptable ways:

1. Use a small plain fixture-only resolver stub that returns a `CombatOutcome`-like object from fixture input, then feed it into `planCombatUpdates`.
2. Add a narrow non-runtime branch in `resolveCombatAction` only if it remains pure, explicit, and does not affect `CyberpunkItem.__weaponRoll()` legacy fallback behavior.

The first option is lower risk. If the second option is chosen, verify that current legacy calls still require and use `context.legacy.fallback` exactly as before.

The fixture must not simply assert that a JSON file loads. It must check:

- outcome has action, attacker, weapon, targets, and chat/manual status fields where expected;
- target outcome includes a target reference and planned updates or a deliberate manual/warning state;
- `planCombatUpdates` returns explicit update arrays and a deterministic `chatStatus`;
- expected ammo/item update paths and target actor update paths match exactly for the baseline fixture.

### Architecture Compliance

- Keep all fixture and runner code plain JavaScript ES modules.
- The test harness must run outside a Foundry world and must not require `game`, `ui`, `ChatMessage`, `Actor`, `Item`, sheet classes, or Foundry `Roll`.
- Runtime modules under `module/` must remain browser/Foundry-compatible; do not import Node built-ins from runtime code.
- Node built-ins are acceptable in `tests/` and `tests/run-combat-fixtures.mjs` only.
- Do not add a package manager workflow. The runner should be executable with a direct Node command.
- Do not change data shape in `template.json`; snapshots are enough for this baseline.
- Do not duplicate combat formulas across fixtures and item methods. This story is a harness/contract baseline, not the final rules implementation.

### Current Code To Preserve

Relevant existing files:

```text
module/combat/combat-outcome.js
module/combat/combat-resolver.js
module/combat/state-planner.js
module/item/item.js
```

Preserve these behaviors:

- `module/combat/combat-resolver.js` does not import Foundry globals, create chat, roll dice, or mutate documents.
- `module/combat/state-planner.js` remains pure and accepts only JSON-safe plain update data.
- `module/item/item.js` still delegates through `resolveCombatAction(this.__buildCombatResolverContext(...))` and preserves legacy fallback branch behavior.

Avoid touching:

```text
module/actor/actor-sheet.js
system.json
template.json
module/migrate.js
templates/
lang/
scss/
css/
packs/
```

### Testing Requirements

Required verification for this story:

```text
node --check module/combat/combat-outcome.js
node --check module/combat/combat-resolver.js
node --check module/combat/state-planner.js
node --check tests/combat/combat-fixtures.test.js
node --check tests/run-combat-fixtures.mjs
node tests/run-combat-fixtures.mjs
rg -n "game\\.|ui\\.|ChatMessage|Actor\\b|Item\\b|new Roll|\\.update\\(|updateEmbeddedDocuments|createEmbeddedDocuments" tests module/combat
```

When using the `rg` side-effect check, inspect matches rather than treating every match as a failure: JSDoc references to `ActorUpdatePlan`, `ItemUpdatePlan`, or text comments may be expected. Runtime fixture code should not call Foundry globals or document update APIs.

If the implementation does not touch Foundry UI/runtime paths, no Foundry manual check is required. If it changes `module/item/item.js` or other runtime code, statically inspect the diff and state clearly whether Foundry was opened.

### Anti-Regression Notes

- Do not add a broad test framework that forces future contributors into an npm workflow this repo does not have.
- Do not import runtime modules from tests if doing so causes Node to evaluate Foundry-dependent globals.
- Do not make test utilities part of the shipped Foundry manifest.
- Do not loosen the state planner to accept functions, class instances, or circular data just to make fixture authoring easier.
- Do not claim corebook mechanics are covered by this baseline beyond the one minimal fixture actually asserted.
- Do not use fixture snapshots as a new persisted schema. They are test inputs, not `template.json` changes.

### References

- `_bmad-output/planning-artifacts/epics.md` - Epic 1, Story 1.4 requirements and cross-cutting Definition of Done.
- `_bmad-output/planning-artifacts/architecture.md` - AD-3, AD-9, Testing Architecture, Phase 1 migration plan, implementation guardrails.
- `_bmad-output/planning-artifacts/prds/prd-Cyberpunk2020VTT-2026-05-24/prd.md` - FR-21, FR-22, success metric SM-2, counter-metric SM-C1.
- `_bmad-output/planning-artifacts/prds/prd-Cyberpunk2020VTT-2026-05-24/addendum.md` - suggested verification fixtures and known code risk areas.
- `_bmad-output/project-context.md` - FoundryVTT package constraints, no existing npm/test harness, plain JavaScript rules.
- `docs/development-guide.md` - verification standards and high-risk files.

## Project Structure Notes

Expected new files:

```text
tests/combat/fixtures/ranged-single-shot.json
tests/combat/combat-fixtures.test.js
tests/run-combat-fixtures.mjs
```

Expected existing files to reference or import:

```text
module/combat/combat-outcome.js
module/combat/combat-resolver.js
module/combat/state-planner.js
```

No `tests/` directory exists at story creation time. Creating it is aligned with AD-9. There is also no `package.json`; keep the runner direct and self-contained.

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Implementation Plan

- Add the fixture baseline under `tests/` only, keeping runtime Foundry modules unchanged.
- Use `resolveCombatAction()` with a fixture-only legacy fallback to prove deterministic roller injection without changing `CyberpunkItem`.
- Feed the fixture outcome into `planCombatUpdates()` and assert the normalized planned update contract exactly.

### Debug Log References

- `node tests/run-combat-fixtures.mjs` (red phase, failed before runner existed)
- `node --check module/combat/combat-outcome.js`
- `node --check module/combat/combat-resolver.js`
- `node --check module/combat/state-planner.js`
- `node --check tests/combat/combat-fixtures.test.js`
- `node --check tests/run-combat-fixtures.mjs`
- `node tests/run-combat-fixtures.mjs`
- `rg -n "game\\.|ui\\.|ChatMessage|Actor\\b|Item\\b|new Roll|\\.update\\(|updateEmbeddedDocuments|createEmbeddedDocuments" tests module/combat`

### Completion Notes List

- Added a direct Node fixture runner at `tests/run-combat-fixtures.mjs`; no package workflow or dependencies were introduced.
- Added `tests/combat/combat-fixtures.test.js` with a scripted deterministic roller, fixture-only resolver fallback, outcome shape assertions, planned update assertions, and unsafe update warning coverage.
- Added `tests/combat/fixtures/ranged-single-shot.json` with JSON-only attacker, target, weapon, armor, roll script, expected outcome evidence, and expected planned updates.
- Verified the fixture runs outside Foundry and does not require `game`, `ui`, `ChatMessage`, document classes, sheets, Foundry `Roll`, or document update APIs.
- Existing runtime files were not modified for this story. Foundry runtime/manual checks were not required because this story only adds a Foundry-free fixture harness.
- `node tests/run-combat-fixtures.mjs` passes, with Node's expected typeless-package warning because this repo intentionally has no `package.json`/`type: module`.
- Resolved code review findings: target input now matches resolver context shape, fixture stub no longer calculates provisional armor/BTM/damage formulas, roll metadata is asserted deeply, and unsafe planned-update coverage is described in fixture data.

### File List

- `tests/combat/fixtures/ranged-single-shot.json`
- `tests/combat/combat-fixtures.test.js`
- `tests/run-combat-fixtures.mjs`
- `_bmad-output/implementation-artifacts/1-4-add-deterministic-fixture-baseline.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

## Change Log

- 2026-05-24: Created Story 1.4 context and marked ready for development.
- 2026-05-24: Implemented deterministic fixture baseline and direct Node runner.
- 2026-05-25: Addressed code review findings and marked Story 1.4 done.
