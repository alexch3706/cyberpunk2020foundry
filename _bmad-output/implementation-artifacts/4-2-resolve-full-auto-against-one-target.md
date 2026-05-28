# Story 4.2: Resolve Full Auto Against One Target

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a referee,
I want full auto against one target to calculate hits and ammo consistently,
so that automatic fire does not require manual hit counting or duplicate state updates.

## Acceptance Criteria

1. **Given** an automatic weapon and one Target Actor
2. **When** full auto is resolved
3. **Then** rounds fired, range modifier, attack total, hit count capped by rounds fired and success margin, hit locations, damage entries, and ammo delta are represented in the outcome
4. **And** all state changes use the shared state planner and preview/confirm flow.

## Tasks / Subtasks

- [x] Route full-auto mode in combat-resolver.js (AC: 1, 2)
  - [x] Add `"fullauto"` to `isSupportedSingleShotRangedContext` in `module/combat/combat-resolver.js`
  - [x] Update `canResolveSingleShotRangedContext` to validate `"fullauto"` against a single target and ensure the weapon has ammo.
  - [x] Route `"fullauto"` to `resolveSingleShotRangedAttack` (or a dedicated full-auto resolver) in `resolveCombatAction`.
- [x] Implement full-auto resolution logic in attack-resolver.js (AC: 2, 3, 4)
  - [x] Support `"fullauto"` fireMode in `resolveSingleShotRangedAttack`.
  - [x] Calculate `roundsFired` as `Math.min(shotsLeft, rof)`.
  - [x] Calculate the full-auto attack modifier in `buildModifierEvidence` based on range and bullets fired:
    - Close range (`ranges.close` / `"RangeClose"`): `+1` per 10 bullets fired (floored).
    - Point Blank range (`ranges.pointBlank` / `"RangePointBlank"`): `0` (no modifier).
    - Medium, Long, Extreme range: `-1` per 10 bullets fired (floored).
    - Formula: `multiplier * Math.floor(bullets / 10)` where multiplier is `1` for Close, `0` for Point Blank, and `-1` for others.
  - [x] Calculate hit count `roundsHit` on success (margin >= 0) as `Math.min(roundsFired, margin)` where `margin = attackRoll.total - targetNumber`. Ensure `roundsHit` is at least 1 on success (or strictly `Math.max(1, Math.min(roundsFired, margin))` depending on corebook interpretation - note: legacy code used `Math.min(roundsFired, attackRoll.total - DC)` but capped it at 0, meaning an exact hit would be 0 hits; verify and align with corebook where exact hit = 1 bullet hits).
  - [x] Loop over `roundsHit` to resolve hits independently:
    - For the first hit, use the targeted area (`targetArea`) if specified. For subsequent hits, clear `targetArea` to ensure they hit random locations (similar to Story 4.1 burst handling: `if (i > 0) { hitAction.targetArea = undefined; }`).
    - Roll D10 for hit location for each random hit.
    - Roll damage independently using the weapon's damage formula.
    - Apply armor SP, AP halving, staged penetration with progressive ablation using the existing `resolveArmor` and `accumulatedAblations` pattern.
    - Calculate BTM and wound transitions using `resolveBodyTypeDamage` and `planCombatUpdates`.
  - [x] Plan ammunition consumption once using `buildAmmoPlanning(weapon, roundsFired)`.
- [x] Support full-auto rendering in combat-chat.js (AC: 3)
  - [x] Map full-auto outcomes and hits to chat templates (reuse `combat-outcome.hbs` and templates).
- [x] Add deterministic tests and fixtures (AC: 1, 2, 3, 4)
  - [x] Create test cases in `tests/combat/fixtures/ranged-single-shot.json` or create a new `tests/combat/fixtures/ranged-full-auto.json` fixture.
  - [x] Test cases must cover: full-auto hit calculation, range modifier (+1/-1 per 10 bullets), multi-hit resolution with progressive ablation, and ammo deduction.
  - [x] Register the fixture in `tests/combat/combat-fixtures.test.js` and run it via `node tests/run-combat-fixtures.mjs`.

### Review Findings

- [x] [Review][Patch] Incorrect hit count calculation when roundsFired is 0 [module/combat/attack-resolver.js:296]
- [x] [Review][Patch] Falsy or negative weapon RoF/ammo values cause NaN/negative values to propagate [module/combat/attack-resolver.js:42]

## Dev Notes

- **Fire Mode Identifier**: The fireMode string passed in the context is `"FullAuto"` (from `fireModes.fullAuto` in lookup).
- **Rounds Fired & Clamping**: `roundsFired` must be clamped by both the weapon's RoF (`rof`) and the remaining ammo (`shotsLeft`). Do not consume more ammo than is available.
- **Full-Auto Modifier**: Unlike burst which is a flat +3 at Close/Medium, full-auto modifier is dynamic: `Math.floor(bullets / 10)` * multiplier. Ensure the modifier is correctly calculated in `buildModifierEvidence` and added to `modifierEvidence` so it is serialized in the chat templates.
- **Ablation Accumulation**: Make sure to use the progressive ablation pattern established in Story 4.1 to prevent multiple hits to the same location from overwriting each other's ablation updates in `accumulatedAblations`.
- **Aimed Shots**: Aimed shots modifier (-4) only applies to the first hit. Subsequent hits must hit random locations (ensure `hitAction.targetArea = undefined` for hits index > 0).

### Project Structure Notes

- Keep all resolver code inside `module/combat/` and adaptation code inside `module/item/item.js` or `module/combat/combat-resolver.js`.
- No direct database updates (`update()`) are allowed inside the resolver. Use `plannedUpdates` and delegate the actual commit to `combat-commit.js` / preview confirm flow.

### References

- [Source: module/item/item.js#L389-434] (Legacy `__fullAuto` logic)
- [Source: module/item/item.js#L155-163] (Legacy `__shootModTerms` autofire modifier)
- [Source: module/combat/combat-resolver.js#L36-40] (Supported fire modes check)
- [Source: module/combat/attack-resolver.js#L23-68] (Ranged attack resolution pattern)
- [Source: _bmad-output/planning-artifacts/architecture.md#Section-4] (Structured resolution pipeline)

## Dev Agent Record

### Agent Model Used

Gemini 3.5 Flash (Medium)

### Debug Log References

- Verified all combat tests and fixtures run correctly via `node tests/run-combat-fixtures.mjs`

### Completion Notes List

- Guided routing of `"fullauto"` fire mode inside `combat-resolver.js` ensuring single target and valid ammo checks.
- Implemented full-auto resolution mechanism inside `attack-resolver.js`:
  - Computed `roundsFired` using weapon `rof` and `shotsLeft` limit.
  - Calculated dynamic full-auto modifier based on range and bullets fired: +1 per 10 bullets at Close range, -1 per 10 bullets at Medium/Long/Extreme range, and 0 at Point Blank range.
  - Calculated hits count on success: capped by `roundsFired` and success margin, with at least 1 hit on success.
  - Resolved multi-hit combat events sequentially with progressive ablation (staged penetration support) and damage/BTM checks.
  - Planned ammo consumption in a single transaction.
- Mapped results to standard chat outcome rendering, utilizing existing Handlebars helpers.
- Added comprehensive unit testing with `ranged-full-auto.json` fixture verifying Close, Point Blank, and Medium range cases.

### File List

- `module/combat/combat-resolver.js` (modified)
- `module/combat/attack-resolver.js` (modified)
- `tests/combat/combat-fixtures.test.js` (modified)
- `tests/combat/fixtures/ranged-full-auto.json` (new)
