# Story 1.1: Define CombatOutcome and Resolver Input Contracts

Status: done

<!-- Completion note: Ultimate context engine analysis completed - comprehensive developer guide created. -->

## Story

As a maintainer,
I want stable combat resolver input and output contracts,
so that future combat rules can be implemented without scattering state, chat, and formula logic across item methods.

## Acceptance Criteria

1. Given the existing item-centric combat code, when `module/combat/` contracts are added, then `CombatOutcome`, combat context, target reference, roll metadata, planned update, warning, and manual-resolution shapes are documented in code.
2. No existing weapon roll behavior changes.

## Tasks / Subtasks

- [x] Add the combat contract module without wiring it into runtime behavior. (AC: 1, 2)
  - [x] Create `module/combat/` if it does not exist.
  - [x] Add a plain JavaScript ES module for contract definitions, expected path `module/combat/combat-outcome.js`.
  - [x] Keep the module self-contained: no imports from Foundry globals, document classes, item methods, chat APIs, or Node-only APIs.
- [x] Document resolver input contracts with JSDoc typedefs and minimal exported helpers/constants only where useful. (AC: 1)
  - [x] Define combat context/action shape: action type, fire mode or melee action, options, range/modifier context, and source metadata.
  - [x] Define attacker, weapon, and target reference shapes using UUID-capable references, not target token names alone.
  - [x] Define snapshot-oriented input shapes for actor/item/target data; do not require persisted template changes in this story.
- [x] Document `CombatOutcome` output contract. (AC: 1)
  - [x] Include action, attacker, weapon, targets, ammo, pending decisions, manual resolution, chat status/evidence, and top-level warnings.
  - [x] For each target outcome, include attack result, hit records, damage evidence, save prompts/results, planned updates, warnings, and manual-resolution reason where applicable.
  - [x] Include roll metadata for formulas, totals, natural die data, critical/fumble/jam flags, and deterministic test injection needs.
- [x] Document planned state update contract without implementing commit behavior. (AC: 1, 2)
  - [x] Include actor updates, item updates, embedded item updates, chat status, and deterministic commit-order intent.
  - [x] State that persisted Foundry updates are planned first and committed later through awaited document APIs.
- [x] Add lightweight static verification notes or examples. (AC: 1, 2)
  - [x] Include sample object snippets in JSDoc or module comments where they clarify shape.
  - [x] Verify existing weapon roll paths are not imported from, called by, or changed by the new contract module.

## Dev Notes

### Scope Boundary

This is a foundation story. It creates contract documentation for later resolver work; it must not migrate mechanics, change user-facing behavior, add UI, create chat cards, alter ammo spending, or apply target damage. Story 1.2 will add the resolver shell and `CyberpunkItem` adapter. Story 1.3 will add the state planner contract. Story 1.4 will add deterministic fixture baseline.

### Required Contract Concepts

The architecture defines `CombatOutcome` as the single source for chat evidence, preview UI, tests, and eventual commit. The contract should cover these stable sections:

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

The final implementation can refine property names, but it must preserve the concept that attack evidence, natural die metadata, DC/opposed result, hit location, raw damage, effective SP, AP behavior, BTM reduction, final damage, wound transition, save requirements, ammo delta, warnings, and manual-resolution state have structured homes. [Source: `_bmad-output/planning-artifacts/architecture.md` AD-2]

### Input Shape Requirements

Combat inputs should be snapshot-oriented and plain-data friendly:

- `CombatActionContext`: action type, fire mode, selected attack options, target area, range/modifier context, and mode-specific options.
- `CombatActorRef`: `actorUuid`, optional `tokenUuid`, `name`.
- `CombatWeaponRef`: `itemUuid`, `name`, weapon snapshot.
- `CombatTargetRef`: `tokenUuid`, optional `actorUuid`, `name`, and enough target snapshot data for later armor, BTM, wound, save, and hit-location work.
- `RollMetadata`: formula, terms where available, total, natural die result(s), critical/fumble flags, reliability/jam flags where later stories can populate them.
- `ManualResolution`: boolean/status plus reason code/message and blocked update categories.
- `CombatWarning`: stable code, severity, message/localization key, source path or rule/audit reference where applicable.

Do not require target actor context to be fully available in this story. The contract should allow later stories to mark an outcome manual when no target actor is available. [Source: `_bmad-output/planning-artifacts/prds/prd-Cyberpunk2020VTT-2026-05-24/prd.md` FR-2]

### Planned Update Contract

