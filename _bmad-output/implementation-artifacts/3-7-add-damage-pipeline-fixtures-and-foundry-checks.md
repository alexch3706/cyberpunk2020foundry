# Story 3.7: Add Damage Pipeline Fixtures and Foundry Checks

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a maintainer,
I want deterministic fixtures and manual checks for armor/AP/BTM/wound/save behavior,
so that future changes cannot silently regress core combat outcomes.

## Acceptance Criteria

1. Given Epic 3 resolver behavior
   When fixtures run
   Then they cover unarmored hit, fully stopped armor hit, AP shot, BTM minimum damage, head hit, limb threshold, wound transitions, Stun Save, Death Save, and staged penetration setting behavior.
2. Given Epic 3 resolver behavior
   When the Foundry manual check checklist is executed
   Then a Foundry manual check verifies preview/confirm persists damage and armor changes without chat/state divergence.

## Tasks / Subtasks

- [x] Extend fixture test suite coverage (AC: 1)
  - [x] Review `tests/combat/fixtures/ranged-single-shot.json` and identify missing coverage cases (like unarmored hit, fully stopped hit, Death Save, etc.).
  - [x] Add explicit fixture test cases to cover all 10 required damage pipeline behaviors.
  - [x] Verify that `node tests/run-combat-fixtures.mjs` executes and assertions pass.
- [x] Create Foundry manual check checklist (AC: 2)
  - [x] Add a step-by-step verification checklist for the preview/confirm dialog damage application.
  - [x] Verify that preview and confirm updates persist damage and armor changes on target actors without divergence from the chat card.

## Dev Notes

- Relevant files to touch/create:
  - `tests/combat/fixtures/ranged-single-shot.json`: Add new structured fixture test cases.
  - `tests/combat/combat-fixtures.test.js`: Update assertions or run calls if needed.
  - `docs/foundry-manual-verification.md` or a checklist section in the story file for manual checking.
- Keep tests runnable outside Foundry with `node tests/run-combat-fixtures.mjs`.

### Project Structure Notes

- Testing code lives in `tests/combat/`.
- Combat mechanics modules live in `module/combat/`.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.7]
- [Source: _bmad-output/planning-artifacts/prds/prd-Cyberpunk2020VTT-2026-05-24/addendum.md#Suggested Verification Fixtures]
- [Source: module/combat/state-planner.js]
- [Source: module/combat/save-resolver.js]
- [Source: tests/combat/combat-fixtures.test.js]

## Dev Agent Record

### Agent Model Used

Antigravity

### Debug Log References

- Executed `node tests/run-combat-fixtures.mjs` to verify test outcome success.
- Cleaned up console debugging statements.

### Completion Notes List

- Added three new single-shot ranged test fixtures to cover unarmored hit, Mortal wound state saves (Stun & Death saves), and recurring Death Save reminder.
- Fixed a bug in `module/combat/state-planner.js` where level 4 wound state (damage 13-16) was incorrectly mapped to label "Mortal 1" instead of "Mortal 0".
- Corrected expectations in `tests/combat/combat-fixtures.test.js` to expect "Mortal 0" for level 4 wound state transitions.
- Expanded `docs/testing/foundry-manual-checks.md` with Section 6 covering all Epic 3 mechanics: AP & Staged Penetration, Armor Layering & Cover, BTM & Minimum Damage, Head/Limb thresholds, and Stun/Death save prompts.

### File List

- `tests/combat/fixtures/ranged-single-shot.json`
- `tests/combat/combat-fixtures.test.js`
- `module/combat/state-planner.js`
- `docs/testing/foundry-manual-checks.md`

### Change Log

- Completed Story 3.7: Added unarmored hit, Mortal wound state saves, and recurring death save reminders test cases to single-shot ranged attack fixtures; aligned Mortal wound labeling in state planner; expanded Foundry manual verification checklist with Epic 3 mechanics.

### Review Findings

- [x] [Review][Defer] Duplication of woundStateLabel function in state planner and save resolver [module/combat/state-planner.js:276] — deferred, pre-existing
- [x] [Review][Defer] Duplication of normalizeDamageValue function in state planner and save resolver [module/combat/state-planner.js:283] — deferred, pre-existing
- [x] [Review][Defer] Cover resolved as standard armor layer in resolveArmor [module/combat/armor-resolver.js:98] — deferred, pre-existing
- [x] [Review][Defer] Ablation applied to personal armor instead of cover when cover is bypassed/penetrated [module/combat/armor-resolver.js:28] — deferred, pre-existing
- [x] [Review][Defer] Skinweave and Subdermal Armor (cyberware) ignored during staged armor ablation [module/combat/armor-resolver.js:58] — deferred, pre-existing
- [x] [Review][Defer] Hardcoded limb keys in LIMB_LOCATION_KEYS omit hand/foot/lhand/rfoot [module/combat/state-planner.js:15] — deferred, pre-existing
- [x] [Review][Defer] Death save reminders generated even if target is stabilized [module/combat/save-resolver.js:60] — deferred, pre-existing
- [x] [Review][Defer] Death saves generated for targets above Mortal 6 who should be dead [module/combat/save-resolver.js:100] — deferred, pre-existing
- [x] [Review][Defer] Inconsistent validation of wound damage in cannotResolveTargetSaves and resolveDamageEvidence [module/combat/state-planner.js:117,120] — deferred, pre-existing
- [x] [Review][Defer] Death save reminders triggered on attacks instead of target turn [module/combat/save-resolver.js:60] — deferred, pre-existing
