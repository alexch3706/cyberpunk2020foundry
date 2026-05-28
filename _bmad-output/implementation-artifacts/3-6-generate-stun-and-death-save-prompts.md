# Story 3.6: Generate Stun and Death Save Prompts

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a referee,
I want damage outcomes to identify required Stun/Shock and Death Saves,
so that follow-up saves are visible immediately after damage resolution.

## Acceptance Criteria

1. Given final damage applies positive wound-box damage to a Target Actor
   When save resolution runs after wound planning
   Then the outcome includes a pending Stun/Shock Save prompt with Body Type, wound state, wound-state penalty, and final target threshold evidence.
2. Given final damage changes or confirms a Mortal wound state
   When save resolution runs
   Then the outcome includes a pending Death Save prompt with Body Type, Mortal level, mortality penalty, and final target threshold evidence.
3. Given a target is already Mortal and damage does not add new wound boxes
   When save resolution runs from existing target damage state
   Then the outcome includes a lightweight recurring Mortal Death Save reminder without requiring new persisted actor state.
4. Given armor/AP/BTM leave `finalDamage <= 0` and the target is not Mortal
   When save resolution runs
   Then no Stun/Shock or Death Save prompt is created.
5. Given target Body Type or damage state is unavailable or invalid
   When save resolution runs
   Then save automation is blocked with a warning/manual-resolution reason instead of silently calculating thresholds from bogus data.
6. Given fixture checks are run
   When `node tests/run-combat-fixtures.mjs` executes
   Then fixtures cover Serious, Critical, Mortal, Stun threshold, Death threshold, no-damage non-Mortal, existing Mortal reminder, and missing-data warning cases.

## Tasks / Subtasks

- [x] Add pure save prompt resolution. (AC: 1, 2, 3, 4, 5)
  - [x] Add `module/combat/save-resolver.js` unless a smaller local helper is demonstrably clearer.
  - [x] Keep it Foundry-independent, JSON-serializable, and callable from fixtures without `game`, `Actor`, `ChatMessage`, or sheet classes.
  - [x] Inputs should be plain target outcome data, current/next damage evidence, and target Body Type from `target.snapshot.stats.bt.total` with `stats.body.total` only as a defensive fallback.
  - [x] Outputs should be stable prompt records suitable for `CombatTargetOutcome.saves`.
- [x] Wire saves into the existing damage planning pipeline. (AC: 1, 2, 3, 4)
  - [x] Run save prompt resolution after wound transition evidence exists so prompts use the same `previousDamage`, `nextDamage`, and wound state labels as Story 3.5.
  - [x] Attach prompts to `targetOutcome.saves`; do not persist save state in this story.
  - [x] Preserve existing actor damage, armor/staged penetration, ammo, warning, and chat-status planning behavior.
  - [x] Do not create prompts for misses, manual-resolution targets, missing actor UUIDs, or hits with no positive wound damage unless the target is already Mortal and needs a recurring reminder.
- [x] Define clear Stun/Shock Save evidence. (AC: 1, 4, 5)
  - [x] Calculate Stun/Shock threshold from Body Type minus the current post-damage wound-state penalty.
  - [x] Use wound-state penalties matching the core table: Light 0, Serious -1, Critical -2, Mortal -3, Mortal 1 -4, Mortal 2 -5, continuing by Mortal level.
  - [x] Represent prompt status as `pending`; this story must not roll the save or mark pass/fail automatically.
  - [x] Include reason/evidence fields that let chat explain why the save is required.
- [x] Define clear Death Save evidence and Mortal reminders. (AC: 2, 3, 5)
  - [x] Create Death Save prompts only when the post-damage state is Mortal or worse.
  - [x] Calculate Death Save threshold from Body Type minus Mortal level; Mortal 0 has penalty 0, Mortal 1 has penalty 1, etc.
  - [x] Add a recurring Mortal reminder prompt/evidence for already-Mortal targets even if no new damage is applied, as long as target damage state is available.
  - [x] Keep stabilization/treatment tracking out of scope unless it can be represented as non-persisted reminder text/evidence.
- [x] Update outcome and chat contracts. (AC: 1, 2, 3, 5)
  - [x] Extend `module/combat/combat-outcome.js` typedefs for save prompt fields: `type`, `threshold`, `bodyType`, `woundState`, `penalty`, `status`, `reason`, and optional reminder metadata.
  - [x] Update `module/combat/combat-chat.js` so preview/commit/manual chat data exposes target saves without recomputing thresholds.
  - [x] Avoid duplicating save formulas in templates or chat rendering; chat must consume resolver evidence.
- [x] Add deterministic fixture coverage. (AC: 1, 2, 3, 4, 5, 6)
  - [x] Extend `tests/combat/combat-fixtures.test.js` with direct helper/resolver assertions for Stun and Death thresholds.
  - [x] Extend `tests/combat/fixtures/ranged-single-shot.json` or add a focused save fixture file for Serious, Critical, Mortal, existing-Mortal reminder, no-damage non-Mortal, and missing Body Type/damage cases.
  - [x] Assert outcome saves, plan warnings/manual blocks, and `buildCombatChatData()` output stay consistent.
  - [x] Run `node tests/run-combat-fixtures.mjs` and record the result in the Dev Agent Record.

