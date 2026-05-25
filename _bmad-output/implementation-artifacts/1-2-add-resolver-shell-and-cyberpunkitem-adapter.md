# Story 1.2: Add Resolver Shell and CyberpunkItem Adapter

Status: done

<!-- Completion note: Ultimate context engine analysis completed - comprehensive developer guide created. -->

## Story

As a maintainer,
I want `CyberpunkItem` to delegate through a resolver shell while preserving legacy behavior,
so that migration can proceed incrementally without breaking existing sheets.

## Acceptance Criteria

1. Given a weapon roll launched from the current actor sheet, when the adapter receives actor, item, modifiers, and targets, then it builds resolver input snapshots and can fall back to the current legacy roll path.
2. `CyberpunkItem` remains the public entry point.

## Tasks / Subtasks

- [x] Add the resolver shell without implementing new combat rules. (AC: 1)
  - [x] Add `module/combat/combat-resolver.js`.
  - [x] Export `resolveCombatAction(context, options, roller)` or a compatible function matching the architecture intent.
  - [x] Return or route through a structured object path that can later produce `CombatOutcome`, but for this story uses legacy fallback for all current actions.
  - [x] Do not create chat messages, roll damage, mutate documents, or apply planned updates from pure resolver code.
- [x] Add a Foundry adapter boundary for current item-centric calls. (AC: 1, 2)
  - [x] Keep `CyberpunkItem.__weaponRoll(attackMods, targetTokens)` as the public method called by existing sheets.
  - [x] Build a plain resolver input context from current `CyberpunkItem`, owning actor, `attackMods`, and `targetTokens`.
  - [x] Include attacker ref/snapshot, weapon ref/snapshot, action context, current target refs, and legacy fallback metadata.
  - [x] Do not require `CyberpunkActorSheet` target UUID changes; target actor normalization belongs to Story 2.1.
- [x] Preserve current legacy behavior exactly. (AC: 1, 2)
  - [x] Extract or wrap the existing fire-mode/melee dispatch as a legacy fallback so current semi-auto, burst, full-auto, melee, and martial paths still run.
  - [x] Preserve return shapes from `__weaponRoll()` for existing callers.
  - [x] Preserve the current owned-item error behavior when a weapon has no owning actor.
  - [x] Do not change current ammo update timing, chat templates, roll formulas, target payload shape, or unsupported suppressive behavior in this story.
- [x] Connect only the minimum runtime path needed for delegation. (AC: 1, 2)
  - [x] Add a local `.js` import from `module/item/item.js` to the resolver shell if needed.
  - [x] Do not change `system.json`, `template.json`, migrations, templates, localization, compendium packs, CSS, or actor sheet behavior.
  - [x] Keep `module/combat/combat-outcome.js` as the contract source from Story 1.1.
- [x] Add focused verification for no-regression behavior. (AC: 1, 2)
  - [x] Run syntax checks for changed JS modules.
  - [x] Static-check that `CyberpunkItem.__weaponRoll()` still dispatches all current supported legacy branches.
  - [x] Static-check that no Foundry document update or `ChatMessage` call was added to pure resolver code.
  - [x] Document that no automated regression suite exists unless the implementation adds one.

### Review Findings

- [x] [Review][Patch] Clone `attackMods` before storing it in resolver context action options [module/item/item.js:223]
- [x] [Review][Patch] Do not return live data when resolver snapshot cloning fails [module/item/item.js:264]
- [x] [Review][Patch] Validate that legacy fallback is callable before invoking it [module/combat/combat-resolver.js:18]

## Dev Notes

### Scope Boundary

This story introduces the delegation seam only. It must not implement single-shot correctness, target actor UUID normalization, preview/confirm, state planner commits, damage/armor/BTM/wound rules, new chat cards, fixture runner, or suppressive fire. Those are later stories.

The expected outcome is that the current actor sheet can still call `item.__weaponRoll(fireOptions, targetTokens)`, but that method now passes through a resolver shell/adapter layer before falling back to the same legacy private methods. The visible table behavior should remain unchanged.

### Previous Story Intelligence

Story 1.1 is complete and reviewed cleanly. It added `module/combat/combat-outcome.js` with plain JSDoc contracts and constants:

- `COMBAT_CHAT_STATUS`
- `COMBAT_WARNING_SEVERITY`
- `MANUAL_RESOLUTION_REASON`
- typedefs for `CombatActionContext`, `CombatActorRef`, `ActorCombatSnapshot`, `WeaponCombatSnapshot`, `CombatWeaponRef`, `CombatTargetRef`, `RollMetadata`, `CombatWarning`, `ManualResolution`, `PlannedCombatUpdates`, `CombatTargetOutcome`, and `CombatOutcome`.

Use those typedef names in imports-for-docs or JSDoc references where useful, but do not turn this into TypeScript or runtime validation. The previous story deliberately did not wire `combat-outcome.js` into runtime. [Source: `module/combat/combat-outcome.js`; `_bmad-output/implementation-artifacts/1-1-define-combatoutcome-and-resolver-input-contracts.md`]

### Current Code To Update

Primary update file:

- `module/item/item.js`

Current behavior to preserve:

- `CyberpunkItem.roll()` calls `this.__weaponRoll()` for weapon items.
- `CyberpunkActorSheet` calls `item.__weaponRoll(fireOptions, targetTokens)` from `.fire-weapon`.
- `__weaponRoll()` checks `this.actor`, computes `isRanged`, and dispatches:
  - martial melee to `__martialBonk(attackMods)`
  - non-martial melee to `__meleeBonk(attackMods)`
  - full auto to `__fullAuto(attackMods, targetTokens)`
  - three-round burst to `__threeRoundBurst(attackMods)`
  - semi-auto to `__semiAuto(attackMods)`
- Current semi-auto, burst, and full-auto methods own rolls, chat rendering, and ammo updates. Do not move that logic yet.

Possible new files:

- `module/combat/combat-resolver.js` for the top-level shell.
- Optional `module/combat/foundry-combat-adapter.js` only if keeping adapter construction out of `item.js` reduces coupling. If added, it is Foundry-adapter code and may read Foundry documents passed to it, but should still avoid document mutation.

### Resolver Shell Requirements

Architecture names the top-level API as:

```js
export async function resolveCombatAction(context, options, roller = foundryRoller)
```

For this story, the shell may be intentionally thin:

- accept a plain context built from the item/actor/modifier/target data;
- validate that legacy fallback exists when no modern resolver is implemented;
- attach warnings/manual flags or shell metadata if useful;
- invoke the legacy fallback for all current actions;
- return the legacy result unchanged so existing callers keep working.

Do not introduce a default `foundryRoller` that directly depends on Foundry globals unless it is actually needed. This story can avoid roller implementation entirely or accept it as a future-facing optional dependency.

### Adapter Context Requirements

Build enough input context that future stories can inspect and extend it without re-reading `CyberpunkItem` internals:

- `action`: action family, fire mode, melee/martial action if available, range, targetArea, modifiers/options, source such as `"CyberpunkItem.__weaponRoll"`.
- `attacker`: actor UUID if available, actor name, and a snapshot with stats/skills/damage/hit locations only as needed for future resolver migration.
- `weapon`: item UUID if available, item name, and weapon snapshot with damage, ap, shotsLeft, rof, reliability, range, accuracy, attackType, attackSkill.
- `targets`: current `targetTokens` converted to plain refs using available fields (`id`, `name`, and any UUID/actor UUID if already present). Do not require UUIDs yet.
- `legacy`: action/fallback metadata, including the current legacy function to call or a callback that preserves `this`.

Avoid passing live `Actor`, `Item`, token, or `Roll` objects into the pure resolver shell as the primary contract. Passing a callback for legacy fallback is acceptable for this migration story, but it should be clearly marked as temporary.

### Architecture Compliance

- `CyberpunkItem` remains the compatibility entry point until a later story explicitly removes a legacy route.
- Resolver logic must be pure or pure-ish before fallback: no direct Foundry document mutation before the fallback path runs.
- Existing state changes remain in legacy methods for now; do not attempt to fix un-awaited ammo updates in this story.
- Chat output remains generated by existing legacy paths for now; Story 1.5 introduces outcome-derived chat contract.
- Do not modify actor sheet target payload in this story. Story 2.1 owns UUID-rich target references.
- Use plain JavaScript ES modules and relative `.js` imports.
- Do not add npm dependencies, TypeScript, build tooling, or a test framework.

### Testing Requirements

