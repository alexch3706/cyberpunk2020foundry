# Story 2.2: Resolve Single-Shot Ranged Attack Outcome

Status: done

<!-- Completion note: Ultimate context engine analysis completed - comprehensive developer guide created. -->

## Story

As a referee,
I want a single firearm shot to produce a structured hit or miss result,
so that I can audit attack total, range difficulty, modifiers, critical/fumble metadata, and target location.

## Acceptance Criteria

1. Given an attacker, weapon, target, range, and attack modifiers, when a semi-auto/single-shot attack is resolved, then the outcome includes attack total, range DC, modifier evidence, hit/miss state, natural die metadata, and hit location when applicable.
2. Existing ranged modifiers remain represented.

## Tasks / Subtasks

- [x] Add a pure single-shot ranged attack resolver path. (AC: 1, 2)
  - [x] Add `module/combat/attack-resolver.js` or equivalent focused module under `module/combat/`.
  - [x] Export a function such as `resolveSingleShotRangedAttack(context, options = {}, roller = undefined)`.
  - [x] Accept the existing resolver context shape from `CyberpunkItem.__buildCombatResolverContext()`.
  - [x] Return a `CombatOutcome` with one `CombatTargetOutcome` per selected target, not a legacy `Multiroll`.
  - [x] Keep the module importable from Node fixture tests and Foundry runtime.
- [x] Build structured attack evidence. (AC: 1, 2)
  - [x] Calculate or derive `targetNumber` from `rangeDCs[context.action.range]`.
  - [x] Use attacker REF, relevant weapon skill, weapon accuracy, and existing ranged modifier inputs to produce an attack roll formula/terms.
  - [x] Preserve individual modifier evidence for aiming rounds, aimed location, ambush, blinded, dual wielding, fast draw, hipfire, ricochet, running, turning, extra mod, and range/fire mode context where present.
  - [x] Preserve natural d10 metadata, total, formula, critical flag, fumble flag, and success margin.
  - [x] Set `attack.hit` using attack total versus target number.
- [x] Resolve hit location only when applicable. (AC: 1)
  - [x] If the attack misses, return no hit records and do not roll location.
  - [x] If `context.action.targetArea` is supplied, use it as the hit location and include evidence that the location was aimed/selected.
  - [x] Otherwise roll or request a deterministic location roll and map it through target snapshot hit-location data when available.
  - [x] Include warnings/manual-resolution evidence if a hit location cannot be resolved from target data.
  - [x] Do not resolve damage, armor, BTM, wounds, saves, or ammo in this story.
- [x] Route only the supported single-shot path through structured outcome. (AC: 1, 2)
  - [x] Update `module/combat/combat-resolver.js` to call the new attack resolver only for `action.type === "ranged"` and `fireMode === "SemiAuto"` or equivalent single-shot value.
  - [x] Preserve legacy fallback for burst, full-auto, suppressive, melee, martial, unsupported ranged modes, and any path missing required data.
  - [x] Do not wire structured outcome into chat rendering, preview/confirm, or persisted updates yet.
  - [x] Preserve current legacy visible behavior unless a Node fixture explicitly calls the structured resolver path.
- [x] Extend deterministic fixture coverage. (AC: 1, 2)
  - [x] Update `tests/combat/fixtures/ranged-single-shot.json` or add a focused fixture section for real single-shot attack resolution.
  - [x] Assert attack roll total, formula/terms, natural die metadata, target number, hit flag, margin, and hit location for a hit case.
  - [x] Assert miss behavior does not produce hit records or location rolls.
  - [x] Assert existing ranged modifier inputs remain represented in outcome evidence.
  - [x] Assert actorless or missing-location target context produces manual/warning evidence instead of silent success.
- [x] Preserve project boundaries. (AC: 1, 2)
  - [x] Do not create chat messages or render templates.
  - [x] Do not mutate documents, spend ammo, apply damage, ablate armor, or create planned updates for damage/ammo.
  - [x] Do not add package workflow, npm dependencies, TypeScript, bundlers, Jest, Vitest, or browser app scaffolding.
  - [x] Do not change `system.json`, `template.json`, migrations, compendium packs, SCSS, or CSS.
- [x] Add focused verification. (AC: 1, 2)
  - [x] Run syntax checks for changed combat modules, `module/item/item.js` if touched, and changed tests.
  - [x] Run `node tests/run-combat-fixtures.mjs`.
  - [x] Static-check new/changed combat runtime code for forbidden side effects: no `ChatMessage`, no `renderTemplate`, no document `.update(`, no `updateEmbeddedDocuments`, no `createEmbeddedDocuments`.
  - [x] Document that Foundry runtime/manual check is optional because this story should not visibly replace legacy chat/roll behavior.

