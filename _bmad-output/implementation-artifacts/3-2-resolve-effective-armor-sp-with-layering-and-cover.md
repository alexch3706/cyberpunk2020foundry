# Story 3.2: Resolve Effective Armor SP with Layering and Cover

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a referee,
I want the system to calculate effective armor protection at the hit location,
so that armor mitigation matches core combat expectations instead of straight additive SP.

## Acceptance Criteria

1. Given incoming damage at a target hit location
   When armor resolution runs
   Then the outcome includes armor layers considered, effective SP, manual cover SP when provided, and any hard/soft layer warnings.
2. Given multiple armor or cover layers protect the same hit location
   When effective SP is calculated
   Then proportional armor is used instead of straight addition or actor-prepared pre-summed SP.
3. Given layer combinations violate corebook layering constraints
   When armor resolution runs
   Then the resolver returns warning evidence without blocking the single-shot preview/confirm flow.
4. Given fixture checks are run
   When `node tests/run-combat-fixtures.mjs` executes
   Then proportional armor, cover, and hard/soft warning behavior are covered with audit/corebook references.

## Tasks / Subtasks

- [x] Replace placeholder max-SP armor resolution with proportional armor logic. (AC: 1, 2)
  - [x] Update `module/combat/armor-resolver.js` so `resolveArmor()` derives `effectiveStoppingPower` from ordered layers at the hit location.
  - [x] Implement the Cyberpunk 2020 proportional armor table: SP difference `0-4 => +5`, `5-8 => +4`, `9-14 => +3`, `15-20 => +2`, `21-26 => +1`, `27+ => +0`.
  - [x] Resolve three or more layers pairwise from inside to outside; document the chosen ordering rule for current snapshot data.
  - [x] Keep `getEquippedArmorForLocation()` as the snapshot extraction boundary; do not read `targetSnapshot.hitLocations[area].stoppingPower` or `system.stats.Armor` as rule input.
- [x] Add manual cover as a temporary armor layer. (AC: 1, 2)
  - [x] Extend `resolveArmor()` to accept an optional resolver options object, for example `{ cover: { stoppingPower, name, layer, source } }`.
  - [x] Wire cover from the single-shot action context, preferably `context.action.options.cover` or `context.action.cover`, in `module/combat/attack-resolver.js`.
  - [x] Mark cover layers with `type: "cover"` and preserve enough evidence for chat/test inspection: name, stoppingPower, layer, source, and that it was manually supplied.
  - [x] Do not implement scene/map object cover automation in this story.
- [x] Emit hard/soft and max-layer warning evidence. (AC: 1, 3)
  - [x] Add stable warning objects to the armor result for more than three active protection layers.
  - [x] Add stable warning objects for more than one hard armor layer.
  - [x] Treat missing layer category as warning-worthy only when it affects constraint confidence; preserve current default behavior where possible to avoid old item data breakage.
  - [x] Propagate armor warnings onto the hit record and chat data using the existing `CombatWarning` shape.
- [x] Keep story scope out of AP, staged penetration, and BTM. (AC: 1, 2)
  - [x] Do not implement staged penetration item updates here; Story 3.3 owns that.
  - [x] Do not complete AP penetrating-damage behavior here beyond preserving existing fields; Story 3.3 owns AP semantics.
  - [x] Do not complete BTM/minimum-damage behavior here; Story 3.4 owns that.
  - [x] If existing `attack-resolver.js` calculations must change to consume the new effective SP, keep the change narrow and covered by fixtures.
- [x] Add fixture coverage. (AC: 2, 3, 4)
  - [x] Extend `tests/combat/combat-fixtures.test.js` armor resolver assertions for proportional armor pairs and three-layer pairwise behavior.
  - [x] Add/extend fixture data under `tests/combat/fixtures/` for a single-shot hit with cover and layered armor evidence.
  - [x] Assert that actor-prepared display SP remains ignored even when it disagrees with item-derived effective SP.
  - [x] Assert warning codes for max-layer and hard/hard combinations.
  - [x] Run `node tests/run-combat-fixtures.mjs` and record the result in the Dev Agent Record.

## Dev Notes

- Story 3.1 created `module/combat/armor-resolver.js` and wired it into `module/combat/attack-resolver.js`. The current `resolveArmor()` is intentionally temporary: it chooses the maximum active layer SP and applies AP halving. Story 3.2 should replace only the effective armor/SP part with proportional armor and cover support.
- The resolver layer must stay plain JavaScript and Foundry-independent. `armor-resolver.js` must not import or use Foundry globals such as `game`, `Actor`, `Item`, `ChatMessage`, or document update APIs.
- `CyberpunkActor.prepareData()` still computes display-only aggregate SP into `system.hitLocations[area].stoppingPower`. That value is specifically not a rules source for this story.
- Existing armor snapshots may come in two shapes:
  - Item snapshots from Foundry: `{ id, name, type, system: { coverage, equipped, source, ... } }`.
  - Fixture/plain snapshots: `{ id, name, equipped, coverage }`, where `item.system || item` is expected to work.
- Cyberware armor snapshots from Story 3.1 parse pack-style text such as `Skinweave SP12` and `Subdermal Skull Armor SP6`. Do not regress this behavior; add tests if layer classification changes.
- Manual cover is MVP-only temporary input. Scene object cover automation is explicitly out of scope.
- Warning evidence should use the existing `CombatWarning` contract: `{ code, severity, message, source? }`. Prefer stable codes such as `armor-too-many-layers`, `armor-multiple-hard-layers`, and `armor-missing-layer-category`.

### Current Files To Read Before Editing

