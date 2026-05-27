# Story 3.5: Apply Wound State and Special Damage Cases

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a referee,
I want confirmed damage to update wound state and surface special cases,
so that head hits, limb consequences, Serious/Critical/Mortal transitions, and penalties are not manually reconstructed.

## Acceptance Criteria

1. Given a target hit has positive `finalDamage` and a Target Actor
   When `planCombatUpdates(outcome)` runs
   Then the plan includes a Target Actor update that advances `system.damage` by the resolved wound-box damage and the hit outcome reports previous damage, next damage, previous wound state, next wound state, and wound-state label.
2. Given armor/AP/BTM leave `finalDamage <= 0`
   When wound planning runs
   Then no target damage update is planned, previous/next wound evidence remains stable, and no head/limb special case is applied.
3. Given the hit location is the head and damage penetrates
   When wound damage is derived
   Then the wound-box damage reflects the CP2020 head-hit double-damage rule and the hit evidence includes an explicit head-hit special-case marker.
4. Given one attack applies more than 8 wound-box damage to a limb location
   When special-case evaluation runs
   Then the outcome surfaces a limb-loss/severing warning or follow-up requirement without implementing the Story 3.6 save-prompt resolver.
5. Given damage crosses Light, Serious, Critical, or Mortal wound thresholds
   When wound transition evidence is produced
   Then chat/outcome data exposes the old/new wound state and the existing actor penalty model can derive Serious/Critical/Mortal stat penalties after the `system.damage` update.
6. Given fixture checks are run
   When `node tests/run-combat-fixtures.mjs` executes
   Then fixtures cover normal wound-box advancement, head-hit double damage, limb threshold surfacing, no-damage full armor stop, and Serious/Critical/Mortal threshold transitions.

## Tasks / Subtasks

- [x] Add a pure wound-state resolver step. (AC: 1, 2, 5)
  - [x] Add focused helper logic in `module/combat/state-planner.js`, `module/combat/attack-resolver.js`, or a new `module/combat/damage-resolver.js` only if it reduces real complexity.
  - [x] Keep the helper Foundry-independent and JSON-serializable.
  - [x] Inputs should include target actor UUID, current `target.snapshot.damage`, hit location, and hit `finalDamage`.
  - [x] Outputs should include `previousDamage`, `damageDelta`, `nextDamage`, `previousWoundState`, `nextWoundState`, and stable labels.
- [x] Plan Target Actor damage updates from resolved hits. (AC: 1, 2)
  - [x] Use Foundry update path `"system.damage"` only through planned actor updates; do not mutate actor `system` data directly.
  - [x] If multiple hits against the same target are present, accumulate their wound-box damage into one target damage transition before emitting actor updates.
  - [x] Do not plan damage updates for misses, manual-resolution targets, missing actor UUIDs, missing target snapshots, or hits with `finalDamage <= 0`.
  - [x] Preserve existing ammo, armor/staged penetration, and chat status planning behavior.
- [x] Implement head-hit special-case evidence. (AC: 3)
  - [x] Detect head locations using the resolver's existing location keys/labels without hardcoding only one capitalization form.
  - [x] Apply the head-hit double-damage rule to wound-box damage after armor/AP/BTM has produced `finalDamage`.
  - [x] Preserve original `finalDamage` evidence from Story 3.4 and add a separate wound application field such as `woundDamage` or `damageApplied`.
  - [x] Add a stable warning or `specialCases` entry showing that head-hit doubling was applied.
- [x] Surface limb-loss/severing follow-up without implementing saves. (AC: 4)
  - [x] Detect limb locations (`lArm`, `rArm`, `lLeg`, `rLeg`, and equivalent labels) defensively.
  - [x] If one attack applies more than 8 wound-box damage to a limb, add a hit/target warning or pending follow-up requirement for limb severing/crushing.
  - [x] If the same threshold occurs on a head location, surface the automatic-death special case as a warning/follow-up requirement only; do not implement death-save or kill-state automation in this story.
  - [x] Leave Stun/Shock and Death Save prompt construction to Story 3.6.
