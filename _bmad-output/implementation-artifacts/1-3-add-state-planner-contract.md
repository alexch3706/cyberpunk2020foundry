# Story 1.3: Add State Planner Contract

Status: done

<!-- Completion note: Ultimate context engine analysis completed - comprehensive developer guide created. -->

## Story

As a maintainer,
I want combat state changes represented as planned updates before commit,
so that ammo, damage, armor, and wound state cannot silently diverge from chat.

## Acceptance Criteria

1. Given a resolver outcome with state deltas, when the state planner receives the outcome, then it returns explicit actor/item/embedded item update plans.
2. Pure resolver modules do not mutate Foundry documents directly.

## Tasks / Subtasks

- [x] Add a pure state planner contract module. (AC: 1, 2)
  - [x] Add `module/combat/state-planner.js`.
  - [x] Export a function such as `planCombatUpdates(outcome, options = {})`.
  - [x] Return a plain planned-update object with `actorUpdates`, `itemUpdates`, `embeddedItemUpdates`, and `chatStatus`.
  - [x] Do not import Foundry document classes, call Foundry globals, create chat, roll dice, or mutate documents.
- [x] Align the planner output with the Story 1.1 contracts. (AC: 1)
  - [x] Reuse the `PlannedCombatUpdates` shape from `module/combat/combat-outcome.js` in JSDoc.
  - [x] Support explicit actor update entries keyed by `actorUuid`.
  - [x] Support explicit item update entries keyed by `itemUuid`.
  - [x] Support explicit embedded item update batches keyed by owner `actorUuid` and embedded document `type`.
  - [x] Represent commit status as `"preview"`, `"committed"`, `"canceled"`, or `"manual"` without performing commit.
- [x] Define state delta ingestion without implementing damage rules. (AC: 1, 2)
  - [x] Accept an outcome that may already contain `plannedUpdates` at top-level, per target, or in future delta arrays.
  - [x] Coalesce compatible update entries for the same actor/item target where this is unambiguous.
  - [x] Preserve conflicting update entries or warnings rather than silently overwriting different values for the same path.
  - [x] Return warnings/manual metadata if an update cannot be planned safely.
- [x] Preserve current runtime behavior. (AC: 2)
  - [x] Do not wire `state-planner.js` into `CyberpunkItem.__weaponRoll()` yet.
  - [x] Do not change current ammo update timing, chat templates, roll formulas, target payload shape, or legacy fallback behavior.
  - [x] Do not change `system.json`, `template.json`, migrations, templates, localization, compendium packs, CSS, or actor sheet behavior.
- [x] Add focused verification. (AC: 1, 2)
  - [x] Run syntax checks for `module/combat/combat-outcome.js`, `module/combat/combat-resolver.js`, and `module/combat/state-planner.js`.
  - [x] Static-check `state-planner.js` for forbidden side effects: no `ChatMessage`, no `.update(`, no `updateEmbeddedDocuments`, no `createEmbeddedDocuments`, no `game`, no `ui`.
  - [x] Static-check that `state-planner.js` is not imported into runtime combat paths unless implementation explicitly keeps behavior unchanged.
  - [x] Document that no automated regression suite exists unless the implementation adds one.

### Review Findings

- [x] [Review][Patch] Explicit chat status override can be overwritten by planned updates [module/combat/state-planner.js:16]
- [x] [Review][Patch] Unserializable merged update values can be emitted as `undefined` after warning [module/combat/state-planner.js:133]
- [x] [Review][Patch] JSON cloning silently drops or changes unsupported update values without warning [module/combat/state-planner.js:146]
- [x] [Review][Patch] Plain-data equality is key-order sensitive and can create false conflicts [module/combat/state-planner.js:161]
- [x] [Review][Patch] Parent and child update paths for the same document are coalesced without conflict warning [module/combat/state-planner.js:119]
- [x] [Review][Patch] Embedded item updates for the same `_id` and path can conflict silently [module/combat/state-planner.js:87]

## Dev Notes

### Scope Boundary

This story adds the planning contract for future state commits. It must not implement Foundry commit behavior, preview dialog behavior, damage/armor/BTM/wound rules, chat rendering, target actor normalization, or fixture runner behavior. Those are later stories.

