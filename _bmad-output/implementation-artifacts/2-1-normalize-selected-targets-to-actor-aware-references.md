# Story 2.1: Normalize Selected Targets to Actor-Aware References

Status: done

<!-- Completion note: Ultimate context engine analysis completed - comprehensive developer guide created. -->

## Story

As a referee,
I want selected Foundry targets to resolve into actor-aware combat targets,
so that attacks can use target hit locations, armor, BTM, wound state, and save thresholds.

## Acceptance Criteria

1. Given one or more tokens are targeted in Foundry, when a firearm attack is initiated from the actor sheet, then each selected target is represented with token UUID, actor UUID when available, and display name.
2. Targets without actor context are marked for manual-resolution instead of silently using name/id only.

## Tasks / Subtasks

- [x] Add an actor-aware selected target normalization boundary. (AC: 1, 2)
  - [x] Add a small helper in `module/combat/` such as `target-normalizer.js`.
  - [x] Export a pure-ish function such as `normalizeSelectedTargets(targets = [])` that accepts Foundry target token objects or already-plain target references.
  - [x] Return plain target refs shaped for the combat resolver: `{ id, tokenUuid, actorUuid, name, snapshot?, manualResolution?, warnings? }`.
  - [x] Do not throw when actor context is missing; preserve display identity and mark the target manual-resolution.
- [x] Capture target actor snapshots only when actor context exists. (AC: 1, 2)
  - [x] Include target `actorUuid` from `target.actor?.uuid` or an equivalent plain input field.
  - [x] Include `tokenUuid` from `target.document?.uuid`, `target.tokenUuid`, or `target.uuid` as available.
  - [x] Include target display name from `target.document?.name`, `target.name`, or `target.actor?.name` fallback.
  - [x] When an actor exists, include a plain JSON-safe snapshot with at least `stats`, `damage`, and `hitLocations`.
  - [x] If equipped armor/cyberware extraction is straightforward and side-effect free, include plain arrays; otherwise document that detailed armor/cyberware snapshots are deferred to later Epic 3 plumbing.
- [x] Wire the actor sheet target payload through the normalizer. (AC: 1, 2)
  - [x] Update `module/actor/actor-sheet.js` `.fire-weapon` handler to normalize `game.users.current.targets`.
  - [x] Preserve the existing `rangedModifiers(item, targetTokens)` behavior, especially target count defaults/read-only behavior.
  - [x] Continue passing the same normalized `targetTokens` into `ModifiersDialog` and `item.__weaponRoll(fireOptions, targetTokens)`.
  - [x] Do not change melee/martial option selection or non-ranged behavior beyond receiving the same target ref shape.
- [x] Carry manual-resolution target state into the resolver context. (AC: 2)
  - [x] Update `CyberpunkItem.__buildCombatResolverContext()` only if needed so target `manualResolution` and `warnings` survive into `context.targets`.
  - [x] Use constants from `combat-outcome.js`, especially `MANUAL_RESOLUTION_REASON.missingTargetActor` and `COMBAT_WARNING_SEVERITY.warning`.
  - [x] Ensure missing-actor targets are visible as manual-resolution evidence for later resolver/chat stories, not silently ignored.
  - [x] Do not implement attack rolls, hit location resolution, damage, ammo planning, preview/confirm, or chat rendering in this story.
- [x] Extend Foundry-free fixture coverage. (AC: 1, 2)
  - [x] Add target-normalizer assertions to `tests/combat/combat-fixtures.test.js` or a focused Node test file under `tests/combat/`.
  - [x] Cover actor-backed target normalization with token UUID, actor UUID, display name, and snapshot.
  - [x] Cover actorless target normalization with token UUID/display name plus target-level manual-resolution reason and warning.
  - [x] Assert normalized targets remain plain JSON-safe data.
- [x] Preserve runtime behavior and project boundaries. (AC: 1, 2)
  - [x] Do not change legacy chat templates or create chat messages.
  - [x] Do not persist actor/item/token changes.
  - [x] Do not add package workflow, npm dependencies, TypeScript, bundlers, Jest, Vitest, or browser app scaffolding.
  - [x] Do not change `system.json`, `template.json`, migrations, compendium packs, SCSS, or CSS.
