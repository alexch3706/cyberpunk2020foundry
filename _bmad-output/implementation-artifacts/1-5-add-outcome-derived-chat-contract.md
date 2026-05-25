# Story 1.5: Add Outcome-Derived Chat Contract

Status: done

<!-- Completion note: Ultimate context engine analysis completed - comprehensive developer guide created. -->

## Story

As a maintainer,
I want chat data generated from `CombatOutcome`,
so that chat evidence and committed state use the same source of truth.

## Acceptance Criteria

1. Given a `CombatOutcome`, when chat template data is generated, then preview/manual/committed/canceled statuses are representable.
2. Chat data does not depend on already-mutated actor/item state.

## Tasks / Subtasks

- [x] Add a pure combat chat contract module. (AC: 1, 2)
  - [x] Add `module/combat/combat-chat.js`.
  - [x] Export a function such as `buildCombatChatData(outcome, plannedUpdates = undefined, options = {})`.
  - [x] Return plain template data only; do not call `ChatMessage.create`, `renderTemplate`, `Roll`, `Multiroll.execute`, `game`, `ui`, or Foundry document APIs.
  - [x] Keep the module safe to import from Node fixture tests and Foundry runtime.
- [x] Represent all required chat statuses. (AC: 1)
  - [x] Support `preview`, `manual`, `committed`, and `canceled` status values, using `COMBAT_CHAT_STATUS` from `combat-outcome.js`.
  - [x] Derive status from explicit options first, then planned update `chatStatus`, then `outcome.chat.status`, then manual-resolution state, then default `preview`.
  - [x] Include explicit booleans or equivalent flags for template consumption, such as `isPreview`, `isManual`, `isCommitted`, and `isCanceled`.
  - [x] Preserve manual-resolution reason/message and blocked update categories when present.
- [x] Build chat evidence from `CombatOutcome` and planned updates only. (AC: 2)
  - [x] Include action, attacker, weapon, ammo, warnings, pending decisions, and per-target summaries from the outcome.
  - [x] Include target attack evidence: total, formula, natural die metadata, target number or opposed result, hit/miss, margin, and warnings where present.
  - [x] Include hit evidence already present in the outcome: location, raw damage, effective SP, armor mitigation, BTM mitigation, final damage, wound transition, save prompts/results, and hit warnings.
  - [x] Include planned update summary/counts and `chatStatus` from `planCombatUpdates(outcome)` or a supplied plan, without reading live actor/item state.
- [x] Add minimal template path and preload guidance without wiring runtime chat. (AC: 1, 2)
  - [x] If a new template is added, use `templates/chat/combat-outcome.hbs`.
  - [x] Keep template logic declarative; do not embed combat calculations in Handlebars.
  - [x] If the template is intended for runtime use now, add it to `module/templates.js`; otherwise document that runtime rendering is deferred.
  - [x] Do not replace existing `default-roll.hbs`, `weapon-roll.hbs`, or `multi-hit.hbs` legacy templates.
- [x] Extend the deterministic fixture baseline for chat contract coverage. (AC: 1, 2)
  - [x] Update `tests/combat/fixtures/ranged-single-shot.json` or add a small chat-focused fixture section.
  - [x] Assert `buildCombatChatData()` output for at least `preview`, `manual`, `committed`, and `canceled` statuses.
  - [x] Assert chat data preserves roll metadata and planned update evidence from the existing fixture outcome.
  - [x] Assert chat data can be produced in Node without Foundry globals.
- [x] Preserve current runtime behavior. (AC: 1, 2)
  - [x] Do not wire `combat-chat.js` into `CyberpunkItem.__weaponRoll()` yet.
  - [x] Do not change current chat output from legacy semi-auto, burst, full-auto, melee, or martial paths.
  - [x] Do not create chat messages, mutate documents, spend ammo, apply damage, or change preview/confirm behavior in this story.
  - [x] Do not change `system.json`, `template.json`, migrations, compendium packs, SCSS, or CSS unless a new template preload is intentionally added.