The planner should be pure or pure-ish: it accepts plain outcome/delta data and returns plain update-plan data. It should not receive live `Actor`, `Item`, `Token`, `Roll`, or `ChatMessage` objects as required inputs.

### Previous Story Intelligence

Story 1.1 added `module/combat/combat-outcome.js`, including JSDoc contracts for `PlannedCombatUpdates`, `ActorUpdatePlan`, `ItemUpdatePlan`, `EmbeddedItemUpdatePlan`, `CombatOutcome`, warnings, and manual resolution.

Story 1.2 added `module/combat/combat-resolver.js` and changed `CyberpunkItem.__weaponRoll()` to delegate through a resolver shell while preserving legacy fallback. Important learnings from review:

- Resolver context data should avoid live object aliases. `attackMods` is cloned before being stored in context options.
- Clone failures should not silently return live data into resolver snapshots.
- Legacy fallback callability is explicitly validated before invocation.

Keep those constraints in Story 1.3: the state planner should never return live document objects or silently mutate/overwrite state. [Source: `module/combat/combat-outcome.js`, `module/combat/combat-resolver.js`, `module/item/item.js`, `_bmad-output/implementation-artifacts/1-2-add-resolver-shell-and-cyberpunkitem-adapter.md`]

### Required Planner Shape

Architecture defines planned updates as first-class data:

```js
{
  actorUpdates: [
    { actorUuid, update: { "system.damage": 9 } }
  ],
  itemUpdates: [
    { itemUuid, update: { "system.shotsLeft": 8 } }
  ],
  embeddedItemUpdates: [
    { actorUuid, type: "Item", updates: [{ _id, "system.coverage.Torso.ablation": 1 }] }
  ],
  chatStatus: "preview" // "preview" | "committed" | "canceled" | "manual"
}
```

The commit layer in later stories will execute these operations through Foundry APIs in deterministic order: attacker item ammo, target armor/staged penetration, target wound/damage, save state if persisted, then chat create/update. Story 1.3 should document or encode that ordering intent, but not perform it. [Source: `_bmad-output/planning-artifacts/architecture.md` AD-6]

### Planner Input Guidance

Prefer a tolerant contract that supports future resolver evolution:

- If `outcome.plannedUpdates` exists, normalize it into the returned plan.
- If target outcomes contain `target.plannedUpdates`, include those target-level updates.
- If future outcomes include explicit deltas such as `actorDeltas`, `itemDeltas`, or `embeddedItemDeltas`, define the expected shape in JSDoc or comments but keep implementation minimal.
- If the same actor/item receives multiple updates for different paths, coalesce them into one update object.
- If the same actor/item/path receives conflicting values, do not silently choose one. Return both entries separately or attach a warning/manual metadata entry, depending on the implementation approach.

Do not calculate damage, armor ablation, ammo deltas, wound thresholds, or save prompts in this story. The planner consumes already-decided state changes; it does not create rule outcomes.

### Current Code To Preserve

Runtime files from Story 1.2:

- `module/combat/combat-resolver.js` is a thin shell that calls `context.legacy.fallback(...)`.
- `module/item/item.js` builds resolver context in `__buildCombatResolverContext()` and preserves old combat dispatch in `__legacyWeaponRoll()`.

Do not wire the new state planner into `__weaponRoll()` yet. Legacy methods still own current ammo updates and chat output until later migration stories.

### Architecture Compliance

- Pure resolver/planner modules must not directly mutate Foundry documents.
- Persisted updates must eventually be planned first, then committed through awaited Foundry document APIs in a separate adapter/commit layer.
- Chat output must eventually derive from `CombatOutcome` and planned/committed state, but Story 1.5 owns the chat contract.
- Use plain JavaScript ES modules and relative `.js` imports.
- Do not add npm dependencies, TypeScript, build tooling, or a test framework.
- Keep `CyberpunkItem` as the compatibility entry point.

### Testing Requirements

This repo still has no automated test harness. For this story, required verification is static unless implementation adds a small no-tooling check:

- `node --check module/combat/combat-outcome.js`
- `node --check module/combat/combat-resolver.js`
- `node --check module/combat/state-planner.js`
- `rg -n "ChatMessage|\\.update\\(|updateEmbeddedDocuments|createEmbeddedDocuments|game\\.|ui\\." module/combat/state-planner.js` should return no matches.
- `rg -n "state-planner|planCombatUpdates" module/item module/actor module/combat` should show no unexpected runtime wiring beyond the new module and optional doc references.
- If no Foundry runtime check is performed, state that explicitly in Dev Agent Record.

### Anti-Regression Notes

- Do not “fix” current direct/un-awaited ammo updates in legacy methods here. That would be behavior-changing and belongs to later state discipline stories.
- Do not return live Foundry document instances in planned update entries; use UUIDs and plain update payloads.
- Do not use object-path helpers that mutate source `outcome` data in place.
- Do not silently overwrite conflicting update paths during coalescing.
- Do not make preview/confirm semantics depend on this module yet; this story only defines the plan shape.

### References

- `_bmad-output/planning-artifacts/epics.md` - Epic 1, Story 1.3 requirements.
- `_bmad-output/planning-artifacts/architecture.md` - AD-5, AD-6, section 4.7, migration phase 1.
- `_bmad-output/planning-artifacts/prds/prd-Cyberpunk2020VTT-2026-05-24/prd.md` - FR-3 and FR-22.
- `_bmad-output/planning-artifacts/prds/prd-Cyberpunk2020VTT-2026-05-24/addendum.md` - `commitCombatResult` direction and state consistency risks.
- `_bmad-output/implementation-artifacts/investigations/corebook-mechanical-faithfulness-audit.md` - current state update risks in item methods and migrations.
- `_bmad-output/project-context.md` - FoundryVTT brownfield implementation rules.

## Project Structure Notes

Expected existing files:

```text
module/combat/combat-outcome.js
module/combat/combat-resolver.js
module/item/item.js
```

Expected new file:

```text
module/combat/state-planner.js
```

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

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- `node --check module/combat/combat-outcome.js`
- `node --check module/combat/combat-resolver.js`
- `node --check module/combat/state-planner.js`
- `rg -n "ChatMessage|\\.update\\(|updateEmbeddedDocuments|createEmbeddedDocuments|game\\.|ui\\." module/combat/state-planner.js`
- `rg -n "state-planner|planCombatUpdates" module/item module/actor module/combat`
- `node --input-type=module -e 'import { planCombatUpdates } from "./module/combat/state-planner.js"; ...'`
- `node --input-type=module -e 'import { planCombatUpdates } from "./module/combat/state-planner.js"; ...'` review smoke for chat status override, JSON-safe data, key-order equality, parent/child path conflicts, and embedded item conflicts.

### Completion Notes List

- Added `module/combat/state-planner.js` with `planCombatUpdates(outcome, options = {})`.
- The planner normalizes top-level, target-level, and future delta update entries into explicit `actorUpdates`, `itemUpdates`, `embeddedItemUpdates`, and `chatStatus` fields.
- Compatible actor/item updates for the same UUID are coalesced. Conflicting update paths are preserved as separate entries with warnings instead of silently overwritten.
- Invalid or unserializable update data is skipped with warnings, preventing live Foundry document data from being returned through the plan.
- No runtime combat path was wired to the planner; current legacy ammo/chat/roll behavior is unchanged.
- Verification completed with syntax checks, static side-effect/runtime-wiring checks, and a small Node smoke check for coalescing/conflict behavior. No automated regression suite exists, and Foundry runtime was not opened.
- Code review patches completed: explicit `options.chatStatus` now wins after normalization, JSON-unsafe payloads warn and are skipped without emitting `undefined`, same-value object comparisons are key-order stable, and parent/child plus embedded item update conflicts stay separate with warnings.

### File List

- `module/combat/state-planner.js`
- `_bmad-output/implementation-artifacts/1-3-add-state-planner-contract.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

## Change Log

- 2026-05-24: Added pure state planner contract module and moved Story 1.3 to review.
- 2026-05-24: Applied code review fixes and moved Story 1.3 to done.