- [x] Add focused verification. (AC: 1, 2)
  - [x] Run syntax checks for changed runtime modules and changed tests.
  - [x] Run `node tests/run-combat-fixtures.mjs`.
  - [x] Static-check new/changed runtime code for forbidden persistence/chat side effects where relevant.
  - [x] Document that Foundry runtime/manual check is optional for this story unless implementation changes visible attack launch behavior.

### Review Findings

- [x] [Review][Patch] Filter equipped snapshots to equipped items only [`module/combat/target-normalizer.js`:64]

## Dev Notes

### Scope Boundary

This story is the first Epic 2 adapter story. It must only normalize selected Foundry targets into actor-aware plain resolver refs and preserve manual-resolution evidence when actor context is absent.

Do not implement single-shot attack mechanics, target-number calculation, hit/miss resolution, damage, armor, BTM, ammo planning, preview dialogs, commit behavior, or structured chat rendering. Those are Stories 2.2 through 2.6 and later Epic 3 work.

The expected outcome is that the actor sheet stops sending `{ name, id }` only and starts sending UUID-rich target references into the existing resolver adapter path. Current visible legacy roll/chat behavior should remain unchanged.

### Epic 2 Context

Epic 2 delivers an end-to-end single-shot firearm flow:

1. Story 2.1 normalizes selected targets to actor-aware references.
2. Story 2.2 resolves a structured single-shot hit/miss result.
3. Story 2.3 adds ammo planning while preserving legacy entry behavior.
4. Story 2.4 adds preview/confirm state application.
5. Story 2.5 renders single-shot combat evidence in chat.
6. Story 2.6 adds end-to-end fixtures and Foundry manual checks.

Target context must come first because later stories need target actor data for hit-location lookup, armor/BTM/wound state, and save thresholds. Missing actor context must be explicit manual-resolution state, not a silent fallback to token name/id.

### Requirements Traceability

- FR-2: combat must resolve against Target Actors, not only token names or IDs; without a Target Actor, the outcome is manual-resolution only.
- FR-9: hit location resolution later uses the target's location model, so target actor and hit-location snapshot plumbing must be available before Story 2.2.
- Architecture AD-4: replace current target payload `{ name: target.document.name, id: target.id }` with `{ tokenUuid: target.document.uuid, actorUuid: target.actor?.uuid, name: target.document.name }`.

### Current Code To Update

`module/actor/actor-sheet.js` currently builds target payloads in the `.fire-weapon` click handler:

```js
let targetTokens = Array.from(game.users.current.targets.values().map(target => {
  return {
    name: target.document.name,
    id: target.id }
}));
```

That loses actor UUID and token UUID. Replace this local mapping with the new normalizer, while preserving the existing flow:

```text
actor sheet click -> targetTokens -> rangedModifiers(item, targetTokens) -> ModifiersDialog -> item.__weaponRoll(fireOptions, targetTokens)
```

`module/lookups.js` `rangedModifiers(weapon, targetTokens = [])` currently uses only `targetTokens.length` to default and lock `targetsCount`. The normalized target shape should not break that behavior.

`module/item/item.js` already has the resolver adapter boundary:

```js
targets: (targetTokens || []).map(target => ({
  id: target.id,
  tokenUuid: target.tokenUuid || target.uuid,
  actorUuid: target.actorUuid,
  name: target.name
}))
```

If the normalizer adds `snapshot`, `manualResolution`, or `warnings`, make sure this adapter preserves those fields into `context.targets`. Do not route around `resolveCombatAction()` and do not remove the legacy fallback.

### Target Reference Shape

Use the existing `CombatTargetRef` direction from `module/combat/combat-outcome.js`:

```js
{
  id,
  tokenUuid,
  actorUuid,
  name,
  snapshot: {
    stats,
    damage,
    hitLocations
  },
  manualResolution,
  warnings
}
```

For actor-backed targets:

- `manualResolution` may be omitted or `{ required: false }`; choose the pattern that keeps the rest of the current combat contracts simplest.
- `snapshot` must be plain data copied before resolution. Do not keep live Actor/Token/Document references in resolver context.

For actorless targets:

- Preserve `id`, `tokenUuid`, and `name` if available.
- Set target-level manual resolution with `required: true`.
- Use `MANUAL_RESOLUTION_REASON.missingTargetActor`.
- Include a warning with a stable code such as `missing-target-actor`.
- Include `blockedUpdateCategories` covering target updates that later stories must not commit automatically, such as `["target-damage", "target-armor", "target-saves"]`.