### Review Findings

- [x] [Review][Patch] Structured route does not fall back when required data is missing [module/combat/combat-resolver.js:20]
- [x] [Review][Patch] Options-only aimed location is counted as a modifier but ignored by hit-location resolution [module/combat/attack-resolver.js:185]
- [x] [Review][Patch] Target-level manual resolution is not reflected at outcome level [module/combat/attack-resolver.js:40]
- [x] [Review][Patch] `targetsCount` ranged modifier evidence is missing [module/combat/attack-resolver.js:4]
- [x] [Review][Patch] Structured roll request cannot use real item-backed actor skill values from Foundry context [module/combat/attack-resolver.js:149]

## Dev Notes

### Scope Boundary

This story adds structured single-shot ranged attack outcome data. It must not implement damage, armor, BTM, wounds, saves, ammo planning, preview/confirm, chat rendering, or Foundry document commits.

The intended result is a resolver-backed `CombatOutcome` for semi-auto/single-shot attack evidence, verified by Node fixtures. Runtime-visible legacy chat output should remain unchanged until Stories 2.3 through 2.5 explicitly migrate ammo, commit, and chat behavior.

### Epic 2 Context

Epic 2 builds the first end-to-end single-shot firearm path:

1. Story 2.1 normalized selected targets to actor-aware references.
2. Story 2.2 resolves structured hit/miss and hit-location attack evidence.
3. Story 2.3 adds ammo planning while preserving legacy entry behavior.
4. Story 2.4 adds preview/confirm state application.
5. Story 2.5 renders single-shot combat evidence in chat.
6. Story 2.6 adds end-to-end fixtures and Foundry manual checks.

This story is therefore the first mechanics step, but only for attack/hit-location outcome shape. It should not pull in later damage or state behavior.

### Requirements Traceability

- FR-4: ranged attacks must use REF, weapon skill, 1d10 critical/fumble behavior, range difficulty, weapon accuracy, and applicable modifiers.
- FR-9: random and aimed hit locations must use the target's location model when available.
- Architecture section 4.2 `attack-resolver.js`: build attack terms from attacker snapshot, weapon snapshot, range, modifiers, and action context; preserve natural d10 metadata; calculate range DCs.
- Architecture section 4.3 `hit-location-resolver.js`: resolve random locations using target actor location lookup, support aimed locations, and fall back/manualize when target-specific data is unavailable.

### Current Code To Preserve

`module/item/item.js` currently has legacy visible behavior:

- `attackRoll(attackMods)` builds a Foundry `Roll` with `makeD10Roll()`.
- `__semiAuto(attackMods)` rolls attack, damage, and hit location, renders a `Multiroll`, and immediately updates `system.shotsLeft`.
- `__threeRoundBurst`, `__fullAuto`, melee, and martial paths remain legacy.

Story 2.2 should not replace those visible paths for users yet. If `combat-resolver.js` routes semi-auto contexts to structured outcome, ensure this is bounded to testable resolver contexts or explicitly preserves legacy fallback for normal Foundry UI until Story 2.3/2.4 owns runtime migration.

Current range constants live in `module/lookups.js`:

```js
export let ranges = {
  pointBlank: "RangePointBlank",
  close: "RangeClose",
  medium: "RangeMedium",
  long: "RangeLong",
  extreme: "RangeExtreme"
}

export let rangeDCs = {
  RangePointBlank: 10,
  RangeClose: 15,
  RangeMedium: 20,
  RangeLong: 25,
  RangeExtreme: 30
}
```

`rangedModifiers()` supplies existing modifier inputs through `attackMods` / `context.action.options`: `aimRounds`, `targetArea`, `targetsCount`, `ambush`, `blinded`, `dualWield`, `fastDraw`, `hipfire`, `ricochet`, `running`, `turningToFace`, and `extraMod`.

### Expected CombatOutcome Shape

For a hit:

```js
{
  action: { type: "ranged", fireMode: "SemiAuto", range: "RangeMedium", modifiers: [...] },
  attacker: context.attacker,
  weapon: context.weapon,
  targets: [
    {
      target: context.targets[0],
      attack: {
        roll: {
          formula,
          terms,
          total,
          die: { faces: 10, natural, results, exploded },
          isCritical,
          isFumble
        },
        targetNumber,
        hit: true,
        margin,
        warnings
      },
      hits: [
        {
          location,
          locationRoll,
          warnings
        }
      ],
      manualResolution,
      warnings
    }
  ],
  manualResolution: { required: false },
  chat: { status: "preview" },
  warnings: []
}
```