- [x] Add focused verification. (AC: 1, 2)
  - [x] Run syntax checks for `module/combat/combat-outcome.js`, `module/combat/state-planner.js`, `module/combat/combat-chat.js`, and changed tests.
  - [x] Run `node tests/run-combat-fixtures.mjs`.
  - [x] Static-check `module/combat/combat-chat.js` for forbidden side effects: no `ChatMessage`, no `renderTemplate`, no `game`, no `ui`, no `.update(`, no `updateEmbeddedDocuments`, no `createEmbeddedDocuments`.
  - [x] Document that Foundry runtime/manual checks were not required unless runtime chat rendering is intentionally wired.

## Dev Notes

### Scope Boundary

This story adds the chat-data contract for future structured combat chat. It must not implement Foundry chat creation, preview/confirm dialogs, commit behavior, new damage rules, target normalization, or migration of legacy item roll chat output. Later stories, especially Story 2.5, will render user-facing single-shot combat chat and wire it into the runtime flow.

The expected implementation is a pure mapper from `CombatOutcome` plus planned updates into template-ready data. It should prove that chat evidence can come from the same data used for preview/commit decisions without reading already-mutated actor/item documents.

### Previous Story Intelligence

Story 1.1 added `module/combat/combat-outcome.js` with:

- `COMBAT_CHAT_STATUS`: `preview`, `committed`, `canceled`, `manual`.
- `COMBAT_WARNING_SEVERITY`.
- `MANUAL_RESOLUTION_REASON`.
- typedefs for `CombatOutcome`, `CombatTargetOutcome`, `CombatHitRecord`, `RollMetadata`, `CombatWarning`, `ManualResolution`, and `PlannedCombatUpdates`.

Story 1.2 added `module/combat/combat-resolver.js` and changed `CyberpunkItem.__weaponRoll()` to delegate through a resolver shell while preserving legacy fallback. Do not change that runtime path in this story.

Story 1.3 added `module/combat/state-planner.js` with `planCombatUpdates(outcome, options = {})`. The planner returns plain `actorUpdates`, `itemUpdates`, `embeddedItemUpdates`, `chatStatus`, and `warnings`. Use that plan shape as chat evidence input; do not duplicate planner behavior in chat code.

Story 1.4 added the first Foundry-free fixture runner:

```text
tests/combat/fixtures/ranged-single-shot.json
tests/combat/combat-fixtures.test.js
tests/run-combat-fixtures.mjs
```

Review fixes in Story 1.4 are important for this story:

- Fixture target input now matches resolver context shape.
- Fixture stub no longer calculates provisional armor/BTM/damage formulas; evidence comes from fixture data.
- Roll metadata is asserted deeply.
- Unsafe planned-update warning coverage lives in fixture data.

Build on that fixture structure and keep all new chat assertions plain Node-compatible. [Source: `_bmad-output/implementation-artifacts/1-4-add-deterministic-fixture-baseline.md`; `tests/combat/combat-fixtures.test.js`; `tests/combat/fixtures/ranged-single-shot.json`]

### Required Chat Data Shape

The exact object shape may be refined during implementation, but it should be stable enough for future templates. A suitable shape is:

```js
{
  status: "preview",
  isPreview: true,
  isManual: false,
  isCommitted: false,
  isCanceled: false,
  action: { type, fireMode, range },
  attacker: { actorUuid, tokenUuid, name },
  weapon: { itemUuid, name },
  ammo: { before, delta, after },
  plannedUpdates: {
    chatStatus,
    actorUpdateCount,
    itemUpdateCount,
    embeddedItemUpdateCount,
    warnings
  },
  manualResolution: { required, reason, message, blockedUpdateCategories },
  warnings: [],
  pendingDecisions: [],
  targets: [
    {
      target: { actorUuid, tokenUuid, name },
      status,
      attack: { total, formula, die, targetNumber, opposedRoll, hit, margin, warnings },
      hits: [
        {
          location,
          rawDamage,
          effectiveStoppingPower,
          armorMitigation,
          bodyTypeMitigation,
          finalDamage,
          woundTransition,
          damageRoll,
          locationRoll,
          warnings
        }
      ],
      saves: [],
      plannedUpdates,
      manualResolution,
      warnings
    }
  ]
}
```

