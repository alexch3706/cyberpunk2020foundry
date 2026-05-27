# Story 2.4: Preview and Confirm Single-Shot State Application

Status: done

<!-- Completion note: Ultimate context engine analysis completed - comprehensive developer guide created. -->

## Story

As a referee,
I want to preview and confirm single-shot damage/state changes,
so that I can apply or cancel target updates before the actor document changes.

## Acceptance Criteria

1. Given a structured single-shot `CombatOutcome` with planned updates, when the preview step is prepared, then it displays or exposes target, hit/miss, location, planned update summary, ammo change, warnings, and commit/cancel actions.
2. Given the referee confirms the preview, when state application runs, then Foundry document updates are awaited in deterministic planner order: attacker item ammo, target embedded item updates, target actor updates, then chat-status result data.
3. Given the referee cancels the preview, when state application completes, then no actor, item, or embedded item document update is called and the resulting status is `canceled`.
4. Given an outcome requiring manual resolution or planner warnings that make updates unsafe, when preview/confirm is requested, then automatic commit is blocked or clearly manualized instead of mutating documents.
5. Given normal legacy actor-sheet weapon rolls are still routed without `{ structured: true }`, when this story is implemented, then existing visible `__semiAuto()` behavior is not broken or double-spent.

## Tasks / Subtasks

- [x] Add a Foundry adapter for planned combat state application. (AC: 2, 3, 4)
  - [x] Create a focused module such as `module/combat/combat-commit.js`.
  - [x] Export pure-or-adapter functions with explicit boundaries, for example `buildCombatPreviewData(outcome, plannedUpdates = undefined, options = {})` and `applyCombatUpdates(plan, foundryAdapter, options = {})`.
  - [x] Keep update execution out of pure resolver modules: do not add Foundry APIs to `attack-resolver.js`, `combat-resolver.js`, `state-planner.js`, or `combat-chat.js`.
  - [x] Commit `plan.itemUpdates` by resolving each `itemUuid` and awaiting `item.update(update)`.
  - [x] Commit `plan.embeddedItemUpdates` by resolving each owner `actorUuid` and awaiting `actor.updateEmbeddedDocuments(type, updates)`.
  - [x] Commit `plan.actorUpdates` by resolving each `actorUuid` and awaiting `actor.update(update)`.
  - [x] Return a plain result object with `status`, applied update counts, skipped update counts if any, and warnings/errors.
- [x] Add preview/cancel/confirm orchestration without replacing chat rendering. (AC: 1, 2, 3)
  - [x] Add a lightweight preview orchestration helper, for example `previewAndApplyCombatOutcome(outcome, options = {})`, that builds `planCombatUpdates(outcome)` and preview data.
  - [x] Use a Foundry `Dialog` only from adapter/orchestration code, not from pure mechanics modules.
  - [x] The preview data must include `buildCombatChatData(outcome, plan)` or an equivalent plain summary so Story 2.5 can render chat from the same evidence.
  - [x] Confirm must call the commit helper and produce/return `COMBAT_CHAT_STATUS.committed`.
  - [x] Cancel must not call any document update helper and must produce/return `COMBAT_CHAT_STATUS.canceled`.
  - [x] If running outside Foundry tests, allow the dialog/adapter to be injected so Node fixtures can exercise confirm/cancel without Foundry globals.
- [x] Block unsafe automatic commits. (AC: 4)
  - [x] If `outcome.manualResolution.required === true`, default to no automatic document commit.
  - [x] If `plan.warnings` contains invalid update warnings from `state-planner.js`, default to no automatic document commit.
  - [x] Preserve warning evidence in the returned preview/commit result.
  - [x] Do not silently drop updates unless the returned result records what was skipped and why.
- [x] Preserve legacy entry behavior while preparing the structured path. (AC: 5)
  - [x] Keep `CyberpunkItem.__weaponRoll()` default call to `resolveCombatAction(this.__buildCombatResolverContext(...))` on legacy fallback unless this story intentionally adds a clearly bounded structured branch.
  - [x] Do not remove or rewrite `__semiAuto()`, `__threeRoundBurst()`, `__fullAuto()`, melee, or martial legacy methods in this story.
  - [x] If a structured Foundry branch is added, ensure it cannot also call legacy `__semiAuto()` for the same attack.
  - [x] Do not implement damage, armor, BTM, wounds, saves, or structured chat card rendering in this story.
