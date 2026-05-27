# Story 3.4: Resolve BTM and Minimum Damage

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a referee,
I want BTM applied after armor with the correct minimum damage behavior,
so that final applied damage is mechanically faithful and explainable.

## Acceptance Criteria

1. Given damage remains after armor and AP handling
   When BTM resolution runs
   Then the outcome shows raw damage, armor mitigation, AP-adjusted penetrating damage, Body Type modifier, actual BTM mitigation, final damage, and whether minimum damage was enforced.
2. Given armor fully stops incoming damage
   When BTM resolution runs
   Then final damage remains 0, actual BTM mitigation is 0, and minimum damage is not enforced.
3. Given damage penetrates armor but BTM would reduce it to 0 or less
   When final damage is calculated
   Then final damage is 1 and the outcome marks minimum damage enforcement as applied.
4. Given damage penetrates armor and BTM only partially reduces it
   When final damage is calculated
   Then final damage equals penetrating damage after AP minus actual BTM mitigation, with no minimum-damage flag.
5. Given fixture checks are run
   When `node tests/run-combat-fixtures.mjs` executes
   Then full stop, normal BTM reduction, and BTM minimum damage behavior are covered with auditable chat/outcome evidence.

## Tasks / Subtasks

- [x] Make BTM/minimum damage a dedicated resolver step. (AC: 1, 2, 3, 4)
  - [x] Add a pure helper in `module/combat/attack-resolver.js` or a new `module/combat/damage-resolver.js` if it removes real complexity.
  - [x] Keep the helper Foundry-independent and JSON-serializable.
  - [x] Inputs should include penetrating damage after armor/AP and target Body Type.
  - [x] Outputs should distinguish the tabular Body Type modifier from actual damage mitigated.
- [x] Normalize hit-level damage evidence. (AC: 1)
  - [x] Preserve `rawDamage`, `effectiveStoppingPower`, `armorMitigation`, `armorPiercing`, `penetratingDamage`, and AP evidence from Stories 3.2 and 3.3.
  - [x] Add or populate `bodyTypeModifier` as the BTM table magnitude from `btmFromBT()`.
  - [x] Ensure `bodyTypeMitigation` means actual damage removed by BTM, not merely the table modifier.
  - [x] Add `minimumDamageApplied` or equivalent explicit evidence.
  - [x] Keep `finalDamage` as the damage value that later wound-state stories will apply.
- [x] Enforce corebook minimum damage correctly. (AC: 2, 3, 4)
  - [x] If armor/AP leaves `penetratingDamage <= 0`, set final damage to 0, BTM mitigation to 0, and `minimumDamageApplied` to false.
  - [x] If `penetratingDamage > 0`, subtract BTM but never reduce final damage below 1.
  - [x] If BTM would reduce penetrating damage to 0 or less, set final damage to 1 and `minimumDamageApplied` to true.
  - [x] If BTM only partially reduces damage, set `bodyTypeMitigation` to the actual amount removed and `minimumDamageApplied` to false.
  - [x] Do not alter staged penetration planning: staged penetration still depends on damage penetrating armor, not on damage remaining after BTM.
- [x] Surface BTM evidence in chat data and contracts. (AC: 1, 5)
  - [x] Update `module/combat/combat-outcome.js` typedefs for any new hit fields.
  - [x] Update `module/combat/combat-chat.js` so preview/commit chat data exposes BTM modifier, actual mitigation, final damage, and minimum-damage evidence.
  - [x] Avoid template/UI redesign unless existing chat templates already render arbitrary hit fields.
- [x] Keep adjacent stories out of scope. (AC: 1)
  - [x] Do not implement wound-state transitions, wound penalties, stun saves, or death saves; Stories 3.5 and 3.6 own those behaviors.
  - [x] Do not implement melee/unarmed Body Type damage bonuses; Story 5.3 owns offensive Body Type modifiers.
  - [x] Do not change AP armor halving, AP penetrating-damage halving, proportional armor, manual cover, or staged penetration behavior except where fixture expectations must incorporate corrected BTM evidence.