- `module/combat/armor-resolver.js`
  - Current state: extracts armor/cyberware layers and returns `{ layers, effectiveStoppingPower, armorPiercing }`.
  - Change for this story: calculate effective SP with proportional layering and optional cover; return warning evidence.
  - Preserve: item/cyberware extraction, pack-style cyberware SP parsing, ignored display-only hit-location SP, no Foundry dependencies.
- `module/combat/attack-resolver.js`
  - Current state: on a structured hit, rolls damage, calls `resolveArmor(weaponAP, target.snapshot, hitDetail.location)`, stores armor fields on the hit record, and performs temporary damage/BTM calculations.
  - Change for this story: pass manual cover options to `resolveArmor()` and propagate armor warnings/details to `hitDetail`.
  - Preserve: deterministic roller contract, single-shot fallback behavior, ammo planning, hit-location manual-resolution behavior.
- `module/combat/combat-chat.js`
  - Current state: maps hit-level fields and warnings into plain chat data.
  - Change for this story: include armor warning evidence if not already present through `hit.warnings`; avoid broad chat/template redesign.
- `tests/combat/combat-fixtures.test.js`
  - Current state: contains direct armor resolver assertions plus fixture-driven single-shot tests.
  - Change for this story: add direct assertions for proportional armor, cover, and layer warnings; update fixture expectations if `hit.armor` or warning evidence changes.
- `tests/combat/fixtures/ranged-single-shot.json`
  - Current state: baseline structured single-shot fixture with armor SP evidence.
  - Change for this story: update expected `effectiveStoppingPower` only if intended by the new proportional logic; add a separate case if needed to avoid muddying the baseline.

### Project Structure Notes

- Put pure combat mechanics in `module/combat/`; do not move logic into sheets, templates, or item classes.
- Keep fixture tests runnable outside Foundry with `node tests/run-combat-fixtures.mjs`.
- Do not add `package.json`, npm scripts, bundlers, TypeScript, Jest, or new dependencies.
- Do not edit `template.json` unless implementation proves a persisted field is unavoidable. If `template.json` changes, migration impact must be documented.
- Do not edit compendium `.db` files for this story.
- Keep all user-visible strings localized if template output changes; avoid template changes unless warnings need new visible text.

### Previous Story Intelligence

- Story 3.1 completed armor/AP snapshot plumbing and was committed in `c47a0a2 Add combat chat and armor snapshot plumbing`.
- Review of 3.1 found that real cyberware armor pack data stores SP in names/flavor text rather than `system.stoppingPower`. That was fixed in `armor-resolver.js`; preserve it.
- 3.1 tests already verify:
  - equipped armor and cyberware extraction,
  - unequipped armor/cyberware exclusion,
  - pack-style `Skinweave SP12` and `Subdermal Skull Armor SP6` parsing,
  - skull armor location filtering,
  - actor-prepared pre-summed torso SP ignored.
- Recent combat stories established the pattern of fixture-first plain JS tests, preview/confirm state planning, and chat evidence derived from `CombatOutcome`.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.2]
- [Source: _bmad-output/planning-artifacts/prds/prd-Cyberpunk2020VTT-2026-05-24/prd.md#FR-10 Armor Resolution]
- [Source: _bmad-output/planning-artifacts/architecture.md#AD-7 Armor Is Calculated at Resolution Time]
- [Source: _bmad-output/planning-artifacts/architecture.md#AD-9 Tests Use Fixture-First Plain JS]
- [Source: _bmad-output/implementation-artifacts/investigations/corebook-mechanical-faithfulness-audit.md#P0 - Armor Layering and AP Are Mechanically Wrong or Missing]
- [Source: docs/cyberpunk-2020-core-rules-extracted.md:9363]
- [Source: docs/cyberpunk-2020-core-rules-extracted.md:9388]
- [Source: docs/cyberpunk-2020-core-rules-extracted.md:9518]
- [Source: module/combat/armor-resolver.js]
- [Source: module/combat/attack-resolver.js]
- [Source: tests/combat/combat-fixtures.test.js]

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- Red phase: `node tests/run-combat-fixtures.mjs` failed on old max-SP armor resolver expectations before implementation.
- Green/regression: `node tests/run-combat-fixtures.mjs` passed with 2 combat fixture suites.
- Static check: `git diff --check` passed.
- Review fix: `node tests/run-combat-fixtures.mjs` passed after Skinweave layer classification fix.

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- Implemented proportional armor SP resolution using the corebook difference table.
- Added deterministic inside-out layer ordering: cyberware, worn armor, then manual cover; same-type layers preserve snapshot order.
- Added manual cover support via `resolveArmor(..., { cover })` and single-shot action options.
- Added armor warning evidence for more than three active layers and multiple hard layers, propagated to hit warnings.
- Preserved Story 3.1 cyberware SP parsing and kept AP, staged penetration, and BTM scope for later stories.
- Resolved review finding by defaulting pack-style Skinweave cyberware to soft layer unless an explicit `system.layer` is present.

### File List

- _bmad-output/implementation-artifacts/3-2-resolve-effective-armor-sp-with-layering-and-cover.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- module/combat/armor-resolver.js
- module/combat/attack-resolver.js
- tests/combat/combat-fixtures.test.js
- tests/combat/fixtures/ranged-single-shot.json

### Change Log

- 2026-05-27: Implemented Story 3.2 proportional armor, manual cover, warning evidence, and fixture coverage.
- 2026-05-27: Addressed review finding for Skinweave hard-layer false positives.

### Review Findings

- [x] [Review][Patch] Pack-style Skinweave is classified as hard armor, producing false hard-layer warnings [module/combat/armor-resolver.js:69]