- [x] Extend deterministic fixture coverage for confirm/cancel behavior. (AC: 1, 2, 3, 4)
  - [x] Extend `tests/combat/combat-fixtures.test.js` or add a focused Node test file under `tests/combat/` for commit adapter behavior.
  - [x] Use fake in-memory documents/adapters that record awaited item, actor, and embedded item update calls.
  - [x] Assert valid planned ammo update commits exactly one item update with `{ "system.shotsLeft": after }`.
  - [x] Add a synthetic planned target actor update and embedded item update case so deterministic order is covered even before Epic 3 produces real damage/armor updates.
  - [x] Assert cancel records no update calls and returns canceled status.
  - [x] Assert manual-resolution and invalid-plan cases do not mutate fake documents.
- [x] Preserve project boundaries. (AC: 1, 2, 3, 4, 5)
  - [x] Do not add npm/package workflow, dependencies, TypeScript, bundlers, Jest, Vitest, or browser app scaffolding.
  - [x] Do not change `template.json`, migrations, compendium packs, SCSS, CSS, or localization unless the runtime preview dialog introduces localized user-facing strings.
  - [x] If adding a Handlebars dialog template, put it under `templates/dialog/` and preload it through `module/templates.js`; otherwise use a minimal inline `Dialog` content builder in adapter code.
  - [x] Do not create `ChatMessage` output in this story; Story 2.5 owns structured chat rendering.
- [x] Add focused verification. (AC: 1, 2, 3, 4, 5)
  - [x] Run syntax checks for changed combat modules, `module/item/item.js` if touched, and changed tests.
  - [x] Run `node tests/run-combat-fixtures.mjs`.
  - [x] Static-check pure combat modules for forbidden side effects: no `ChatMessage`, no `renderTemplate`, no `Dialog`, no document `.update(`, no `updateEmbeddedDocuments`, no `createEmbeddedDocuments`.
  - [x] Static-check the new adapter module separately and confirm Foundry APIs are isolated there.
  - [x] If runtime dialog wiring is added, document a Foundry manual check for confirm and cancel from an actor-sheet semi-auto attack.

### Review Findings

- [x] [Review][Patch] Commit write failures can leave partial combat state without a returned failure result [module/combat/combat-commit.js:98]
- [x] [Review][Patch] Preflight resolver rejections bypass the non-mutating manual result path [module/combat/combat-commit.js:138]
- [x] [Review][Patch] Embedded item updates without `_id` can reach Foundry instead of being blocked before mutation [module/combat/combat-commit.js:103]
- [x] [Review][Patch] Confirm/cancel/manual results do not return final chat-status data [module/combat/combat-commit.js:78]

## Dev Notes

### Scope Boundary

This story adds preview/confirm state application infrastructure for structured single-shot outcomes. It may commit existing planned ammo updates and any already-planned target updates supplied by the outcome/fixtures. It must not invent the target damage pipeline.

Current Story 2.3 output plans attacker ammo only. Epic 3 later creates real armor, damage, BTM, wound, and save plans. Story 2.4 should therefore build generic state-application plumbing against `planCombatUpdates(outcome)`, and use synthetic target update fixture cases to prove ordering without implementing damage rules early.

Do not create structured combat chat messages here. Story 2.5 owns chat rendering. Story 2.4 can return chat status/result data and can reuse `buildCombatChatData()` as plain preview evidence.

### Epic 2 Context

Epic 2 builds the first end-to-end single-shot firearm path:

1. Story 2.1 normalized selected targets to actor-aware references.
2. Story 2.2 resolved structured hit/miss and hit-location attack evidence.
3. Story 2.3 added ammo evidence and planned ammo item updates.
4. Story 2.4 adds preview/confirm state application.
5. Story 2.5 renders single-shot combat evidence in chat.
6. Story 2.6 adds end-to-end fixtures and Foundry manual checks.

Story 2.4 is the first commit-layer slice. Keep it as adapter/orchestration around existing plans, not a mechanics expansion.

### Requirements Traceability

