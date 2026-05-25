---
stepsCompleted: [1]
inputDocuments:
  - _bmad-output/planning-artifacts/prds/prd-Cyberpunk2020VTT-2026-05-24/prd.md
  - _bmad-output/planning-artifacts/prds/prd-Cyberpunk2020VTT-2026-05-24/addendum.md
  - _bmad-output/implementation-artifacts/investigations/corebook-mechanical-faithfulness-audit.md
  - _bmad-output/project-context.md
  - docs/architecture.md
workflowType: 'architecture'
project_name: 'Cyberpunk2020VTT'
user_name: 'Alex'
date: '2026-05-24'
status: 'complete'
---

# Architecture Decision Document

## 1. Executive Summary

Cyberpunk2020VTT will add a Core Combat Fidelity MVP through an incremental mechanics resolver, not a system rewrite. The resolver becomes the rules spine for Cyberpunk 2020 combat while the existing Foundry document classes, sheets, Handlebars templates, settings, and chat-card patterns remain in place.

The main architectural change is to move combat correctness out of `module/item/item.js` into testable domain modules under `module/combat/`. `CyberpunkItem` remains the public entry point for weapon rolls during migration, but it delegates to resolver functions that produce a structured `CombatOutcome`. Foundry-specific state writes and chat rendering happen through explicit adapter/commit code after preview and confirmation.

The MVP prioritizes:

- FoundryVTT brownfield fit with plain JavaScript ES modules and existing document APIs.
- Testable mechanics that can run without opening actor or item sheets.
- Target Actor-aware damage resolution.
- Preview/confirm application for damage, armor ablation/staged penetration, ammo, wound state, and save prompts.
- A staged migration from current item-centric combat methods to resolver-backed orchestration.

## 2. Architectural Constraints

- The project remains a FoundryVTT system package loaded through `system.json`; no separate app runtime, bundler, TypeScript migration, or frontend framework is introduced for MVP.
- Runtime code remains plain JavaScript ES modules under `module/`.
- Existing `CyberpunkActor`, `CyberpunkItem`, `CyberpunkActorSheet`, `CyberpunkItemSheet`, `ModifiersDialog`, `Multiroll`, and Handlebars chat templates remain valid integration surfaces.
- Persisted actor/item data changes must use Foundry document APIs such as `update()` and `updateEmbeddedDocuments()`.
- Direct mutation is allowed only for derived transient data during `prepareData`.
- Existing actors/items must continue loading. Any `template.json` shape changes require migration review.
- Combat correctness must be fixture-testable outside a live Foundry sheet wherever possible.

## 3. Core Decisions

### AD-1: Introduce `module/combat/` Resolver Modules

Create a new combat domain folder:

```text
module/combat/
  combat-resolver.js
  attack-resolver.js
  hit-location-resolver.js
  armor-resolver.js
  damage-resolver.js
  save-resolver.js
  state-planner.js
  combat-outcome.js
  combat-chat.js
  martial-arts-data.js
```

`module/item/item.js` will call the new modules instead of directly owning attack, damage, ammo, location, armor, wounds, saves, and chat rendering.

Rationale: the audit shows current combat logic is fragmented inside item methods. A separate resolver makes mechanics auditable, reusable, and fixture-testable without changing Foundry's public document model.

### AD-2: Use a Structured `CombatOutcome`

Supported combat actions return a plain object outcome with stable sections:

```js
{
  action: { type, fireMode, options },
  attacker: { actorUuid, tokenUuid, name },
  weapon: { itemUuid, name, snapshot },
  targets: [
    {
      tokenUuid,
      actorUuid,
      name,
      attack,
      hits,
      damage,
      saves,
      plannedUpdates,
      warnings
    }
  ],
  ammo,
  pendingDecisions,
  manualResolution,
  chat
}
```

The outcome is the single source for chat evidence, preview UI, tests, and eventual commit.

Rules:

- Resolver functions never create chat messages directly.
- Resolver functions never persist actor/item state directly.
- Outcome values include intermediate evidence: attack total, natural die metadata, DC/opposed result, hit location, raw damage, effective SP, AP behavior, BTM reduction, final damage, wound transition, save requirements, ammo delta, and warnings.

### AD-3: Split Pure Mechanics from Foundry Adapters

The resolver has two layers:

- Mechanics layer: accepts snapshots and option data, returns `CombatOutcome`.
- Foundry adapter layer: dereferences selected tokens/actors/items, converts documents into snapshots, builds planned updates, renders chat, and commits Foundry updates.

Mechanics modules should avoid direct dependency on `game`, `ui`, `ChatMessage`, `Actor`, `Item`, or sheet classes. Foundry-specific calls belong in adapter/orchestration code reached from `CyberpunkItem` and `CyberpunkActorSheet`.

