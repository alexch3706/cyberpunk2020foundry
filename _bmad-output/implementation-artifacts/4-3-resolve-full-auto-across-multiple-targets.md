---
baseline_commit: 95de336eec9b775de2994c2c552fdae1832af820
---
# Story 4.3: Resolve Full Auto Across Multiple Targets

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a referee,
I want full auto across multiple targets to preserve per-target context,
so that ROF division, target rounding, range, hit count, and damage are auditable per target.

## Acceptance Criteria

1. **Given** an automatic weapon and multiple selected targets
2. **When** full auto is resolved
3. **Then** ROF is divided by target count and rounded down per core rule reference
4. **And** each target outcome preserves target actor context, rounds fired, hit count, locations, damage, warnings, and manual-resolution fallback.

## Tasks / Subtasks

- [x] Route multi-target full-auto in combat-resolver.js (AC: 1, 2)
  - [x] Modify `canResolveSingleShotRangedContext` in `module/combat/combat-resolver.js` to allow `context.targets.length > 1` when `fireMode` is `"fullauto"`.
- [x] Implement multi-target full-auto resolution in attack-resolver.js (AC: 2, 3, 4)
  - [x] Update `buildModifierEvidence` to respect `action.roundsFiredPerTarget` if defined, using it as the number of bullets for calculating the `fullAuto` modifier: `const bullets = action.roundsFiredPerTarget !== undefined ? action.roundsFiredPerTarget : Math.max(0, Math.min(shotsLeft, rof));`
  - [x] In `resolveSingleShotRangedAttack`:
    - [x] Calculate `roundsFiredPerTarget` for `"fullauto"` mode as `Math.floor(maxRoundsFired / targetCount)`.
    - [x] Calculate the total `roundsFired = roundsFiredPerTarget * targetCount`.
    - [x] When `fireMode === "fullauto"` and `targetCount > 1`, resolve each target in `context.targets` individually:
      - [x] Create a target-specific action snapshot.
      - [x] Clear `targetArea` for target indices > 0 to ensure aimed shot modifiers and aimed location rules only apply to the first target.
      - [x] Assign `roundsFiredPerTarget` to the target-specific action.
      - [x] Generate target-specific `modifierEvidence` using the target-specific action.
      - [x] Perform a separate attack roll for the target using `buildAttackRollRequest` and `normalizeAttackRoll(roll(roller, targetAttackRequest), targetAttackRequest)`.
      - [x] Pass the target-specific attack roll, modifiers, and `roundsFiredPerTarget` to `buildTargetOutcome`.
    - [x] Maintain single-target behavior for single target or other modes so they do not regress.
- [x] Add deterministic tests and fixtures (AC: 3, 4)
  - [x] Add a new multi-target test case in `tests/combat/fixtures/ranged-full-auto.json`.
  - [x] The test case should configure 2 targets, a weapon with ROF 25, and shotsLeft 25, resolving to:
    - [x] `roundsFiredPerTarget = 12`.
    - [x] `roundsFired = 24` (remaining ammo 1).
    - [x] 2 separate attack rolls (one for each target).
    - [x] Correct range modifiers based on 12 bullets per target.
  - [x] Run and verify tests using `node tests/run-combat-fixtures.mjs`.

## Dev Notes

- **Aimed Shots**: Aimed shots modifier (-4) and specific location selection only apply to the first hit on the first target. Ensure that for all targets at index > 0 and hits at index > 0, `targetArea` is cleared.
- **Rounds Fired & Ammo Planning**: The total rounds fired from the weapon is `roundsFiredPerTarget * targetCount`. This must be passed to `buildAmmoPlanning` to deduct the correct total ammo in a single transaction.
- **Separate Attack Rolls**: Since each target has its own attack roll, you must call the roller once per target when mapping.

### Project Structure Notes

- All changes belong in the resolver library `module/combat/`.
- Do not commit updates directly; return planned updates to the preview confirm workflow.

### References

- [Source: module/combat/combat-resolver.js#L42-70] (canResolveSingleShotRangedContext target limits)
- [Source: module/combat/attack-resolver.js#L23-75] (resolveSingleShotRangedAttack baseline)
- [Source: module/combat/attack-resolver.js#L692-714] (buildModifierEvidence full auto logic)
- [Source: tests/combat/fixtures/ranged-full-auto.json] (Full auto test fixtures)

## Dev Agent Record

### Agent Model Used

Gemini 3.5 Flash (Medium)

### Debug Log References

### Completion Notes List

- Implemented routing for multi-target full-auto in `module/combat/combat-resolver.js` to allow `targets.length > 1` when using `fireMode === "fullauto"`.
- Implemented multi-target resolution in `module/combat/attack-resolver.js`:
  - Calculate `roundsFiredPerTarget` based on total rounds fired divided by target count.
  - Calculate the correct total `roundsFired` to deduct total ammunition used in a single transaction.
  - Resolve each target individually with separate attack rolls and target-specific modifier calculations.
  - Correctly clear aimed shot `targetArea` modifier and location selection for subsequent targets (index > 0).
  - Update `buildModifierEvidence` to respect `roundsFiredPerTarget` for the full-auto modifier calculation.
- Added a new multi-target deterministic test case in `tests/combat/fixtures/ranged-full-auto.json` using 2 targets and a weapon with ROF 25.
- Ran and verified the entire test suite successfully.

### File List

- `module/combat/combat-resolver.js`
- `module/combat/attack-resolver.js`
- `tests/combat/fixtures/ranged-full-auto.json`

### Change Log

- 2026-05-28: Initial implementation and verification of multi-target full-auto resolution.