### Previous Story Intelligence

Story 1.1 established plain combat contracts in `module/combat/combat-outcome.js`, including:

- `CombatTargetRef` with `tokenUuid`, `actorUuid`, `name`, and optional `snapshot`.
- `ManualResolution` with `required`, `reason`, `message`, and `blockedUpdateCategories`.
- `MANUAL_RESOLUTION_REASON.missingTargetActor`.
- `COMBAT_WARNING_SEVERITY`.

Story 1.2 changed `CyberpunkItem.__weaponRoll(attackMods, targetTokens)` to delegate through `resolveCombatAction(this.__buildCombatResolverContext(...))`, while preserving legacy fallback behavior. This story should build on that adapter; do not replace it with a new orchestration layer.

Story 1.3 added `planCombatUpdates(outcome)` and enforces that unsafe/manual target update data should produce warnings rather than document mutation. Missing target actors should prevent future target damage/armor/save updates from being auto-committed.

Story 1.4 added the current Foundry-free fixture runner:

```text
tests/combat/fixtures/ranged-single-shot.json
tests/combat/combat-fixtures.test.js
tests/run-combat-fixtures.mjs
```

Fixture learnings to preserve:

- Fixture target input should match resolver context shape.
- Resolver test stubs must not calculate production combat math that belongs in future resolver stories.
- Roll/evidence metadata should be asserted deeply when introduced.
- Invalid/manual planning cases should live in fixture data where practical.

Story 1.5 added `buildCombatChatData()` and proved chat data can represent manual status from outcome/target manual-resolution evidence. That makes target-level manual-resolution data from this story important for future Story 2.5 chat rendering.

### Architecture Compliance

- Keep Foundry-specific dereferencing at the adapter boundary (`actor-sheet` and/or a helper that can accept Foundry target objects).
- Keep resolver modules under `module/combat/` plain-data friendly and importable by Node tests.
- Runtime modules under `module/` must not use Node-only APIs.
- Do not persist document updates from target normalization.
- Do not read target actor state later than the adapter snapshot step to infer post-commit state.
- Use plain JavaScript ES modules and relative `.js` imports.
- Do not introduce tooling or dependencies.

### Testing Requirements

Required checks for this story:

```text
node --check module/combat/combat-outcome.js
node --check module/combat/combat-resolver.js
node --check module/combat/target-normalizer.js
node --check module/item/item.js
node --check module/actor/actor-sheet.js
node --check tests/combat/combat-fixtures.test.js
node --check tests/run-combat-fixtures.mjs
node tests/run-combat-fixtures.mjs
rg -n "ChatMessage|renderTemplate|new Roll|\\.update\\(|updateEmbeddedDocuments|createEmbeddedDocuments" module/combat/target-normalizer.js module/item/item.js module/actor/actor-sheet.js tests
```

Inspect `rg` matches instead of treating every match as failure. Existing actor sheet code already contains unrelated `update` calls for sheet controls; the new target normalization code must not add persistence/chat side effects.

Recommended Node test cases:

- Actor-backed fake Foundry target:
  - input has `id`, `document.uuid`, `document.name`, `actor.uuid`, and `actor.system`.
  - output has `id`, `tokenUuid`, `actorUuid`, `name`, and plain `snapshot`.
- Actorless fake Foundry target:
  - input has `id`, `document.uuid`, `document.name`, and no `actor`.
  - output has manual-resolution required with `missing-target-actor` reason and warning.
- Already-plain target ref:
  - input has `tokenUuid`, `actorUuid`, `name`, and optional `snapshot`.
  - output remains stable and JSON-safe.

Foundry runtime/manual check is useful but not mandatory if the change is limited to plain payload shape and legacy roll behavior remains unchanged. If implementation changes attack launch behavior, manually verify actor sheet attack launch with selected actor-backed and actorless tokens.

### Anti-Regression Notes

- Do not break legacy full-auto use of `targetTokens[i]` in `module/item/item.js`; richer target refs should still work as display data.
- Do not make `rangedModifiers` depend on actor fields; it should continue to use target count only unless a later story explicitly changes ranged modifier behavior.
- Do not store live Foundry `Token`, `TokenDocument`, or `Actor` objects in resolver context.
- Do not silently drop actorless targets. Manual-resolution evidence is the feature.
- Do not add template/localization changes; there is no new user-visible UI in this story.