This is the main testability boundary.

### AD-4: Target Selection Passes Token/Actor Context

Replace the current target payload:

```js
{ name: target.document.name, id: target.id }
```

with target references that preserve actor context:

```js
{
  tokenUuid: target.document.uuid,
  actorUuid: target.actor?.uuid,
  name: target.document.name
}
```

The adapter resolves target actors before combat resolution. If no actor is available, the outcome is marked `manualResolution` and damage application is not offered.

### AD-5: Preview/Confirm Is Required for Damage Application

Damage application must use a preview/confirm step in the first release. The first implementation should use a lightweight Foundry `Dialog`, not a sheet redesign.

Flow:

1. User selects weapon/action options.
2. Resolver creates `CombatOutcome`.
3. Chat may show a preview card marked pending/manual.
4. Dialog displays per-target planned damage, armor changes, ammo change, wound transition, and saves.
5. User confirms or cancels.
6. Commit layer awaits all document updates.
7. Final chat record reflects committed or canceled status.

Ammo may be included in the same confirm step for consistency. If product preference later requires ammo to spend on attack even when damage commit is canceled, that becomes an explicit setting/decision.

### AD-6: Planned Updates Are First-Class

Use `state-planner.js` to translate outcomes into explicit update operations:

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
  chatStatus: "preview" | "committed" | "canceled"
}
```

The commit function executes these operations through Foundry APIs and awaits them in deterministic order:

1. Attacker item ammo updates.
2. Target armor/staged penetration updates.
3. Target wound/damage updates.
4. Save tracking/status prompts, if represented as persisted state.
5. Chat creation or chat update.

### AD-7: Armor Is Calculated at Resolution Time

`CyberpunkActor.prepareData()` may keep display-only stopping power summaries, but the resolver must calculate effective armor from equipped armor items at the hit location.

Armor snapshots include:

- Armor item id/name/source.
- Coverage by hit location.
- SP and ablation/staged penetration value.
- Layer category when available.
- Equipped state.

Layered armor, AP, cover, and staged penetration are resolved in `armor-resolver.js`. Do not rely on pre-summed `system.hitLocations[area].stoppingPower` for rules correctness.

### AD-8: Corebook Fidelity Settings

Add world settings in `module/settings.js`:

- `corebookFidelityMode`: default `true`.
- `stagedPenetration`: default `true`.
- `combatDamageCommitMode`: default `"previewConfirm"` for MVP.

Unsupported exposed modes must be hidden, disabled, or marked manual in Corebook Fidelity Mode. Suppressive fire should not remain a selectable no-op.

### AD-9: Tests Use Fixture-First Plain JS

Add a lightweight fixture test harness that can run outside Foundry. Because the repo has no package workflow today, keep this deliberately small:

```text
tests/
  combat/
    fixtures/
      ranged-single-shot.json
      armor-ap-btm.json
      burst-full-auto.json
      suppressive-fire.json
      melee-martial.json
    combat-fixtures.test.js
  run-combat-fixtures.mjs