Represent planned updates as plain data, not as live `Actor`/`Item` objects:

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
  chatStatus: "preview" // "preview" | "committed" | "canceled"
}
```

The contract must state that later commit code applies updates through Foundry document APIs and awaits operations in deterministic order. Do not implement commit code in this story. [Source: `_bmad-output/planning-artifacts/architecture.md` AD-6]

### Current Code Context To Preserve

The existing combat entry point is item-centric:

- `module/actor/actor-sheet.js` handles `.fire-weapon`, builds current target objects as `{ name, id }`, opens `ModifiersDialog`, and calls `item.__weaponRoll(fireOptions, targetTokens)`.
- `module/item/item.js` owns `CyberpunkItem.roll()`, `__weaponRoll()`, `attackRoll()`, `__semiAuto()`, `__threeRoundBurst()`, `__fullAuto()`, `__meleeBonk()`, and `__martialBonk()`.
- Current roll methods create `Multiroll` chat output and several ammo updates directly from item methods.
- `module/dice.js` provides `makeD10Roll` and `Multiroll`; these are current roll/chat primitives and must not be replaced in this story.

This story should not edit those files unless there is a narrow, non-behavioral export/import need. Prefer adding the new contract module only. If a runtime import is added, verify Foundry manifest loading still works through existing `module/cyberpunk2020.js` entrypoint. [Source: `_bmad-output/project-context.md`; source files inspected: `module/actor/actor-sheet.js`, `module/item/item.js`, `module/dice.js`, `module/cyberpunk2020.js`]

### Architecture Compliance

- Use plain JavaScript ES modules and JSDoc typedefs; do not add TypeScript, build tooling, npm dependencies, or bundler-only syntax.
- Keep mechanics contracts free of Foundry globals: no `game`, `ui`, `ChatMessage`, `Actor`, `Item`, sheet class, or Node filesystem/process dependency.
- Do not change `system.json`, `template.json`, migrations, templates, localization, compendium packs, or CSS for this story.
- Do not mutate persisted `system` data directly. This story should not perform persisted writes at all.
- Leave `CyberpunkItem.roll()` and `CyberpunkItem.__weaponRoll()` compatible and behaviorally unchanged.

### Testing Requirements

There is no automated test harness in this repo. For this story, verification is static:

- Confirm the new module parses as plain JavaScript.
- Confirm no existing runtime module imports it unless intentionally required.
- Confirm `module/item/item.js`, `module/actor/actor-sheet.js`, `module/dice.js`, and manifest paths are unchanged unless a justified non-behavioral edit was made.
- Do not claim Foundry runtime verification unless Foundry was actually opened and checked.

Later fixture work belongs to Story 1.4, but this contract must be shaped so a future fixture runner can consume and assert `CombatOutcome` without a Foundry world. [Source: `_bmad-output/planning-artifacts/architecture.md` AD-8; `_bmad-output/planning-artifacts/prds/prd-Cyberpunk2020VTT-2026-05-24/prd.md` FR-21]

### Anti-Regression Notes

- Do not duplicate combat formulas inside comments as implementation truth. Contracts should name evidence fields; later resolver stories implement the rules against audit/corebook references.
- Do not make chat templates a source of combat truth. Chat data will be derived from `CombatOutcome` in Story 1.5.
- Do not rely on target token names or IDs as the future mechanical target identity. Target actor UUID support is required by later stories.
- Do not normalize direct item ammo update behavior in this story; existing un-awaited update issues are known and handled by later state discipline stories.

### References

- `_bmad-output/planning-artifacts/epics.md` - Epic 1 and Story 1.1 requirements.
- `_bmad-output/planning-artifacts/architecture.md` - AD-1, AD-2, AD-3, AD-4, AD-6, AD-8, migration phase 1.
- `_bmad-output/planning-artifacts/prds/prd-Cyberpunk2020VTT-2026-05-24/prd.md` - FR-1, FR-21, FR-22.
- `_bmad-output/planning-artifacts/prds/prd-Cyberpunk2020VTT-2026-05-24/addendum.md` - resolver extraction direction and current code risk areas.
- `_bmad-output/implementation-artifacts/investigations/corebook-mechanical-faithfulness-audit.md` - architectural blocker and known state/update risks.
- `_bmad-output/project-context.md` - FoundryVTT brownfield implementation rules.

## Project Structure Notes

Expected new path:

```text
module/combat/combat-outcome.js
```

Potential future files listed by architecture, but not required in this story:

```text
module/combat/combat-resolver.js
module/combat/attack-resolver.js
module/combat/hit-location-resolver.js
module/combat/armor-resolver.js
module/combat/damage-resolver.js
module/combat/save-resolver.js
module/combat/state-planner.js
module/combat/combat-chat.js
module/combat/martial-arts-data.js
```

Detected variance: no `module/combat/` folder exists yet. Creating it is aligned with architecture. Do not move existing combat code into it in this story.

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- `node --check module/combat/combat-outcome.js`
- `rg -n "combat-outcome|COMBAT_CHAT_STATUS|CombatOutcome" module system.json templates lang scss css`
- `git diff -- module/item/item.js module/actor/actor-sheet.js module/dice.js module/cyberpunk2020.js system.json template.json`

### Completion Notes List

- Added `module/combat/combat-outcome.js` as a self-contained plain JS contract module with JSDoc typedefs for resolver input, target references, roll metadata, warnings, manual resolution, target outcomes, planned updates, and `CombatOutcome`.
- Exported small stable constant maps for chat status, warning severity, and manual-resolution reason codes.
- Preserved existing behavior: no runtime imports were added, no Foundry globals are referenced, and no existing weapon roll, actor sheet, manifest, template, or data schema files were modified.
- Verification completed with static syntax check and import/diff inspection. No automated regression suite exists in this repo, and Foundry runtime was not opened.

### File List

- `module/combat/combat-outcome.js`
- `_bmad-output/implementation-artifacts/1-1-define-combatoutcome-and-resolver-input-contracts.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

## Change Log

- 2026-05-24: Added combat outcome/input contract module and moved Story 1.1 to review.