### References

- `_bmad-output/planning-artifacts/epics.md` - Epic 2 and Story 2.1 requirements.
- `_bmad-output/planning-artifacts/architecture.md` - AD-2, AD-3, AD-4, Phase 2 target context, testing architecture, risk register.
- `_bmad-output/planning-artifacts/prds/prd-Cyberpunk2020VTT-2026-05-24/prd.md` - FR-2, FR-9, user journey UJ-1.
- `_bmad-output/planning-artifacts/prds/prd-Cyberpunk2020VTT-2026-05-24/addendum.md` - audit finding that `module/actor/actor-sheet.js` passes selected targets as name/id objects.
- `_bmad-output/implementation-artifacts/1-1-define-combatoutcome-and-resolver-input-contracts.md` - target/manual-resolution contracts.
- `_bmad-output/implementation-artifacts/1-2-add-resolver-shell-and-cyberpunkitem-adapter.md` - resolver shell and `CyberpunkItem` adapter.
- `_bmad-output/implementation-artifacts/1-4-add-deterministic-fixture-baseline.md` - fixture runner patterns.
- `_bmad-output/implementation-artifacts/1-5-add-outcome-derived-chat-contract.md` - manual-resolution status propagation into chat data.
- `_bmad-output/project-context.md` - FoundryVTT brownfield rules and no-package-workflow constraints.

## Project Structure Notes

Expected new file:

```text
module/combat/target-normalizer.js
```

Expected updates:

```text
module/actor/actor-sheet.js
module/item/item.js
tests/combat/combat-fixtures.test.js
```

Possible fixture update:

```text
tests/combat/fixtures/ranged-single-shot.json
```

Avoid touching:

```text
module/templates.js
templates/chat/
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

- Added `module/combat/target-normalizer.js` with `normalizeSelectedTargets(targets = [])` for Foundry target objects and already-plain target refs.
- Wired `module/actor/actor-sheet.js` `.fire-weapon` target collection through the normalizer while preserving `rangedModifiers`, `ModifiersDialog`, and `item.__weaponRoll()` flow.
- Updated `CyberpunkItem.__buildCombatResolverContext()` to preserve target snapshots, manual-resolution data, and warnings in resolver context.
- Extended the existing Node fixture runner with actor-backed, actorless, and plain target normalization assertions.

### Debug Log References

- `node tests/run-combat-fixtures.mjs` (red phase, failed before `target-normalizer.js` existed)
- `node --check module/combat/combat-outcome.js`
- `node --check module/combat/combat-resolver.js`
- `node --check module/combat/target-normalizer.js`
- `node --check module/item/item.js`
- `node --check module/actor/actor-sheet.js`
- `node --check tests/combat/combat-fixtures.test.js`
- `node --check tests/run-combat-fixtures.mjs`
- `node tests/run-combat-fixtures.mjs`
- `rg -n "ChatMessage|renderTemplate|new Roll|\\.update\\(|updateEmbeddedDocuments|createEmbeddedDocuments" module/combat/target-normalizer.js module/item/item.js module/actor/actor-sheet.js tests`

### Completion Notes List

- Actor-backed selected targets now produce plain refs with token UUID, actor UUID, display name, and target actor snapshot data.
- Actorless selected targets now preserve token/display identity and carry target-level manual-resolution evidence with `missing-target-actor`.
- Target normalization remains JSON-safe and importable from Node tests without Foundry globals.
- Review patch applied: equipped armor/cyberware snapshots now include only items with `system.equipped === true`.
- Existing legacy roll/chat behavior is preserved; this story does not implement attack mechanics, state mutation, preview/confirm, or chat rendering.
- Foundry runtime/manual check was not run because the change is limited to target payload shape and Foundry-free normalization coverage.

### File List

- `module/combat/target-normalizer.js`
- `module/actor/actor-sheet.js`
- `module/item/item.js`
- `tests/combat/combat-fixtures.test.js`
- `_bmad-output/implementation-artifacts/2-1-normalize-selected-targets-to-actor-aware-references.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

## Change Log

- 2026-05-25: Created Story 2.1 context and marked ready for development.
- 2026-05-25: Added actor-aware target normalization and fixture coverage.
- 2026-05-25: Addressed code review finding for equipped-only target item snapshots.