### Review Findings

- [x] [Review][Patch] Mortal 0 wound state is labeled as Mortal 1, and its Death Save penalty is incorrect [module/combat/save-resolver.js:166]
- [x] [Review][Patch] Save prompts generated for targets missing actor UUIDs [module/combat/state-planner.js:117]
- [x] [Review][Patch] Recurring Death Save reminders are generated on missed attacks [module/combat/save-resolver.js:138]
- [x] [Review][Patch] Unhandled TypeError when targetOutcome.hits is a truthy non-array object [module/combat/save-resolver.js:94]
- [x] [Review][Patch] Save thresholds can become negative or zero when wound/mortality penalty exceeds Body Type [module/combat/save-resolver.js:129]
- [x] [Review][Patch] Bypassed warnings in cannotResolveTargetSaves short-circuit [module/combat/state-planner.js:117]
- [x] [Review][Defer] Missing checks for deceased status [module/combat/save-resolver.js:12] — deferred, pre-existing

## Dev Notes


- Story 3.5 is complete in commit `dda7fc6 Apply wound state and special damage cases`; start from that code and its review fixes.
- Story 3.6 owns pending Stun/Shock and Death Save prompt evidence only. It must not implement actual save rolling, unconscious/dead state mutation, stabilization tracking, or treatment workflows.
- Existing actor damage is numeric `system.damage`; `CyberpunkActor.woundState()` derives state as `0` for no damage and `Math.ceil(system.damage / 4)` after that. Keep using derived damage evidence; do not add a persisted wound-state field.
- Existing `CyberpunkActor.stunThreshold()` and `deathThreshold()` are useful reference behavior but should not be called from pure resolver code because they require Foundry Actor instances. Mirror the formula in pure helper code with fixture coverage.
- Current actor formulas:
  - `stunThreshold()` is `stats.bt.total - woundState() + 1`.
  - `deathThreshold()` is `stunThreshold() + 3`.
  These correspond to Stun penalties beginning at Light 0 / Serious -1 / Critical -2 / Mortal -3 and Death penalties beginning at Mortal 0.
- Story 3.5 `planCombatUpdates()` mutates outcome hit records to add `woundDamage`, `woundTransition`, target-level `damage`, and actor update plans. If saves are added in planning, clear stale derived save fields before recomputing so reused outcomes do not retain old prompts.
- Missing or invalid Body Type must not accidentally become `0` and produce misleading save thresholds. Story 3.4 already fixed the analogous BTM trap by preferring `stats.bt.total` and treating invalid values defensively.
- No persisted save/reminder state is required for MVP. If a future implementation wants recurring Mortal tracking in actor data, it needs separate template/migration review.
- Corebook source notes, paraphrased:
  - Every time a character takes damage, they must make a Stun/Shock Save.
  - Stun/Shock Save uses Body Type minus a penalty based on current wound state.
  - Death Saves are required only for Mortal wounds and recur each turn until the character is stabilized.
  - Death Save target is Body Type minus Mortal severity.

### Current Files To Read Before Editing

- `module/combat/state-planner.js`
  - Current state: merges explicit update plans and derives wound damage transitions from hit `finalDamage`.
  - Change for this story: run save prompt derivation after wound planning, or call a save resolver from the same point where target-level damage evidence is available.
  - Preserve: JSON safety checks, update conflict handling, stale derived wound cleanup, and existing warning codes.
- `module/combat/combat-outcome.js`
  - Current state: `CombatSavePrompt` exists but is minimal and `CombatTargetOutcome.saves` is already part of the contract.
  - Change for this story: document the concrete Stun/Shock, Death Save, and Mortal reminder evidence shape.
  - Preserve: plain-data contract module with no Foundry imports.
- `module/combat/combat-chat.js`
  - Current state: copies `targetOutcome.saves` into chat data and exposes hit/wound evidence.
  - Change for this story: ensure save prompt evidence survives chat transformation and tests assert it.
  - Preserve: pure data transformation and status derivation.
- `module/combat/attack-resolver.js`
  - Current state: resolves hit, damage, armor/AP/BTM, staged penetration, and initializes `saves: []`.
  - Change for this story: likely none unless save resolver needs earlier per-hit evidence before state planning.
  - Preserve: deterministic roller contract, AP/BTM evidence, and no Foundry globals.
- `module/actor/actor.js`
  - Current state: defines `woundState()`, `stunThreshold()`, `deathThreshold()`, and existing roll UI for Stun/Death saves.
  - Change for this story: likely none. Use as reference only; pure resolver code should not import it.
- `tests/combat/combat-fixtures.test.js`
  - Current state: has direct wound-planning assertions and fixture-driven outcome/plan/chat checks.
  - Change for this story: add direct save resolver/planner assertions and chat assertions.
