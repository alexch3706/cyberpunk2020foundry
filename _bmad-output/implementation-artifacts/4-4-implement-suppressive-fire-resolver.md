---
baseline_commit: 95de336eec9b775de2994c2c552fdae1832af820
---
# Story 4.4: Implement Suppressive Fire Resolver

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a referee,
I want suppressive fire to be a real supported fire mode,
So that exposed automatic weapon options do not silently do nothing.

## Acceptance Criteria

1. **Given** suppressive fire is selected
2. **When** fire-zone width and rounds fired are provided
3. **Then** the resolver calculates target save difficulty (minimum 2), prompts or rolls Athletics + REF + 1d10, identifies failed targets, assigns failed-save hit counts (1d6/2 rounded up) and locations, and plans ammo once
4. **And** if required inputs are missing, the outcome is marked manual/incomplete rather than producing a false resolved result.

## Tasks / Subtasks

- [x] Update Target Snapshot to include Skills (AC: 3)
  - [x] In `module/combat/target-normalizer.js`, update `buildTargetSnapshot` to include `skills: clonePlainData(actor.system.skills)` so that the Athletics skill is available to the resolver when calculating the save.
- [x] Add specific top-level routing for Suppressive Fire in `combat-resolver.js` (AC: 1)
  - [x] Do NOT route suppressive fire through `canResolveSingleShotRangedContext` or `resolveSingleShotRangedAttack`. Suppressive fire is a distinct flow.
  - [x] Add a new check (e.g., `isSupportedSuppressiveFireContext`) and route it to a new resolver function like `resolveSuppressiveFire`.
- [x] Implement suppressive fire logic in `attack-resolver.js` (or a dedicated `suppressive-resolver.js`) (AC: 2, 3, 4)
  - [x] Validate `fireZoneWidth` and `roundsFired` from `action` or `action.options`.
  - [x] If required inputs are missing, return `manualResolution: true` with an appropriate message and block updates.
  - [x] Calculate the save difficulty: `Math.max(2, Math.floor(roundsFired / fireZoneWidth))`. Ensure it has a minimum value of 2.
  - [x] For each target, resolve their save (Athletics + REF + 1d10 vs Save DC).
  - [x] For targets that fail the save, calculate the number of hits: `Math.ceil(1d6 / 2)` (1d6 divided by 2, rounded up). Use the injected `roller` to roll the 1d6.
  - [x] Assign hit locations and process damage/armor mitigation per hit using existing logic.
- [x] Plan ammo deduction correctly (AC: 3)
  - [x] Plan ammo deduction using `buildAmmoPlanning` based on the total `roundsFired` provided.
- [x] Add deterministic tests and fixtures
  - [x] Add `tests/combat/fixtures/suppressive-fire.json`.
  - [x] Update `tests/combat/combat-fixtures.test.js` or `run-combat-fixtures.mjs`. Suppressive fire uses partial matching (assertObjectIncludes) to handle complex armor/stagedPenetration structures. The legacy fallback is bypassed by passing options.structured=true.

## Dev Notes

### Technical Requirements
- **Corebook Suppressive Fire Rule (Pages 99-100)**: 
  - Save DC = `Math.max(2, Math.floor(roundsFired / fireZoneWidth))`
  - Target Save = `REF + Athletics + 1d10` >= Save DC
  - If the save is failed, the target takes `1d6/2` hits (rounded up). **Do not use a flat 1d6.**
- **Target Skills**: The `target-normalizer.js` must be updated to copy `skills` into the target snapshot, otherwise the Athletics skill will be 0.
- **Routing**: Suppressive fire forces saves, it does not use a standard attack roll. It must be routed independently of `resolveSingleShotRangedAttack`.
- **Fallback**: If `roundsFired` or `fireZoneWidth` is missing, return a manual resolution warning. Do not silently fail or produce 0 hits.
- **Ammo**: Ammo is deducted once based on the total `roundsFired` into the zone. Use `buildAmmoPlanning`.

### Project Structure Notes
- All combat resolution logic must reside within `module/combat/`. 
- Continue using existing resolver utilities (`combat-resolver.js`, `attack-resolver.js`).
- Test cases must run outside of a Foundry world using the existing fixture runner.

## Dev Agent Record

### Agent Model Used

Gemini 3.1 Pro (High)

### Debug Log References

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.

### File List

- `module/combat/target-normalizer.js` — added `skills` to target snapshot
- `module/combat/combat-resolver.js` — added `canResolveSuppressiveFireContext()` check and routing
- `module/combat/attack-resolver.js` — added `resolveSuppressiveFire()`, `buildSuppressiveFireManual()`, `resolveSuppressiveFireTarget()`
- `tests/combat/fixtures/suppressive-fire.json` — new fixture with 4 test cases
- `tests/combat/combat-fixtures.test.js` — fixture runner supports suppressive fire outcome structure

### Change Log

- 2026-05-28: Generated story specification for Suppressive Fire.
- 2026-06-28: Implemented suppressive fire resolver:
  - Added `skills` to `buildTargetSnapshot` for target Athletics access
  - Added `canResolveSuppressiveFireContext` routing in `combat-resolver.js` (independent path from attack-roll resolvers)
  - Added `resolveSuppressiveFire` in `attack-resolver.js` with Save DC calculation, per-target save resolution, hit count via `Math.ceil(1d6/2)`, damage/armor processing per hit, and ammo planning via `buildAmmoPlanning`
  - Missing inputs return `manualResolution: true` with blocked update categories
  - Created suppressive-fire fixture with 3 single-shot cases (save pass/fail, missing inputs)
  - Updated fixture runner to handle suppressive fire's different outcome structure

### Review Findings

- [x] [Review][Patch] Mismatch in lowercased fireMode string prevents routing of Suppressive Fire [module/combat/combat-resolver.js:472]
- [x] [Review][Patch] Unchecked `roller` parameter in suppressive fire routing/resolver causes runtime crash [module/combat/combat-resolver.js:471]
- [x] [Review][Patch] Suppressive fire target athletics save roll is not mapped in `buildAttackChatData` [module/combat/combat-chat.js:98]
- [x] [Review][Patch] Exploitable Save DC Calculation allows players to illegally inflate Save DC [module/combat/attack-resolver.js:122]
- [x] [Review][Patch] Save prompts generated for targets that pass suppressive fire athletics save [module/combat/save-resolver.js:17]
- [x] [Review][Patch] Action Metadata Discarded in Hit Location [module/combat/attack-resolver.js:252]
- [x] [Review][Defer] Multi-target full-auto target-specific modifier evidence is lost [module/combat/attack-resolver.js:59] — deferred, pre-existing

