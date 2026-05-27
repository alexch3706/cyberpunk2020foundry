# Story 2.6: Add Single-Shot Fixtures and Foundry Manual Checks

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a maintainer,
I want fixtures and documented manual checks for the first end-to-end firearm flow,
so that future combat resolver changes do not break target context, hit resolution, ammo planning, preview/confirm, or chat evidence.

## Acceptance Criteria

1. Given deterministic fixtures from Epic 1, when single-shot fixtures are run, then they verify target normalization, hit/miss outcome shape, hit location, ammo planned update, and manual-resolution fallback.
2. Given the end-to-end single-shot flow is complete, when verified manually, then a documented Foundry check covers actor sheet attack launch, target selection, preview dialog, confirm/cancel, and chat rendering.

## Tasks / Subtasks

- [x] Verify and ensure single-shot fixtures coverage. (AC: 1)
  - [x] Assert target normalization verifies actor-backed, actorless, and plain target scenarios.
  - [x] Assert hit/miss outcome shape verifies attack total, range DC, modifiers, and die metadata.
  - [x] Assert hit location and ammo planned updates are verified against expected values.
  - [x] Assert manual-resolution fallback is triggered when actor context is missing.
- [x] Create a comprehensive manual testing guide for Foundry VTT. (AC: 2)
  - [x] Create [docs/testing/foundry-manual-checks.md](file:///Users/alexanderchuprikov/Documents/Code/Tabletop/Cyberpunk2020VTT/docs/testing/foundry-manual-checks.md) markdown file.
  - [x] Document step-by-step setup for a test scene (creating attacker/target actors and tokens, equipping weapons and armor).
  - [x] Document actor sheet attack launch path (opening sheet, selecting weapon, clicking roll).
  - [x] Document target selection (targeting tokens on scene).
  - [x] Document preview dialog validation (checking values shown in preview card).
  - [x] Document confirm flow (verifying ammo delta and damage application to target sheet, checking updated chat card).
  - [x] Document cancel flow (verifying no state change occurs, checking updated chat card).
  - [x] Document manual-resolution flows (missing target actor, insufficient ammo, and resolving manually).
- [x] Perform validation checks. (AC: 1, 2)
  - [x] Verify test suite `node tests/run-combat-fixtures.mjs` runs and passes successfully.

### Review Findings

- [x] [Review][Patch] Clarify armor ablation conditionality in Section 2.4 [docs/testing/foundry-manual-checks.md:71]
- [x] [Review][Patch] Document hit location assumption in example calculations [docs/testing/foundry-manual-checks.md:64]
- [x] [Review][Patch] Clarify GM permissions requirement for manual resolution [docs/testing/foundry-manual-checks.md:109]
- [x] [Review][Patch] Add instructions for executing manual test suite [docs/testing/foundry-manual-checks.md:1]
- [x] [Review][Patch] Add explicit steps for GM manual mutation of defender sheets [docs/testing/foundry-manual-checks.md:98]
- [x] [Review][Defer] Critical Success and Fumble manual verification [docs/testing/foundry-manual-checks.md:57] — deferred, pre-existing
- [x] [Review][Defer] Untargeted Ranged Attack Flow [docs/testing/foundry-manual-checks.md:1] — deferred, pre-existing
- [x] [Review][Defer] Node.js ES Module Parsing Warning [tests/combat/combat-fixtures.test.js:1] — deferred, pre-existing

## Dev Notes

### Scope Boundary

This story focuses on consolidating and documenting the test coverage for Epic 2. The code logic for single-shot firearms is already fully implemented, and the automated tests in `tests/combat/combat-fixtures.test.js` already parse and assert the `ranged-single-shot.json` fixture.

The primary deliverable of this story is ensuring that this automated fixture matches the full spec requirements, and authoring a high-quality manual testing guide `docs/testing/foundry-manual-checks.md` that walk GMs or developers through manually verifying all UI/UX details within Foundry VTT (since UI dialogs and Foundry document persistence cannot be fully mock-tested).

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` - Story 2.6]
- [Source: `tests/combat/combat-fixtures.test.js` - automated fixtures]
- [Source: `tests/combat/fixtures/ranged-single-shot.json` - fixture data]
- [Source: `module/combat/combat-commit.js` - commit logic]

## Dev Agent Record

### Agent Model Used

Gemini 1.5 Pro (Antigravity)

### Debug Log References

- Executed `node tests/run-combat-fixtures.mjs` successfully verifying all unit tests and fixtures.

### Completion Notes List

- Verified automated single-shot fixtures coverage for target normalization, hit/miss outcome, hit location, and ammo updates.
- Created `docs/testing/foundry-manual-checks.md` with structured manual checking instructions for Foundry VTT.
- Both automated and manual testing baselines for Epic 2 are fully in place.

### File List

- `docs/testing/foundry-manual-checks.md`
- `_bmad-output/implementation-artifacts/2-6-add-single-shot-fixtures-and-foundry-manual-checks.md`