```

The test runner can use Node's built-in `node:test` if a package workflow is later introduced, but resolver modules should be structured so the fixture runner does not need a Foundry world. Foundry globals must be injected or avoided.

Fixture coverage must include the suggested PRD/addendum cases: unarmored damage, full armor stop, BTM minimum damage, AP, head hit, limb threshold, wound transitions, stun/death saves, burst ammo/hit count, full-auto target rounding, suppressive fire, opposed melee, martial prerequisites, and humanity persistence.

## 4. Component Architecture

### 4.1 `combat-resolver.js`

Top-level orchestrator for supported combat actions.

Responsibilities:

- Validate action type and required context.
- Route to ranged, automatic fire, suppressive fire, melee, or martial resolution.
- Normalize target outcomes into one `CombatOutcome`.
- Attach warnings/manual flags.

Public API:

```js
export async function resolveCombatAction(context, options, roller = foundryRoller)
```

`roller` is injected so tests can use deterministic rolls.

### 4.2 `attack-resolver.js`

Responsibilities:

- Build ranged and melee attack terms from attacker snapshot, weapon snapshot, range, modifiers, and action context.
- Preserve natural d10 metadata for critical/fumble behavior.
- Calculate range DCs and opposed melee results.
- Resolve reliability/jam outcomes for automatic weapons on fumble.

Output includes:

- Natural roll sequence.
- Total.
- Modifiers by named source.
- DC or opposed defender roll.
- Hit/miss.
- Fumble/critical/jam details.

### 4.3 `hit-location-resolver.js`

Responsibilities:

- Resolve random locations using target actor location lookup.
- Resolve aimed locations after the attack penalty has already been included.
- Preserve head and limb metadata for damage resolver.
- Fall back to default CP2020 locations only when no target-specific model exists, with warning.

### 4.4 `armor-resolver.js`

Responsibilities:

- Collect equipped armor layers covering the hit location.
- Apply proportional armor rules.
- Apply AP armor halving and penetrating damage halving.
- Apply manual cover SP when supplied in action options.
- Plan staged penetration/ablation updates only when damage penetrates.
- Flag invalid hard/soft layer combinations in Corebook Fidelity Mode.

### 4.5 `damage-resolver.js`

Responsibilities:

- Roll or accept raw damage per hit.
- Apply armor output.
- Apply head-hit and limb special cases.
- Apply BTM after armor.
- Enforce minimum penetrating damage.
- Calculate wound-box delta and wound-state transition.

### 4.6 `save-resolver.js`

Responsibilities:

- Determine Stun/Shock save requirements from Body Type and wound state.
- Determine Death Save requirements from Body Type and Mortal level.
- Represent immediate save prompts and recurring Mortal wound reminders.
- Keep save roll execution separable from damage application.

### 4.7 `state-planner.js`

Responsibilities:

- Convert outcome deltas into Foundry update operations.
- Coalesce repeated updates per actor/item.
- Prevent direct mutation of document `system` state.
- Return update batches for preview and commit.

### 4.8 `combat-chat.js`

Responsibilities:

- Convert `CombatOutcome` into template data.
- Render preview, committed, canceled, and manual-resolution chat states.
- Keep existing `Multiroll` usable where practical, but do not require every combat outcome to be a `Multiroll`.

Expected templates:

```text
templates/chat/combat-outcome.hbs
templates/chat/combat-damage-preview.hbs
```

Existing `default-roll.hbs` and `multi-hit.hbs` may remain for legacy paths during migration.

### 4.9 `martial-arts-data.js`

Responsibilities:

- Define corebook martial styles and key technique bonuses as inspectable data.
- Distinguish Brawling from trained martial arts.
- Support action prerequisite checks for grapple, hold, choke, throw, escape, block/parry, dodge, disarm, and sweep/trip.

## 5. Data Model Strategy

### 5.1 Prefer Snapshots Over Template Churn

Initial resolver work should derive snapshots from current actor/item data instead of immediately expanding `template.json`.

Safe snapshot fields:

- Actor stats, wound damage, hit locations, skills, equipped armor/cyberware.
- Weapon damage, AP flag, shots left, ROF, reliability, range, accuracy, attack type, attack skill.
- Armor coverage, SP, ablation, equipped state, encumbrance, source.

### 5.2 Minimal Template Additions

Only add persisted fields when mechanics require state that cannot be derived:

- Armor layer category, if hard/soft validation is enforced.
- Corebook conformance labels for items.
- Optional recurring Mortal wound tracking, if implemented as persisted actor state.

Any template addition must include migration review and old-data defaults.

### 5.3 Corebook Conformance Labels

Add item metadata without splitting packs:

```js
system.source
system.conformance = {
  scope: "corebook" | "extended" | "unknown",
  verified: false,
  notes: ""
}
```

If changing `template.json` is deferred, compute equivalent labels from `source` for display and audit first, then persist after migration design.

## 6. Main Runtime Flows

### 6.1 Ranged Single Shot

1. `CyberpunkActorSheet` gathers selected target token/actor UUIDs.
2. `ModifiersDialog` returns range, aimed location, cover, and modifiers.
3. `CyberpunkItem.__weaponRoll()` delegates to `resolveCombatAction()`.
4. Resolver rolls attack, determines hit, resolves location, armor, AP, BTM, wounds, and saves.
5. `state-planner.js` creates ammo, armor, and target damage updates.
6. Preview dialog displays planned updates.
7. Commit applies updates with awaited Foundry APIs.
8. Chat renders structured evidence.

### 6.2 Three-Round Burst

Resolver fires up to three rounds or remaining ammo, applies the close/medium modifier, resolves success, rolls correct hit count, resolves each hit independently, and plans one ammo update.

### 6.3 Full Auto

Resolver calculates total rounds fired once, floors per-target rounds for multi-target fire, applies per-target attack modifiers/range when available, caps hits by rounds fired and success margin, resolves damage per hit, and plans one ammo update.

### 6.4 Suppressive Fire

Resolver requires fire-zone width and rounds fired. Targets roll or are prompted for Athletics + REF + 1d10 against rounds divided by zone width. Failed saves receive random round count, hit locations, damage resolution, and planned ammo update.

### 6.5 Melee and Martial Actions

Resolver performs opposed rolls using attacker and defender snapshots. Martial actions use action definitions and key technique data. Damage is resolved only when the opposed result and action rules permit it. Grapple prerequisites and escape/hold/choke/throw state are explicit warnings or pending decisions until enough state exists to automate them.

## 7. Brownfield Migration Plan

### Phase 1: Establish Resolver Skeleton

- Add `module/combat/` modules with pure data contracts.
- Add deterministic fixture runner and initial tests for range DCs, hit locations, BTM, and damage/wound thresholds.
- Keep existing item roll methods functional.

### Phase 2: Target Context and Single-Shot Preview

- Change actor sheet target payload to UUID-rich target references.
- Implement single-shot ranged resolver.
- Add preview/confirm dialog.
- Commit ammo and target damage through awaited updates.
- Render structured combat outcome chat.

### Phase 3: Armor, AP, BTM, Wounds, Saves

- Move armor calculation into `armor-resolver.js`.
- Add AP and staged penetration setting.
- Add wound transition and save prompt output.
- Stop using pre-summed actor armor values for rules decisions.

### Phase 4: Automatic Fire

- Replace current three-round burst and full-auto item methods with resolver-backed flows.
- Implement suppressive fire or disable/hide it until resolver support is complete.
- Fix ammo accounting as one planned update per action.

### Phase 5: Melee and Martial Arts

- Implement opposed melee.
- Add martial action definitions and key technique data.
- Implement prerequisite/pending-decision behavior for grapple family actions.

### Phase 6: Cleanup Legacy Item Methods

- Remove or shrink `__semiAuto`, `__threeRoundBurst`, `__fullAuto`, `__meleeBonk`, and `__martialBonk` after all routes delegate to resolver modules.
- Keep `CyberpunkItem.roll()` and `__weaponRoll()` as compatibility entry points.

## 8. Testing Architecture

Resolver tests should validate plain data outcomes:

- Attack totals and natural die metadata.
- Range DC and modifier application.
- Fumble/jam behavior.
- Hit locations with default and target-specific schemas.
- Armor layering, AP, cover, and staged penetration.
- BTM and minimum damage.
- Wound state transitions.
- Stun and Death Save thresholds.
- Burst/full-auto/suppressive ammo and hit counts.
- Opposed melee and martial prerequisite paths.

Foundry manual checks remain necessary for:

- Dialog rendering.
- Target UUID dereference.
- Document update persistence.
- Chat card rendering.
- Sheet refresh behavior.

## 9. Risks and Mitigations

| Risk | Mitigation |
| --- | --- |
| Resolver accidentally depends on Foundry globals and becomes untestable | Keep snapshot conversion and commit code separate from mechanics modules |
| Chat output and persisted state diverge | Generate chat evidence from the same `CombatOutcome` and `plannedUpdates` used for commit |
| Armor display values conflict with resolver armor | Mark actor-prepared armor totals as display-only and calculate effective SP from equipped armor snapshots |
| Existing worlds have missing fields | Use defensive snapshot defaults and migrations only for new persisted fields |
| Suppressive fire remains a selectable no-op | Implement resolver before exposure, or disable in Corebook Fidelity Mode |
| Preview cancel semantics confuse ammo spending | Treat commit/cancel behavior as explicit in `combatDamageCommitMode` and chat status |
| No current test workflow | Start with small fixture runner instead of introducing broad tooling |

## 10. Implementation Guardrails

- Do not introduce TypeScript, bundlers, or a new frontend stack for this MVP.
- Do not rewrite actor/item sheets before resolver behavior exists.
- Do not commit Foundry document updates from pure resolver modules.
- Do not rely on token names for target mechanics.
- Do not expose unsupported combat modes as functional controls.
- Do not update `template.json` without migration review.
- Do not mutate actor/item `system` data directly outside derived preparation.
- Do not duplicate rule formulas between chat templates, item methods, and resolver modules.

## 11. Acceptance Criteria Mapping

- FR-1 through FR-3: satisfied by `CombatOutcome`, state planner, and preview/confirm commit.
- FR-4 through FR-8: satisfied by attack resolver and automatic fire/suppressive flows.
- FR-9 through FR-14: satisfied by hit-location, armor, damage, and save resolvers.
- FR-15 through FR-18: satisfied by opposed melee and martial data/action resolver.
- FR-19 through FR-20: satisfied by conformance labels and Corebook Fidelity Mode visibility rules.
- FR-21 through FR-22: satisfied by fixture harness and awaited Foundry update discipline.

## 12. First Story Slice Recommendation

The first implementation story should be narrow:

1. Add `module/combat/` skeleton and fixture runner.
2. Implement deterministic single-shot damage against an actor snapshot.
3. Support unarmored target, armored full stop, AP, BTM minimum, wound transition, and save prompt fixtures.
4. Wire one existing semi-auto weapon path to preview/confirm damage application.

This validates the architecture's most important bet before migrating automatic fire or martial arts.