Keep values copied from outcome/plan data. Do not compute combat formulas or infer post-commit actor/item state from live documents.

### Status Derivation Rules

Use a deterministic precedence so future commit code can update chat state without ambiguity:

1. `options.status`, if supplied and valid.
2. `plannedUpdates.chatStatus`, if supplied and valid.
3. `outcome.chat.status`, if supplied and valid.
4. `manual` if `outcome.manualResolution.required` or any target-level `manualResolution.required` is true.
5. `preview` as the default.

Invalid status values should not throw during chat-data generation. Prefer a warning entry in the returned data and fall back to `preview` or `manual` depending on manual-resolution state.

### Current Code To Preserve

Existing legacy chat flow:

- `module/dice.js` defines `Multiroll`, `DefaultRollTemplate`, `makeD10Roll`, and `classifyRollDice`.
- `module/item/item.js` currently creates legacy chat output through `Multiroll` and templates such as `multi-hit.hbs`.
- `templates/chat/default-roll.hbs`, `templates/chat/weapon-roll.hbs`, and `templates/chat/multi-hit.hbs` are existing legacy templates.
- `module/templates.js` preloads current chat templates.

Do not replace or re-route those paths. This story may add `module/combat/combat-chat.js` and optionally `templates/chat/combat-outcome.hbs`, but runtime rendering should remain deferred unless the implementation can prove no visible behavior changes.

### Architecture Compliance

- `combat-chat.js` is a pure or pure-ish data mapper. It must not create chat messages.
- Resolver functions remain the source of `CombatOutcome`; chat data must not become a second source of combat truth.
- State planner remains the source of planned update data; chat data may summarize or include the plan, but must not generate new state deltas.
- Use plain JavaScript ES modules and relative `.js` imports.
- Do not add npm dependencies, package workflow, TypeScript, bundlers, Jest, Vitest, React/Vue/Svelte, or a standalone runtime.
- Do not add localization keys unless a runtime template with user-facing strings is actually rendered in this story. If adding a template with literal labels for future use, document that localization is deferred until runtime wiring.

### Testing Requirements

Required checks for this story:

```text
node --check module/combat/combat-outcome.js
node --check module/combat/state-planner.js
node --check module/combat/combat-chat.js
node --check tests/combat/combat-fixtures.test.js
node --check tests/run-combat-fixtures.mjs
node tests/run-combat-fixtures.mjs
rg -n "ChatMessage|renderTemplate|game\\.|ui\\.|new Roll|\\.update\\(|updateEmbeddedDocuments|createEmbeddedDocuments" module/combat/combat-chat.js tests
```

Inspect `rg` matches rather than treating every text match as a failure; fixture UUID strings or comments may be harmless. Runtime code in `combat-chat.js` must not call Foundry globals or document update APIs.

If a new template is added:

- Verify `templates/chat/combat-outcome.hbs` exists.
- If preloaded, verify `module/templates.js` path is correct.
- Foundry runtime/manual check is optional only if the template is not wired to runtime chat creation. If runtime rendering is wired, manual Foundry chat verification becomes required.

### Anti-Regression Notes

- Do not make chat template data read from `actor.system`, `item.system`, token documents, or current sheet state. That would recreate the chat/state divergence this story is meant to prevent.
- Do not duplicate damage, armor, hit-location, save, or ammo formulas in `combat-chat.js` or Handlebars. Chat shows evidence already present in `CombatOutcome`.
- Do not hide warnings/manual-resolution state. Manual and warning evidence must be representable even if future templates choose how to display it.
- Do not wire the fixture-only resolver stub into production code.
- Do not treat `Multiroll` as required for every future `CombatOutcome`. Architecture explicitly allows structured combat outcome chat to be independent from `Multiroll` where practical.
- Do not mark Epic 1 complete automatically after this story; sprint status has a separate optional retrospective and epic completion should be an explicit workflow/PM action.

### References