- FR-3: state changes must be committed through Foundry document update APIs.
- UX-DR1: preview/confirm damage application dialog displays target/update evidence, ammo change, warnings, and commit/cancel outcome.
- Architecture AD-3: Foundry-specific state writes belong in adapter/orchestration code, not mechanics modules.
- Architecture AD-5: damage application requires preview/confirm; ammo may be included in the same confirm step for consistency.
- Architecture AD-6: planned updates are first-class and commit order is attacker item ammo, target armor/embedded updates, target actor wound/damage updates, save state, then chat create/update.

### Current Code To Preserve

`module/item/item.js` remains the public weapon-roll entry point:

- `__weaponRoll(attackMods, targetTokens)` calls `resolveCombatAction(this.__buildCombatResolverContext(...))` without `{ structured: true }`.
- `resolveCombatAction()` therefore uses `context.legacy.fallback(...)` for normal Foundry UI behavior.
- `__legacyWeaponRoll()` routes `fireModes.semiAuto` to `__semiAuto(attackMods)`.
- `__semiAuto()` currently renders a `Multiroll` and immediately calls `this.update({ "system.shotsLeft": system.shotsLeft - 1 })`.

Preserve that visible path unless the implementation deliberately gates a structured path and proves no double-spend. The safest Story 2.4 implementation is to create reusable preview/commit helpers and test them through injected adapters/fixtures before wiring normal UI rolls.

### Existing Contracts To Reuse

`module/combat/state-planner.js` already exposes:

```js
planCombatUpdates(outcome, options = {})
```

It returns:

```js
{
  actorUpdates: [],
  itemUpdates: [],
  embeddedItemUpdates: [],
  chatStatus: "preview",
  warnings: []
}
```

It also validates JSON-safe payloads, merges repeated actor/item update paths, merges embedded item batches, and warns on invalid/conflicting updates. Do not duplicate this merge logic in the commit adapter.

`module/combat/combat-chat.js` already exposes:

```js
buildCombatChatData(outcome, plannedUpdates = undefined, options = {})
```

It supports `preview`, `manual`, `committed`, and `canceled` statuses as plain template data. Story 2.4 can use this for preview summaries and returned result evidence, but should not render templates or create `ChatMessage`.

`module/combat/combat-outcome.js` defines:

- `COMBAT_CHAT_STATUS.preview`
- `COMBAT_CHAT_STATUS.committed`
- `COMBAT_CHAT_STATUS.canceled`
- `COMBAT_CHAT_STATUS.manual`
- `MANUAL_RESOLUTION_REASON`
- `COMBAT_WARNING_SEVERITY`

Use these constants instead of hardcoded status strings in new runtime modules where practical.

### Expected Commit Adapter Shape

A minimal adapter-friendly shape is acceptable:

```js
export async function applyCombatUpdates(plan, adapter, options = {}) {
  // adapter.resolveItem(itemUuid) -> Foundry Item-like document
  // adapter.resolveActor(actorUuid) -> Foundry Actor-like document
  // await item.update(update)
  // await actor.updateEmbeddedDocuments(type, updates)
  // await actor.update(update)
}
```

For Foundry runtime, a default adapter can use `fromUuid(uuid)` when available:

```js
const item = await fromUuid(itemUuid);
await item.update(update);
```

Keep `fromUuid`, `Dialog`, document `.update()`, and `updateEmbeddedDocuments()` isolated to the adapter/orchestration module. Node tests should pass fake adapter objects and fake documents.

### Preview Data Requirements

Preview data must be plain and fixture-testable. Include:

- action/fire mode/range evidence from the outcome
- attacker and weapon refs
- target refs, hit/miss, hit locations when present
- ammo evidence with `before`, `delta`, `after`, and source
- planned update counts and warning summaries
- `canCommit` boolean or equivalent
- explicit confirm/cancel action labels or command descriptors for the runtime dialog

Do not rely on live actor/item data after resolution to describe planned state. Preview evidence must derive from `CombatOutcome` and `planCombatUpdates(outcome)`.

### Manual And Warning Behavior

Automatic commit should be blocked when:

- `outcome.manualResolution.required === true`
- any target has `manualResolution.required === true`
- `plan.warnings` includes invalid update payload warnings such as `invalid-item-update`, `invalid-actor-update`, `invalid-embedded-item-update`, `unserializable-update-payload`, or conflicting update warnings
- required document UUIDs cannot be resolved by the adapter