- [x] Update outcome/chat contracts. (AC: 1, 3, 4, 5)
  - [x] Extend `module/combat/combat-outcome.js` typedefs for wound transition and special-case evidence.
  - [x] Update `module/combat/combat-chat.js` so preview/commit chat data exposes wound transition, wound damage applied, and special-case warnings/follow-ups.
  - [x] Keep existing templates/UI unchanged unless current chat data tests require a minimal data field addition.
- [x] Add deterministic fixture coverage. (AC: 1, 2, 3, 4, 5, 6)
  - [x] Extend `tests/combat/combat-fixtures.test.js` with direct resolver/helper assertions if a helper is introduced.
  - [x] Extend `tests/combat/fixtures/ranged-single-shot.json` or add a focused fixture file for:
    - [x] normal torso hit advancing damage boxes,
    - [x] full armor stop with no wound update,
    - [x] head hit doubling wound-box damage,
    - [x] limb hit over 8 damage surfacing limb-loss/severing,
    - [x] Light to Serious, Serious to Critical, and Critical to Mortal transitions.
  - [x] Assert planned actor updates, outcome evidence, and chat data stay consistent.
  - [x] Run `node tests/run-combat-fixtures.mjs` and record the result in the Dev Agent Record.

## Dev Notes

- Story 3.4 is complete in commit `9dde10c Resolve BTM and minimum damage`; start from that code.
- Story 3.5 owns wound-box damage application and special-case surfacing only. Story 3.6 owns Stun/Shock save prompts, Death Save prompts, and recurring Mortal reminders.
- Existing actor damage is a simple numeric `system.damage`; `CyberpunkActor.woundState()` derives wound state as `0` for no damage and `Math.ceil(system.damage / 4)` after that. Do not introduce a new persisted wound-state field for this story.
- Existing actor wound penalties are derived in `CyberpunkActor._prepareCharacterData()` from `woundState()`:
  - Serious (`woundState == 2`) applies `-2 REF`.
  - Critical (`woundState == 3`) halves REF, INT, and COOL rounded up.
  - Mortal (`woundState >= 4`) reduces REF, INT, and COOL to one third rounded up.
  Therefore this story should update `system.damage` and expose transition evidence; it should not directly update stat totals or wound penalty fields.
- Current structured single-shot resolution writes hit-level `finalDamage` after armor/AP/BTM but does not yet derive wound transitions for real structured hits.
- `planCombatUpdates()` already coalesces actor updates and rejects conflicting paths. If wound planning adds `"system.damage"` updates, keep them JSON-safe and compatible with this merge behavior.
- `combat-commit.js` already applies item updates, embedded item updates, then actor updates. Preserve this order so ammo, staged armor ablation, and target damage remain deterministic.
- Head-hit doubling should be represented as separate wound application evidence. Do not overwrite `rawDamage`, `penetratingDamage`, or Story 3.4 `finalDamage`; those remain mitigation evidence.
- Limb-loss/severing special cases are intentionally surfaced as warnings/follow-ups in this story because save prompt generation belongs to Story 3.6.
- Corebook source notes:
  - Wound boxes advance one box per point of damage taken.
  - Wound bands are Light, Serious, Critical, Mortal, etc.
  - A head hit doubles damage.
  - More than 8 damage to a limb in one attack severs/crushes the limb; a head wound of that type kills automatically.

### Current Files To Read Before Editing

- `module/combat/state-planner.js`
  - Current state: merges already-specified `plannedUpdates`, `actorDeltas`, `itemDeltas`, and `embeddedItemDeltas`; it does not derive target damage from hits.
  - Change for this story: derive or collect wound damage actor updates from target hit outcomes, or accept wound updates prepared by the resolver.
  - Preserve: JSON safety checks, conflict detection, merge behavior, and existing warning codes.