- [x] Add fixture and direct coverage. (AC: 2, 3, 4, 5)
  - [x] Extend `tests/combat/combat-fixtures.test.js` direct assertions for BTM helper behavior if a helper is introduced.
  - [x] Extend `tests/combat/fixtures/ranged-single-shot.json` or add focused fixture cases for:
    - [x] full armor stop with no BTM/minimum damage,
    - [x] normal BTM reduction where final damage remains greater than 1,
    - [x] minimum damage where BTM would reduce penetrating damage to 0 or less,
    - [x] AP penetrating damage followed by BTM, if not already clearly covered.
  - [x] Assert chat data includes the same BTM/minimum evidence as the outcome.
  - [x] Run `node tests/run-combat-fixtures.mjs` and record the result in the Dev Agent Record.

## Dev Notes

- Story 3.3 is complete in commit `2311b2a Apply AP and staged armor penetration`. Start from that code.
- Current `module/combat/attack-resolver.js` already calculates BTM, but the field is misleading:
  - It sets `bodyTypeMitigation = btmFromBT(target.snapshot?.stats?.body?.total || 0)`.
  - It then calculates `finalDamage = Math.max(1, penetratingDamage - bodyTypeMitigation)` when armor was penetrated.
  - This means `bodyTypeMitigation` currently stores the table modifier, not the actual amount removed. Example: if penetrating damage is 1 and BTM is 2, actual mitigation is 0 because minimum damage still applies.
- Preserve the existing damage sequence:
  1. Roll raw damage.
  2. Apply armor mitigation using `armor.effectiveStoppingPower`.
  3. Apply AP penetrating-damage halving if `armor.armorPiercing` is true.
  4. Apply BTM to the AP-adjusted penetrating damage.
  5. Enforce minimum 1 damage only when armor/AP left positive penetrating damage.
- Corebook reference: after armor, subtract Body Type Modifier from damage; if armor plus BTM would reduce damage to zero or less, BTM may never reduce damage below one. Full armor stop remains zero damage.
- `btmFromBT()` in `module/lookups.js` returns positive magnitudes (`0`, `1`, `2`, etc.) even though the corebook table displays BTM as negative reductions. Treat this as the reducer magnitude and name fields accordingly.
- The offensive Body Type modifier table for melee/unarmed damage is unrelated and belongs to Story 5.3.
- Staged penetration from Story 3.3 is intentionally based on armor penetration (`rawDamage > effectiveStoppingPower` after AP-adjusted armor SP), not whether BTM later reduces final damage to 1.
- Current chat data includes `bodyTypeMitigation` and `finalDamage`; this story should add any missing BTM/minimum fields without broad chat-template redesign.

### Current Files To Read Before Editing

- `module/combat/attack-resolver.js`
  - Current state: damage, armor, AP, staged penetration, temporary BTM, and final damage are calculated inline.
  - Change for this story: isolate or clarify BTM/minimum logic and correct evidence semantics.
  - Preserve: deterministic roller contract, staged penetration planning, AP evidence, no Foundry globals.
- `module/lookups.js`
  - Current state: exports `btmFromBT(body)`.
  - Change for this story: likely none unless tests expose a clear BTM table mismatch for defensive BTM. Do not alter offensive Body Type damage modifier logic here.
- `module/combat/combat-outcome.js`
  - Current state: typedefs describe `bodyTypeMitigation` as damage removed by BTM.
  - Change for this story: add `bodyTypeModifier` and `minimumDamageApplied` or equivalent, and ensure descriptions match actual semantics.
- `module/combat/combat-chat.js`
  - Current state: exposes `bodyTypeMitigation` and `finalDamage`.
  - Change for this story: expose BTM modifier and minimum damage evidence.
- `tests/combat/combat-fixtures.test.js`
  - Current state: validates outcome/chat fixtures and direct armor resolver behavior.
  - Change for this story: add direct BTM/minimum assertions if helper is introduced and update outcome/chat expectations.
- `tests/combat/fixtures/ranged-single-shot.json`
  - Current state: includes baseline single-shot, AP, staged penetration, cover, and armor cases.
  - Change for this story: add or extend focused full-stop, partial-BTM, and minimum-damage cases.