Blocked commit results should return status `manual` or a clear failure result without document mutation. Do not partially commit after a preflight failure; validate resolvability before executing updates when possible.

### Deterministic Commit Order

Use the architecture order:

1. `plan.itemUpdates` for attacker/item ammo updates.
2. `plan.embeddedItemUpdates` for target armor/staged penetration embedded item updates.
3. `plan.actorUpdates` for target damage/wound/save state.
4. Chat status result data only; no `ChatMessage` creation in this story.

If a future save-state plan needs a distinct bucket, leave a clear extension point but do not invent persisted save fields now.

### Fixture Harness Patterns

`tests/combat/combat-fixtures.test.js` currently:

- runs baseline legacy fallback assertions
- runs `fixture.singleShotCases` through `resolveCombatAction(context, { structured: true }, roller)`
- supports `expectedPlan` assertions through `planCombatUpdates(outcome)`
- uses partial object assertions through `assertObjectIncludes()`

Extend this harness if it stays readable. If commit adapter tests become clearer in a separate file, keep the runner simple and import it from `tests/run-combat-fixtures.mjs`. Do not add a package workflow.

### Previous Story Intelligence

Story 2.3 review fixes matter directly:

- `shotsLeft` is normalized as a strict integer.
- missing, blank, boolean, non-finite, or fractional ammo states are manualized and never create item updates.
- missing `weapon.itemUuid` produces `missing-ammo-update-target` and no item update.
- valid ammo creates outcome-level `ammo` evidence and one `plannedUpdates.itemUpdates` entry.

Do not bypass this by recomputing ammo in the commit layer. Commit only the plan returned by `planCombatUpdates(outcome)`.

Recent relevant commits:

- `d36d725 Preserve ammo planning and legacy entry behavior`
- `6e95610 Resolve single-shot ranged attack outcome`
- `d956d4b Normalize selected combat targets`
- `35d3360 Complete combat resolver foundation epic`

### Expected Files

Likely new files:

```text
module/combat/combat-commit.js
```

Likely updates:

```text
tests/combat/combat-fixtures.test.js
tests/combat/fixtures/ranged-single-shot.json
tests/run-combat-fixtures.mjs
_bmad-output/implementation-artifacts/2-4-preview-and-confirm-single-shot-state-application.md
_bmad-output/implementation-artifacts/sprint-status.yaml
```

Possible updates only if runtime preview dialog wiring is intentionally added:

```text
module/item/item.js
module/templates.js
templates/dialog/combat-damage-preview.hbs
lang/en.json
lang/es.json
lang/it.json
```

Avoid touching unless explicitly required:

```text
module/combat/attack-resolver.js
module/combat/combat-resolver.js
module/combat/state-planner.js
module/combat/combat-chat.js
templates/chat/
system.json
template.json
module/migrate.js
packs/
scss/
css/
package.json
```

### Architecture Compliance

- Runtime code remains plain JavaScript ES modules under `module/`.
- Foundry APIs are allowed only in adapter/orchestration modules, not pure mechanics modules.
- Persisted writes must use awaited Foundry document APIs: `update()` and `updateEmbeddedDocuments()`.
- Do not mutate document `system` objects directly.
- Do not infer post-commit state from live documents for preview/chat evidence.
- No npm dependencies, TypeScript, bundler, frontend framework, or package workflow.

### Testing Requirements

Required checks for this story:

```text
node --check module/combat/combat-outcome.js
node --check module/combat/state-planner.js
node --check module/combat/combat-chat.js
node --check module/combat/combat-commit.js
node --check tests/combat/combat-fixtures.test.js
node --check tests/run-combat-fixtures.mjs
node tests/run-combat-fixtures.mjs
rg -n "ChatMessage|renderTemplate|new Dialog|game\\.|ui\\.|new Roll|\\.update\\(|updateEmbeddedDocuments|createEmbeddedDocuments|fromUuid" module/combat tests
```

Interpretation of the static scan:

- `module/combat/combat-commit.js` may contain `Dialog`, `fromUuid`, `.update(`, or `updateEmbeddedDocuments` if this story adds real Foundry orchestration there.
- Pure modules (`combat-outcome.js`, `combat-resolver.js`, `attack-resolver.js`, `state-planner.js`, `combat-chat.js`) must remain free of those side effects.
- Tests may contain fake `.update()` methods; that is acceptable if they are test doubles.