- `_bmad-output/planning-artifacts/epics.md` - Epic 1 and Story 1.5 requirements; cross-cutting Definition of Done.
- `_bmad-output/planning-artifacts/architecture.md` - AD-2, AD-3, AD-5, AD-6, section 4.8 `combat-chat.js`, testing architecture, implementation guardrails.
- `_bmad-output/planning-artifacts/prds/prd-Cyberpunk2020VTT-2026-05-24/prd.md` - FR-1, FR-3, NFR-2, NFR-3, success metrics SM-3 and SM-4.
- `_bmad-output/planning-artifacts/prds/prd-Cyberpunk2020VTT-2026-05-24/addendum.md` - `commitCombatResult` direction and chat/state consistency risk areas.
- `_bmad-output/implementation-artifacts/1-1-define-combatoutcome-and-resolver-input-contracts.md` - combat outcome and chat status contracts.
- `_bmad-output/implementation-artifacts/1-3-add-state-planner-contract.md` - planned update contract.
- `_bmad-output/implementation-artifacts/1-4-add-deterministic-fixture-baseline.md` - fixture baseline and review learnings.
- `_bmad-output/project-context.md` - FoundryVTT brownfield rules, no package workflow, localization/template cautions.

## Project Structure Notes

Expected new file:

```text
module/combat/combat-chat.js
```

Expected test updates:

```text
tests/combat/fixtures/ranged-single-shot.json
tests/combat/combat-fixtures.test.js
tests/run-combat-fixtures.mjs
```

Optional new template if implementation chooses to add a future rendering surface:

```text
templates/chat/combat-outcome.hbs
```

If the optional template is added and preloaded:

```text
module/templates.js
```

Avoid touching:

```text
module/item/item.js
module/actor/actor-sheet.js
system.json
template.json
module/migrate.js
packs/
scss/
css/
```

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Implementation Plan

- Add `module/combat/combat-chat.js` as a pure mapper from `CombatOutcome` and planned updates into plain chat template data.
- Extend the existing Foundry-free fixture runner to assert preview/manual/committed/canceled chat statuses and evidence preservation.
- Keep runtime chat rendering deferred; no template, preload, `ChatMessage`, or legacy item roll wiring changes in this story.

### Debug Log References

- `node tests/run-combat-fixtures.mjs` (red phase, failed before `combat-chat.js` existed)
- `node --check module/combat/combat-outcome.js`
- `node --check module/combat/state-planner.js`
- `node --check module/combat/combat-chat.js`
- `node --check tests/combat/combat-fixtures.test.js`
- `node --check tests/run-combat-fixtures.mjs`
- `node tests/run-combat-fixtures.mjs`
- `rg -n "ChatMessage|renderTemplate|game\\.|ui\\.|new Roll|\\.update\\(|updateEmbeddedDocuments|createEmbeddedDocuments" module/combat/combat-chat.js tests`

### Completion Notes List

- Added `module/combat/combat-chat.js` with `buildCombatChatData(outcome, plannedUpdates, options)`.
- Chat status derivation supports explicit option status, planned update chat status, outcome chat status, manual-resolution fallback, and preview default.
- Chat data includes status flags, action/attacker/weapon/ammo evidence, planned update counts, warnings, pending decisions, manual resolution, target attack evidence, hit evidence, save arrays, and target planned update summaries.
- Extended `tests/combat/fixtures/ranged-single-shot.json` with expected preview chat data and status cases for `committed`, `canceled`, and `manual`.
- Extended `tests/combat/combat-fixtures.test.js` to assert `buildCombatChatData()` output and status variants in Node.
- No runtime chat rendering was wired, no template was added, and existing legacy chat templates/output paths were unchanged.
- Verification passed with syntax checks, fixture runner, and side-effect scan. Foundry runtime/manual checks were not required because this story adds only Foundry-free chat data generation.

### File List

- `module/combat/combat-chat.js`
- `tests/combat/fixtures/ranged-single-shot.json`
- `tests/combat/combat-fixtures.test.js`
- `_bmad-output/implementation-artifacts/1-5-add-outcome-derived-chat-contract.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

## Change Log

- 2026-05-25: Created Story 1.5 context and marked ready for development.
- 2026-05-25: Added outcome-derived combat chat data contract and fixture coverage.
- 2026-05-25: Code review completed with no findings.