- `module/combat/attack-resolver.js`
  - Current state: resolves attack, hit location, raw damage, armor, AP, staged penetration, BTM, minimum damage, and hit `finalDamage`.
  - Change for this story: add hit wound/special-case evidence only if the wound resolver needs hit-level data before state planning.
  - Preserve: deterministic roller contract, `resolveBodyTypeDamage()`, AP evidence, staged penetration planning, and no Foundry globals.
- `module/combat/combat-outcome.js`
  - Current state: `CombatHitRecord` already has optional `woundTransition`; `CombatTargetOutcome` has optional target-level `damage` and `saves`.
  - Change for this story: document the concrete wound transition and special-case evidence shape.
  - Preserve: plain-data contract module with no Foundry imports.
- `module/combat/combat-chat.js`
  - Current state: copies hit `woundTransition`, target `saves`, warnings, and planned update counts into chat data.
  - Change for this story: expose any new wound damage/special-case evidence in chat data.
  - Preserve: pure data transformation and existing status derivation.
- `module/actor/actor.js`
  - Current state: `woundState()`, `stunThreshold()`, and `deathThreshold()` exist on the Foundry Actor subclass; penalties are derived during `prepareData()`.
  - Change for this story: likely none. Use it as the source of current wound state semantics; do not call Foundry Actor instance methods from pure resolver tests.
- `tests/combat/combat-fixtures.test.js`
  - Current state: validates fixture outcome shape, planned updates, chat data, direct armor resolver behavior, and direct BTM helper behavior.
  - Change for this story: assert wound transition, special-case warnings, and actor update plans.
- `tests/combat/fixtures/ranged-single-shot.json`
  - Current state: covers baseline single shot, armor, AP, staged penetration, BTM, minimum damage, chat evidence, and planned updates.
  - Change for this story: add or extend focused wound transition and special-case cases.

### Project Structure Notes

- Keep pure combat mechanics under `module/combat/`.
- Do not introduce npm tooling, Jest, TypeScript, package metadata, or new dependencies.
- Keep tests runnable outside Foundry with `node tests/run-combat-fixtures.mjs`.
- Do not mutate Foundry documents during resolution or state planning; commit remains the only layer that calls Foundry update APIs.
- Do not edit compendium `.db` files.
- Do not edit `template.json`; this story should use existing `system.damage`.

### Previous Story Intelligence

- Story 3.4 added `resolveBodyTypeDamage()` and clarified that `bodyTypeModifier` is the table magnitude while `bodyTypeMitigation` is actual damage removed.
- Story 3.4 review fixed two important traps:
  - Real actor snapshots use `stats.bt.total`, not `stats.body.total`.
  - Invalid Body Type values must not flow into `btmFromBT()` and accidentally become Superhuman BTM.
- Story 3.4 fixtures now use real `bt` snapshots and include invalid Body Type coverage.
- Story 3.3 staged penetration remains based on armor penetration (`rawDamage > effectiveStoppingPower` after AP-adjusted armor SP), not on post-BTM or wound-box damage.
- Deferred from Story 3.3 review:
  - Multiple penetrations against the same armor item can collapse to one ablation in future multi-hit outcomes.
  - Stale preview can overwrite newer armor ablation on confirm.
  These are still out of scope unless Story 3.5 unexpectedly touches multi-hit commit concurrency.