- `tests/combat/fixtures/ranged-single-shot.json`
  - Current state: covers baseline single shot, armor, AP, staged penetration, BTM, wound transitions, and special cases.
  - Change for this story: add or extend focused save prompt cases.

### Project Structure Notes

- Keep pure combat mechanics under `module/combat/`.
- Do not introduce npm tooling, Jest, TypeScript, package metadata, or new dependencies.
- Keep tests runnable outside Foundry with `node tests/run-combat-fixtures.mjs`.
- Do not mutate Foundry documents during resolution or state planning; commit remains the only layer that calls Foundry update APIs.
- Do not edit `template.json`; this story does not require persisted save state.
- Do not edit compendium `.db` files.

### Previous Story Intelligence

- Story 3.5 added wound planning in `state-planner` and derives actor `"system.damage"` updates from hit `finalDamage`.
- Story 3.5 distinguishes mitigation `finalDamage` from wound application `woundDamage`; head hits can double wound damage without overwriting raw/penetrating/final damage evidence.
- Story 3.5 review fixed stale derived wound fields on replanning. Apply the same stale-data discipline to `saves`.
- Story 3.5 blocks unsafe wound commits when target damage state is missing or wound damage is invalid. Save prompt calculation should follow the same defensive approach for Body Type and damage state.
- Story 3.5 surfaces head/limb special cases as warnings/follow-ups. Do not conflate head automatic death warning with Death Save prompt automation unless the target's post-damage wound state is Mortal and the save rules apply.
- Existing Node fixture runs emit a module-type warning because there is no `package.json` with `"type": "module"`; that warning is known and not part of this story.

### Git Intelligence Summary

- Recent commits show a narrow incremental pattern: armor layering, AP/staged penetration, BTM, wound state, then this save prompt story.
- The most recent implementation commit is `dda7fc6 Apply wound state and special damage cases`.
- Continue the established pattern of pure module changes plus fixture coverage rather than broad Foundry UI rewrites.

### Latest Technical Information

- No external API or library version research is required for this story. The implementation uses existing plain JavaScript ES modules, Foundry document boundaries, and the local fixture runner only.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.6]
- [Source: _bmad-output/planning-artifacts/prds/prd-Cyberpunk2020VTT-2026-05-24/prd.md#FR-14 Stun and Death Save Prompts]
- [Source: _bmad-output/planning-artifacts/prds/prd-Cyberpunk2020VTT-2026-05-24/addendum.md#Suggested Verification Fixtures]
- [Source: _bmad-output/planning-artifacts/architecture.md#4.6 save-resolver.js]
- [Source: _bmad-output/planning-artifacts/architecture.md#AD-5 Preview/Confirm Is Required for Damage Application]
- [Source: _bmad-output/planning-artifacts/architecture.md#AD-6 Planned Updates Are First-Class]
- [Source: docs/cyberpunk-2020-core-rules-extracted.md:9487]
- [Source: docs/cyberpunk-2020-core-rules-extracted.md:9765]
- [Source: docs/cyberpunk-2020-core-rules-extracted.md:9806]
- [Source: module/combat/state-planner.js]
- [Source: module/combat/combat-outcome.js]
- [Source: module/combat/combat-chat.js]
- [Source: module/actor/actor.js]
- [Source: tests/combat/combat-fixtures.test.js]

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- Red phase: `node tests/run-combat-fixtures.mjs` failed because `module/combat/save-resolver.js` did not exist.
- Green phase: `node tests/run-combat-fixtures.mjs` passed, with the existing Node module-type warning.
- Validation: `python3 -m json.tool tests/combat/fixtures/ranged-single-shot.json >/dev/null` passed.
- Validation: `git diff --check` passed.

### Completion Notes List

- Added pure `resolveSavePromptsForTarget()` logic for pending Stun/Shock prompts, Death Save prompts, and recurring Mortal reminders.
- Integrated save prompt derivation into `planCombatUpdates()` after wound planning, without persisting save state or calling Foundry APIs.
- Added defensive missing Body Type and missing/invalid damage handling so save thresholds are not silently calculated from bogus values.
- Extended the `CombatSavePrompt` contract documentation and verified chat data passes save prompt evidence through unchanged.
- Added direct fixture assertions for Serious, Critical, Mortal, recurring Mortal, no-damage non-Mortal, and missing-data save cases.
- Updated baseline ranged fixture chat evidence to include the new pending Stun/Shock prompt.

### File List

- _bmad-output/implementation-artifacts/3-6-generate-stun-and-death-save-prompts.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- module/combat/combat-outcome.js
- module/combat/save-resolver.js
- module/combat/state-planner.js
- tests/combat/combat-commit.test.js
- tests/combat/combat-fixtures.test.js
- tests/combat/fixtures/ranged-single-shot.json

### Change Log

- 2026-05-27: Implemented Story 3.6 save prompt resolver, planning integration, contract updates, and fixture coverage.