If implementation touches `module/item/item.js`, also run:

```text
node --check module/item/item.js
```

If implementation adds templates/localization, verify all declared language files are updated or document intentional fallback behavior.

### Foundry Manual Check Guidance

Manual Foundry verification is required only if the implementation wires preview/confirm into the normal actor-sheet roll path. If wiring is deferred and only adapter helpers are added, document that runtime manual check is deferred to Story 2.6.

If runtime wiring is added, manually verify:

1. Semi-auto actor-sheet attack opens preview instead of immediately spending ammo.
2. Confirm awaits item ammo update and updates `system.shotsLeft` once.
3. Cancel leaves attacker item ammo unchanged.
4. Manual-resolution or invalid ammo cases do not update documents.
5. Legacy unsupported fire modes still use existing behavior.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` - Story 2.4]
- [Source: `_bmad-output/planning-artifacts/architecture.md` - AD-3, AD-5, AD-6, Main Runtime Flow 6.1]
- [Source: `_bmad-output/project-context.md` - Foundry document API and workflow rules]
- [Source: `module/combat/state-planner.js` - planned update normalization]
- [Source: `module/combat/combat-chat.js` - preview/manual/committed/canceled chat data contract]
- [Source: `module/item/item.js` - legacy `__weaponRoll()` and `__semiAuto()` behavior]
- [Source: `_bmad-output/implementation-artifacts/2-3-preserve-ammo-planning-and-legacy-entry-behavior.md` - ammo planning contract and review fixes]

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- `node tests/run-combat-fixtures.mjs` red phase failed with missing `module/combat/combat-commit.js`.
- `node --check module/combat/combat-outcome.js`
- `node --check module/combat/state-planner.js`
- `node --check module/combat/combat-chat.js`
- `node --check module/combat/combat-commit.js`
- `node --check tests/combat/combat-fixtures.test.js`
- `node --check tests/combat/combat-commit.test.js`
- `node --check tests/run-combat-fixtures.mjs`
- `node tests/run-combat-fixtures.mjs`
- `rg -n "ChatMessage|renderTemplate|new Dialog|game\\.|ui\\.|new Roll|\\.update\\(|updateEmbeddedDocuments|createEmbeddedDocuments|fromUuid" module/combat/combat-outcome.js module/combat/combat-resolver.js module/combat/attack-resolver.js module/combat/state-planner.js module/combat/combat-chat.js`
- `rg -n "ChatMessage|renderTemplate|new Dialog|game\\.|ui\\.|new Roll|\\.update\\(|updateEmbeddedDocuments|createEmbeddedDocuments|fromUuid" module/combat/combat-commit.js tests`

### Completion Notes List

- Added `module/combat/combat-commit.js` with `buildCombatPreviewData()`, `previewAndApplyCombatOutcome()`, `applyCombatUpdates()`, and a default Foundry adapter isolated behind `fromUuid`.
- Preview data is plain, includes chat evidence from `buildCombatChatData()`, and exposes commit/cancel actions without rendering templates or creating chat messages.
- Confirm preflights resolvability before mutation, then awaits item, embedded item, and actor updates in deterministic planner order.
- Cancel, manual-resolution, invalid-plan warnings, and unresolved documents return non-mutating results with skipped counts and warnings.
- No runtime actor-sheet wiring was added, so existing legacy `__weaponRoll()` / `__semiAuto()` behavior remains untouched; Foundry manual runtime check is deferred to Story 2.6.
- Fixture runner now includes focused commit adapter tests using fake in-memory documents.
- Code review fixes added final chat-status result data, resolver rejection handling, embedded update `_id` preflight validation, and partial write-failure result reporting.

### File List

- `module/combat/combat-commit.js`
- `tests/combat/combat-commit.test.js`
- `tests/run-combat-fixtures.mjs`
- `_bmad-output/implementation-artifacts/2-4-preview-and-confirm-single-shot-state-application.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Change Log

- 2026-05-27: Implemented preview/confirm combat update adapter and commit tests for Story 2.4.
- 2026-05-27: Applied code-review fixes for commit failure and final status edge cases.