- Existing Node fixture runs emit a module-type warning because there is no `package.json` with `"type": "module"`; that warning is known and not part of this story.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.5]
- [Source: _bmad-output/planning-artifacts/prds/prd-Cyberpunk2020VTT-2026-05-24/prd.md#FR-13 Wound State and Special Damage Cases]
- [Source: _bmad-output/planning-artifacts/prds/prd-Cyberpunk2020VTT-2026-05-24/addendum.md]
- [Source: _bmad-output/planning-artifacts/architecture.md#AD-5 Preview/Confirm Is Required for Damage Application]
- [Source: _bmad-output/planning-artifacts/architecture.md#AD-6 Planned Updates Are First-Class]
- [Source: _bmad-output/planning-artifacts/architecture.md#4.5 damage-resolver.js]
- [Source: _bmad-output/planning-artifacts/architecture.md#4.7 state-planner.js]
- [Source: docs/cyberpunk-2020-core-rules-extracted.md:9637]
- [Source: docs/cyberpunk-2020-core-rules-extracted.md:9649]
- [Source: docs/cyberpunk-2020-core-rules-extracted.md:9667]
- [Source: module/combat/state-planner.js]
- [Source: module/combat/attack-resolver.js]
- [Source: module/combat/combat-chat.js]
- [Source: module/combat/combat-outcome.js]
- [Source: module/actor/actor.js]
- [Source: tests/combat/combat-fixtures.test.js]

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- Red phase: `node tests/run-combat-fixtures.mjs` failed because wound planning did not derive target damage updates from hit `finalDamage`.
- Green phase: `node tests/run-combat-fixtures.mjs` passed, with the existing Node module-type warning.
- Validation: `python3 -m json.tool tests/combat/fixtures/ranged-single-shot.json >/dev/null` passed.
- Validation: `git diff --check` passed.
- Review fix validation: `node tests/run-combat-fixtures.mjs` passed, with the existing Node module-type warning.
- Review fix validation: `python3 -m json.tool tests/combat/fixtures/ranged-single-shot.json` passed.
- Review fix validation: `git diff --check` passed.

### Completion Notes List

- Added wound planning in `state-planner` to derive `system.damage` actor updates from resolved hit `finalDamage`.
- Added wound transition evidence with previous/next damage, previous/next wound state, labels, and threshold crossing.
- Added head-hit double wound damage evidence and special-case surfacing without implementing Story 3.6 save prompts.
- Added limb-loss threshold warning/special-case evidence for one-attack limb damage over 8.
- Exposed wound damage, wound transition, target damage evidence, and special cases in combat chat data.
- Added direct and fixture coverage for normal wound advancement, no-damage full stop, head-hit doubling, limb threshold, and Serious/Critical/Mortal transitions.
- Review fixes block unsafe wound commits when target damage state is missing or wound damage is invalid, clear stale derived wound data on replanning, preserve existing special cases, surface head automatic-death warnings, and recognize location labels.

### File List

- _bmad-output/implementation-artifacts/3-5-apply-wound-state-and-special-damage-cases.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- module/combat/attack-resolver.js
- module/combat/combat-chat.js
- module/combat/combat-outcome.js
- module/combat/state-planner.js
- tests/combat/combat-fixtures.test.js
- tests/combat/fixtures/ranged-single-shot.json

### Change Log

- 2026-05-27: Created Story 3.5 with wound-state planning, head/limb special-case, and fixture guidance.
- 2026-05-27: Implemented Story 3.5 wound-state planning, special-case evidence, chat exposure, and fixture coverage.
- 2026-05-27: Applied code-review fixes for unsafe wound planning, stale replanning data, location labels, head critical warnings, special-case merging, and integer wound damage validation.

### Review Findings

- [x] [Review][Patch] Missing damage snapshot silently skips wound commits while allowing ammo/armor commits [module/combat/state-planner.js:48]
- [x] [Review][Patch] Replanning can leave stale derived wound fields on reused or patched outcomes [module/combat/state-planner.js:58]
- [x] [Review][Patch] Head/limb detection ignores target hit-location labels and custom keys [module/combat/state-planner.js:191]
- [x] [Review][Patch] Head damage over 8 does not surface the automatic-death follow-up required by the story [module/combat/state-planner.js:129]
- [x] [Review][Patch] Existing hit `specialCases` can be overwritten by wound planning [module/combat/state-planner.js:63]
- [x] [Review][Patch] Fractional wound damage can be persisted to `system.damage` [module/combat/state-planner.js:182]
- [x] [Review][Defer] Stale preview can overwrite newer target damage on confirm [module/combat/state-planner.js:49] — deferred, pre-existing