This repo still has no automated test harness. Required verification for this story is static and syntax-level unless the developer adds a small no-tooling check:

- `node --check module/combat/combat-outcome.js`
- `node --check module/combat/combat-resolver.js`
- `node --check module/item/item.js`
- Search `combat-resolver.js` for forbidden runtime side effects: no `ChatMessage`, no `.update(`, no `updateEmbeddedDocuments`, no `createEmbeddedDocuments`.
- Inspect `module/item/item.js` diff and confirm all current branches still exist and call the same legacy private methods.
- If no Foundry runtime check is performed, say so explicitly in Dev Agent Record.

### Anti-Regression Notes

- Do not convert `__weaponRoll()` into a behavior-changing async workflow unless return compatibility is understood. It currently returns values/promises from legacy methods; preserving that shape matters for existing callers.
- Preserve `this` binding for legacy private methods. A callback such as `() => this.__semiAuto(attackMods)` is safer than passing an unbound method.
- Do not let the resolver shell swallow exceptions from legacy methods; current error visibility should remain.
- Do not implement target actor dereferencing by name/id. If target actor is missing, future stories will mark manual resolution; this story only carries whatever current target data exists.
- Do not expose suppressive fire as newly functional. Current `__weaponRoll()` has no suppressive branch; changing that belongs to Epic 4.

### References

- `_bmad-output/planning-artifacts/epics.md` - Epic 1, Story 1.2 requirements.
- `_bmad-output/planning-artifacts/architecture.md` - AD-1, AD-2, AD-3, section 4.1, runtime flow 6.1, migration phase 1.
- `_bmad-output/planning-artifacts/prds/prd-Cyberpunk2020VTT-2026-05-24/prd.md` - FR-1 and FR-22.
- `_bmad-output/planning-artifacts/prds/prd-Cyberpunk2020VTT-2026-05-24/addendum.md` - mechanics-core extraction and known code risk areas.
- `_bmad-output/implementation-artifacts/investigations/corebook-mechanical-faithfulness-audit.md` - current `CyberpunkItem` coupling and state update risks.
- `_bmad-output/project-context.md` - FoundryVTT brownfield implementation rules.

## Project Structure Notes

Expected existing file from Story 1.1:

```text
module/combat/combat-outcome.js
```

Expected new/update files for this story:

```text
module/combat/combat-resolver.js
module/item/item.js
```

Optional if needed:

```text
module/combat/foundry-combat-adapter.js
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
- `node --check module/item/item.js`
- `rg -n "ChatMessage|\\.update\\(|updateEmbeddedDocuments|createEmbeddedDocuments|new Roll|Multiroll|game\\.|ui\\." module/combat/combat-resolver.js`
- `rg -n "__weaponRoll\\(|__buildCombatResolverContext|__legacyWeaponRoll|resolveCombatAction|__semiAuto|__threeRoundBurst|__fullAuto|__meleeBonk|__martialBonk" module/item/item.js`

### Completion Notes List

- Added `module/combat/combat-resolver.js` as a thin migration shell. It requires a legacy fallback and returns that fallback result unchanged.
- Updated `CyberpunkItem.__weaponRoll()` to delegate through `resolveCombatAction()` while preserving `CyberpunkItem` as the public entry point.
- Added `CyberpunkItem.__buildCombatResolverContext()` to capture action, attacker, weapon, target, and legacy fallback metadata as a plain resolver input context.
- Moved the original branch dispatch into `CyberpunkItem.__legacyWeaponRoll()` and preserved existing semi-auto, burst, full-auto, melee, martial, and unsupported suppressive behavior.
- Verification completed with syntax checks and static side-effect/dispatch inspection. No automated regression suite exists in this repo, and Foundry runtime was not opened.
- Resolved code review findings: cloned `attackMods` for resolver context options, prevented clone failures from returning live data into snapshots, and validated legacy fallback callability before invocation.

### File List

- `module/combat/combat-resolver.js`
- `module/item/item.js`
- `_bmad-output/implementation-artifacts/1-2-add-resolver-shell-and-cyberpunkitem-adapter.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

## Change Log

- 2026-05-24: Added resolver shell delegation with legacy fallback and moved Story 1.2 to review.
- 2026-05-24: Addressed code review findings for resolver context immutability and fallback validation.