### Project Structure Notes

- Keep pure mechanics in `module/combat/` and shared rule lookup values in `module/lookups.js`.
- Do not introduce npm tooling, Jest, TypeScript, package metadata, or new dependencies.
- Keep tests runnable outside Foundry with `node tests/run-combat-fixtures.mjs`.
- Do not mutate actor/item documents during resolution; BTM only affects outcome evidence and future damage plans.
- Do not edit compendium `.db` files.
- Do not edit `template.json`; this story should not require a persisted schema change.

### Previous Story Intelligence

- Story 3.2 implemented proportional armor, manual cover, and layer warnings.
- Story 3.3 implemented ablation-aware SP, AP evidence, staged penetration planning, staged penetration setting, and chat evidence.
- Story 3.3 review established that staged penetration ablates the outer item-backed armor layer first and does not persist ablation to manual cover.
- Deferred from Story 3.3 review:
  - Multiple penetrations against the same armor item can collapse to one ablation in future multi-hit outcomes.
  - Stale preview can overwrite newer armor ablation on confirm.
  These are not part of Story 3.4 unless the implementation unexpectedly touches multi-hit or commit concurrency.
- Existing Node fixture runs emit a module-type warning because there is no `package.json` with `"type": "module"`; that warning is known and not part of this story.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.4]
- [Source: _bmad-output/planning-artifacts/prds/prd-Cyberpunk2020VTT-2026-05-24/prd.md#FR-12 BTM and Minimum Damage]
- [Source: _bmad-output/planning-artifacts/architecture.md#4.5 damage-resolver.js]
- [Source: _bmad-output/planning-artifacts/architecture.md#AD-9 Tests Use Fixture-First Plain JS]
- [Source: docs/cyberpunk-2020-core-rules-extracted.md:9606]
- [Source: docs/cyberpunk-2020-core-rules-extracted.md:9630]
- [Source: module/combat/attack-resolver.js]
- [Source: module/combat/combat-chat.js]
- [Source: module/combat/combat-outcome.js]
- [Source: module/lookups.js]
- [Source: tests/combat/combat-fixtures.test.js]

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- Red phase: `node tests/run-combat-fixtures.mjs` failed because `resolveBodyTypeDamage` was not exported yet.
- Green phase: `node tests/run-combat-fixtures.mjs` passed, with the existing Node module-type warning.
- Validation: `python3 -m json.tool tests/combat/fixtures/ranged-single-shot.json` passed.
- Validation: `git diff --check` passed.

### Completion Notes List

- Added `resolveBodyTypeDamage()` as a pure BTM/minimum-damage helper in `attack-resolver`.
- Corrected BTM evidence semantics so `bodyTypeModifier` is the table magnitude and `bodyTypeMitigation` is actual damage removed.
- Added `minimumDamageApplied` to hit outcome/chat evidence and outcome typedefs.
- Extended fixtures for full stop, partial BTM reduction, minimum damage, AP plus BTM, and chat evidence.
- Kept wound state, saves, offensive Body Type modifiers, AP, armor layering, cover, and staged penetration behavior out of scope.

### File List

- _bmad-output/implementation-artifacts/3-4-resolve-btm-and-minimum-damage.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- module/combat/attack-resolver.js
- module/combat/combat-chat.js
- module/combat/combat-outcome.js
- tests/combat/combat-fixtures.test.js
- tests/combat/fixtures/ranged-single-shot.json

### Change Log

- 2026-05-27: Created Story 3.4 with BTM/minimum-damage sequencing, evidence, and fixture guidance.
- 2026-05-27: Implemented Story 3.4 BTM/minimum-damage resolver, evidence fields, and fixture coverage.

### Review Findings

- [x] [Review][Patch] Real actor snapshots miss BTM because resolver reads `stats.body.total` while the system data model uses `stats.bt.total` [module/combat/attack-resolver.js:288]
- [x] [Review][Patch] Invalid Body Type can become maximum BTM because non-finite values flow into `btmFromBT()` and hit its default branch [module/combat/attack-resolver.js:61]
