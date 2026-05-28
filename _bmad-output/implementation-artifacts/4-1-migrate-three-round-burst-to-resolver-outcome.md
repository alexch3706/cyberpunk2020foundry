# Story 4.1: Migrate Three-Round Burst to Resolver Outcome

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a referee,
I want three-round burst to resolve through the combat resolver,
so that burst hit count, modifiers, damage hits, ammo, and chat evidence use the same pipeline as single-shot attacks.

## Acceptance Criteria

1. **Given** an automatic weapon with at least one remaining round
   **When** three-round burst is selected
   **Then** the resolver applies burst fire mode, close/medium attack advantage (+3 modifier at close/medium range), rounds fired as three or remaining ammo, and hit count on success (rolled using a `1d3` roll, matching the legacy burst behavior).
2. **Given** a three-round burst combat action
   **Then** weapon ammo delta is planned exactly once through the state planner, and no direct document mutation happens inside the item/combat roll loop.
3. **Given** a successful three-round burst
   **Then** damage and hit location are resolved for each hit round independently, including armor, BTM, wounds, and save prompts.
4. **Given** a three-round burst attack
   **Then** the chat card rendering uses the new `CombatOutcome` pipeline rather than legacy execution.

## Tasks / Subtasks

- [x] Support three-round burst context in combat resolver (AC: 1)
  - [x] Update `isSupportedSingleShotRangedContext` or create a more general context check in [combat-resolver.js](file:///Users/alexanderchuprikov/Documents/Code/Tabletop/Cyberpunk2020VTT/module/combat/combat-resolver.js) to support `threeRoundBurst` fire mode.
  - [x] Update `canResolveSingleShotRangedContext` in [combat-resolver.js](file:///Users/alexanderchuprikov/Documents/Code/Tabletop/Cyberpunk2020VTT/module/combat/combat-resolver.js) to validate three-round burst requirements.
- [x] Implement three-round burst action resolver (AC: 1, 3)
  - [x] Implement three-round burst attack roll logic in [attack-resolver.js](file:///Users/alexanderchuprikov/Documents/Code/Tabletop/Cyberpunk2020VTT/module/combat/attack-resolver.js) (or reuse/refactor existing Single-Shot logic).
  - [x] Add `threeRoundBurst` close/medium range modifier (+3) in `RANGED_MODIFIERS` or resolution path.
  - [x] Determine rounds fired: `Math.min(shotsLeft, rof, 3)`.
  - [x] Implement hit count roll (`1d3`) if the attack succeeds.
  - [x] Iterate over each hit round: roll hit location, roll damage, and resolve armor, BTM, and staged penetration.
  - [x] Return the structured `CombatOutcome` for the burst action.
- [x] Integrate three-round burst in ammo planning and state planner (AC: 2)
  - [x] Update `buildAmmoPlanning` in [attack-resolver.js](file:///Users/alexanderchuprikov/Documents/Code/Tabletop/Cyberpunk2020VTT/module/combat/attack-resolver.js) to plan the ammo delta matching the actual rounds fired in burst mode (typically `-3` or `-shotsLeft`).
  - [x] Ensure that no direct state mutation occurs.
- [x] Connect adapter delegation in CyberpunkItem (AC: 4)
  - [x] Modify `__legacyWeaponRoll` or `__weaponRoll` in [item.js](file:///Users/alexanderchuprikov/Documents/Code/Tabletop/Cyberpunk2020VTT/module/item/item.js) to delegate `threeRoundBurst` to `resolveCombatAction` when structured is enabled.
- [x] Expand deterministic fixture test suite (AC: 1, 2, 3)
  - [x] Add test cases in [combat-fixtures.test.js](file:///Users/alexanderchuprikov/Documents/Code/Tabletop/Cyberpunk2020VTT/tests/combat/combat-fixtures.test.js) and create a new fixture test file or add cases to `ranged-single-shot.json` to verify three-round burst logic under deterministic roll sequences.
  - [x] Verify that running `node tests/run-combat-fixtures.mjs` succeeds.

### Review Findings

- [x] [Review][Decision] Rate of Fire (RoF) Limit on Burst size — `roundsFired` is limited by `Math.min(rawShotsLeft.value, rof, 3)`. For weapons with low semi-auto RoF (like 1 or 2) but having a 3-round burst mode, this limits the burst to 1 or 2 shots, effectively breaking the burst mode. We need to decide if we should limit rounds fired by Rate of Fire for burst mode, or if burst mode ignores base RoF (or uses a different RoF property). (Resolved: Option 1 - Ignore RoF in burst mode)
- [x] [Review][Decision] Attack type constraint for Three-Round Burst — Currently `canResolveSingleShotRangedContext` restricts three-round burst to weapons with `attackType` `"Auto"` or `"Autoshotgun"`. If there are other weapon types (e.g. pistols or rifles) with burst capability, this check prevents their resolution. Should we allow other attack types, or is it correct to restrict it? (Resolved: Option 1 - Remove attackType restriction)
- [x] [Review][Patch] Multi-Location Armor Ablation Overwrite Bug [module/combat/attack-resolver.js:338-349]
- [x] [Review][Patch] Attack resolved with zero ammunition (empty weapon) [module/combat/combat-resolver.js:42-62]
- [x] [Review][Patch] Hit count on success can exceed the actual rounds fired [module/combat/attack-resolver.js:280-288]
- [x] [Review][Patch] Inconsistent Math in buildAmmoPlanning Delta/After [module/combat/attack-resolver.js:173-176]
- [x] [Review][Patch] Inconsistent/Incorrect Ammo Deduction Logic when Ammo State is Invalid [module/combat/attack-resolver.js:31-34]
- [x] [Review][Patch] Loss of Multiple Manual Resolutions [module/combat/attack-resolver.js:114-117]
- [x] [Review][Patch] Duplicate Roll Identifiers for Damage Rolls [module/combat/attack-resolver.js:123-126]
- [x] [Review][Patch] Non-numeric weapon.snapshot.rof causing NaN in roundsFired [module/combat/attack-resolver.js:30]
- [x] [Review][Defer] Cyberware armor updatePath in staged penetration [module/combat/attack-resolver.js:364-369] — deferred, pre-existing

## Dev Notes

- **Weapon Modifiers:**
  - Legally, three-round burst adds +3 to hit at Close or Medium range only.
  - Range check can be matched against `ranges.close` or `ranges.medium` (or `RangeClose` / `RangeMedium` keys).
- **Hits & Location:**
  - Success margin does not determine the number of hits for burst. Instead, it is a flat `1d3` hits.
  - Each hit location must be rolled independently (unless aimed location is selected, which affects the first hit).
- **Ammo planning:**
  - Attacking weapon item update should decrease `shotsLeft` by `roundsFired`.
  - Make sure the resolver does not perform any database operations directly.
- **Roll Scripting:**
  - The scripted roller needs to support rolls for: `attack` (D10), `burst_hits` (1d3), followed by location and damage rolls for each hit.

### Project Structure Notes

- Combat resolver code lives in `module/combat/`.
- Test runner and test suites live in `tests/combat/` and `tests/run-combat-fixtures.mjs`.

### References

- [Source: module/item/item.js#L436-L475](file:///Users/alexanderchuprikov/Documents/Code/Tabletop/Cyberpunk2020VTT/module/item/item.js#L436-L475)
- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.1](file:///Users/alexanderchuprikov/Documents/Code/Tabletop/Cyberpunk2020VTT/_bmad-output/planning-artifacts/epics.md#Story 4.1)
- [Source: _bmad-output/project-context.md](file:///Users/alexanderchuprikov/Documents/Code/Tabletop/Cyberpunk2020VTT/_bmad-output/project-context.md)

## Dev Agent Record

### Agent Model Used

Gemini 3.5 Flash (Medium)

### Debug Log References

- Executed `node tests/run-combat-fixtures.mjs` successfully to verify 100% test conformance.

### Completion Notes List

- Implemented three-round burst validation check in `combat-resolver.js`.
- Implemented three-round burst fire mode resolution in `attack-resolver.js` (bonus +3 at Close/Medium range, 1d3 hits, independent locations/damage, and progressive armor ablation).
- Integrated correct variable rounds fired calculation in ammo planner (`buildAmmoPlanning`).
- Connected adapter delegation in `item.js` so it passes options to `resolveCombatAction`.
- Added support for `burstHitsRoll` serialization in `combat-chat.js`.
- Created comprehensive deterministic test fixture suite `three-round-burst.json`.

### File List

- [module/combat/combat-resolver.js](file:///Users/alexanderchuprikov/Documents/Code/Tabletop/Cyberpunk2020VTT/module/combat/combat-resolver.js)
- [module/combat/attack-resolver.js](file:///Users/alexanderchuprikov/Documents/Code/Tabletop/Cyberpunk2020VTT/module/combat/attack-resolver.js)
- [module/combat/combat-chat.js](file:///Users/alexanderchuprikov/Documents/Code/Tabletop/Cyberpunk2020VTT/module/combat/combat-chat.js)
- [module/item/item.js](file:///Users/alexanderchuprikov/Documents/Code/Tabletop/Cyberpunk2020VTT/module/item/item.js)
- [tests/combat/combat-fixtures.test.js](file:///Users/alexanderchuprikov/Documents/Code/Tabletop/Cyberpunk2020VTT/tests/combat/combat-fixtures.test.js)
- [tests/combat/fixtures/three-round-burst.json](file:///Users/alexanderchuprikov/Documents/Code/Tabletop/Cyberpunk2020VTT/tests/combat/fixtures/three-round-burst.json)
- [_bmad-output/implementation-artifacts/sprint-status.yaml](file:///Users/alexanderchuprikov/Documents/Code/Tabletop/Cyberpunk2020VTT/_bmad-output/implementation-artifacts/sprint-status.yaml)

## Change Log

- 2026-05-28: Completed Story 4.1 implementation and verified all tests pass successfully.