For a miss, `hits` should be empty and no location roll should be consumed.

Use `COMBAT_CHAT_STATUS.preview`, `COMBAT_WARNING_SEVERITY`, and `MANUAL_RESOLUTION_REASON` from `combat-outcome.js` where applicable.

### Previous Story Intelligence

Story 2.1 added `module/combat/target-normalizer.js` and updated `CyberpunkItem.__buildCombatResolverContext()` so targets now preserve:

- `id`
- `tokenUuid`
- `actorUuid`
- `name`
- `snapshot`
- `manualResolution`
- `warnings`

Review patch in Story 2.1 matters: `equippedArmor` and `equippedCyberware` snapshots include only items with `system.equipped === true`. Preserve that assumption; do not re-read live actor item state in the attack resolver.

Story 1.1 established `CombatOutcome`, `CombatAttackOutcome`, `CombatHitRecord`, `RollMetadata`, `ManualResolution`, and warning contracts.

Story 1.2 introduced `resolveCombatAction(context, options = {}, roller = undefined)` and the legacy fallback requirement. Any new structured path must keep unsupported paths falling back.

Story 1.4/1.5 established the Foundry-free fixture runner:

```text
tests/combat/fixtures/ranged-single-shot.json
tests/combat/combat-fixtures.test.js
tests/run-combat-fixtures.mjs
```

The existing fixture stub currently computes provisional hit/damage evidence in test code. For this story, move attack/hit-location behavior into production resolver modules and keep fixture code focused on assertions and deterministic roller scripting.

### Deterministic Roller Guidance

Do not require Foundry `Roll` in Node tests. Use the existing optional `roller` hook or a small adapter shape.

Recommended request IDs:

- `"attack"` for the single d10 attack roll.
- `"location"` only when the attack hits and no `targetArea` was selected.

Recommended returned roll metadata:

```js
{
  id: "attack",
  formula: "1d10x10 + REF + Handgun + modifiers + weapon accuracy",
  terms: ["1d10x10", "@stats.ref.total", "@skill.handgun", ...],
  total: 21,
  die: { faces: 10, natural: 7, results: [7], exploded: false },
  isCritical: false,
  isFumble: false
}
```

If production Foundry rolling is introduced, keep it behind an adapter so Node fixtures can still inject deterministic results. Do not import `Roll`, `game`, or `ChatMessage` into pure combat modules.

### Hit Location Guidance

Use target snapshot data. Prefer a small helper such as `module/combat/hit-location-resolver.js` only if it keeps the attack resolver simple.

Acceptable minimal behavior for this story:

- If `context.action.targetArea` is present, set `location` to that value and include a warning or evidence flag that this was aimed/selected.
- Otherwise consume a deterministic `"location"` roll and map natural/total result to a location key from `target.snapshot.hitLocations`.
- If the target has no usable actor snapshot/hit-location model, mark target manual-resolution or add a warning instead of silently using a hardcoded live actor lookup.

Do not resolve armor or damage from the location in this story.

### Architecture Compliance

- Pure resolver modules under `module/combat/` must remain safe to import from Node tests.
- Runtime modules under `module/` must not use Node-only APIs.
- Do not import Foundry globals into `attack-resolver.js` or `hit-location-resolver.js`.
- Do not persist actor/item/token state.
- Resolver functions return data; adapter/commit stories later decide what to render or update.
- Use plain JavaScript ES modules and relative `.js` imports.
- Do not introduce new tooling or dependencies.

### Testing Requirements

Required checks for this story:

```text
node --check module/combat/combat-outcome.js
node --check module/combat/combat-resolver.js
node --check module/combat/attack-resolver.js
node --check module/combat/target-normalizer.js
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

- Hit case: attack total, range DC, modifier evidence, natural d10 metadata, hit flag, margin, and hit location.
- Miss case: attack total, range DC, hit false, negative/zero margin, no hits, and no location roll consumption.
- Modifier case: at least one positive modifier and one negative modifier remain represented.
- Manual/warning case: missing target actor or missing location model does not silently resolve as a normal target.

Foundry runtime/manual check is optional unless the implementation changes visible actor sheet attack behavior.

### Anti-Regression Notes

- Do not spend ammo in Story 2.2; Story 2.3 owns ammo planning.
- Do not render chat in Story 2.2; Story 2.5 owns chat.
- Do not calculate damage or armor in Story 2.2; Epic 3 owns faithful mitigation/wounds/saves.
- Do not break the legacy fallback for non-semi-auto modes.
- Do not remove or rewrite `CyberpunkItem.__semiAuto()` yet unless the story can prove visible behavior remains unchanged; a runtime migration belongs in later stories.
- Do not treat live actor/item documents as the source of truth after context snapshot creation.

### References

- `_bmad-output/planning-artifacts/epics.md` - Epic 2 and Story 2.2 requirements.
- `_bmad-output/planning-artifacts/architecture.md` - AD-2, AD-3, sections 4.2/4.3, Phase 2 target context and single-shot resolver.
- `_bmad-output/planning-artifacts/prds/prd-Cyberpunk2020VTT-2026-05-24/prd.md` - FR-4, FR-9, UJ-1, SM-4.
- `_bmad-output/planning-artifacts/prds/prd-Cyberpunk2020VTT-2026-05-24/addendum.md` - `rollAttack` direction and current tight coupling risks in `module/item/item.js`.
- `_bmad-output/implementation-artifacts/1-1-define-combatoutcome-and-resolver-input-contracts.md` - combat outcome and roll metadata contracts.
- `_bmad-output/implementation-artifacts/1-2-add-resolver-shell-and-cyberpunkitem-adapter.md` - resolver shell and legacy fallback behavior.
- `_bmad-output/implementation-artifacts/1-4-add-deterministic-fixture-baseline.md` - fixture runner patterns and deterministic roll guidance.
- `_bmad-output/implementation-artifacts/2-1-normalize-selected-targets-to-actor-aware-references.md` - target refs and snapshot/manual-resolution behavior.
- `_bmad-output/project-context.md` - FoundryVTT brownfield rules and no package workflow.

## Project Structure Notes

Expected new file:

```text
module/combat/attack-resolver.js
```

Optional helper if needed:

```text
module/combat/hit-location-resolver.js
```

Expected updates:

```text
module/combat/combat-resolver.js
tests/combat/combat-fixtures.test.js
tests/combat/fixtures/ranged-single-shot.json
```

Possible update only if routing requires it:

```text
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
```

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Implementation Plan

- Added `module/combat/attack-resolver.js` with `resolveSingleShotRangedAttack(context, options, roller)`.
- Routed explicit structured semi-auto contexts through the new resolver via `resolveCombatAction(context, { structured: true }, roller)`.
- Kept normal Foundry UI behavior on legacy fallback by requiring the explicit structured option for this story.
- Extended `ranged-single-shot` fixture coverage with structured hit, miss, modifier evidence, and missing hit-location model cases.

### Debug Log References

- `node tests/run-combat-fixtures.mjs` (red phase, failed before structured resolver path existed)
- `node --check module/combat/combat-outcome.js`
- `node --check module/combat/combat-resolver.js`
- `node --check module/combat/attack-resolver.js`
- `node --check module/combat/target-normalizer.js`
- `node --check module/item/item.js`
- `node --check tests/combat/combat-fixtures.test.js`
- `node --check tests/run-combat-fixtures.mjs`
- `node tests/run-combat-fixtures.mjs`
- `rg -n "ChatMessage|renderTemplate|game\\.|ui\\.|new Roll|\\.update\\(|updateEmbeddedDocuments|createEmbeddedDocuments" module/combat tests`

### Completion Notes List

- Structured single-shot outcomes now include range DC, modifier evidence, attack roll formula/terms, natural d10 metadata, hit flag, and margin.
- Hit outcomes resolve target hit location from target snapshot data; miss outcomes do not consume location rolls.
- Missing hit-location model produces target-level manual-resolution and warning evidence instead of silent success.
- Review patches added legacy fallback for incomplete structured contexts, options-only aimed-location resolution, top-level manual-resolution aggregation, `targetsCount` evidence, and item-backed skill snapshots.
- No damage, armor, BTM, wound, save, ammo, chat, preview/confirm, or Foundry document update behavior was added.
- Foundry runtime/manual check was not run because normal UI roll behavior remains on the existing legacy fallback path.

### File List

- `module/combat/attack-resolver.js`
- `module/combat/combat-resolver.js`
- `module/item/item.js`
- `tests/combat/combat-fixtures.test.js`
- `tests/combat/fixtures/ranged-single-shot.json`
- `_bmad-output/implementation-artifacts/2-2-resolve-single-shot-ranged-attack-outcome.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

## Change Log

- 2026-05-25: Created Story 2.2 context and marked ready for development.
- 2026-05-25: Added structured single-shot ranged attack outcome resolver and fixture coverage.
- 2026-05-27: Applied code-review fixes and marked Story 2.2 done.
