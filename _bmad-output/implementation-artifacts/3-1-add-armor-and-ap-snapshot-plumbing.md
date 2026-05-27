# Story 3.1: Add Armor and AP Snapshot Plumbing

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a maintainer,
I want weapon AP and target armor data available to the resolver as snapshots,
so that damage rules can use existing item data without immediately reshaping `template.json`.

## Acceptance Criteria

1. Given a target actor with equipped armor and a weapon with `system.ap`
   When resolver snapshots are built
   Then weapon AP, armor coverage, stopping power, ablation, equipped state, source, and item IDs are available to `armor-resolver`.
2. Given target armor is resolved,
   When evaluating stopping power at a hit location,
   Then actor-prepared pre-summed SP (e.g., `system.hitLocations[area].stoppingPower` or `system.stats.Armor`) is NOT used as the rules source of truth.

## Tasks / Subtasks

- [x] Implement `armor-resolver.js` skeleton and snapshot extraction. (AC: 1, 2)
  - [x] Create [module/combat/armor-resolver.js](file:///Users/alexanderchuprikov/Documents/Code/Tabletop/Cyberpunk2020VTT/module/combat/armor-resolver.js) with functions to extract armor snapshots for a given hit location.
  - [x] Support extracting stopping power (SP), ablation, layer type (hard/soft), item name, ID, and equipped state from equipped armor items.
  - [x] Support extracting stopping power from equipped cyberware (e.g. Subdermal Armor).
  - [x] Ensure that actor-prepared pre-summed SP values are ignored in the resolver logic.
- [x] Integrate armor snapshotting into the single-shot resolution pipeline. (AC: 1)
  - [x] Import `armor-resolver.js` in [module/combat/attack-resolver.js](file:///Users/alexanderchuprikov/Documents/Code/Tabletop/Cyberpunk2020VTT/module/combat/attack-resolver.js).
  - [x] Update `resolveSingleShotRangedAttack()` to build armor snapshots from the target's equipped armor and cyberware items.
  - [x] Map the weapon's `ap` property from the weapon snapshot to the resolver outcome.
- [x] Add and run unit tests for armor snapshot plumbing. (AC: 1, 2)
  - [x] Create a new unit test suite in [tests/combat/combat-fixtures.test.js](file:///Users/alexanderchuprikov/Documents/Code/Tabletop/Cyberpunk2020VTT/tests/combat/combat-fixtures.test.js) validating target armor snapshotting.
  - [x] Verify that running `node tests/run-combat-fixtures.mjs` executes and passes successfully.

## Dev Notes

- Relevant architecture patterns and constraints:
  - Keep pure mechanics in `module/combat/` decoupled from Foundry globals (do not use `game`, `ui`, `canvas`, `Actor`, `Item` inside `armor-resolver.js` rules logic).
  - Rely on target actor `snapshot.equippedArmor` (which contains snapshots of armor items with `system.coverage` and `system.equipped`) and `snapshot.equippedCyberware` (which contains subdermal armor / cyberware items).
  - Remember that Cyberpunk 2020 subdermal armor is cyberware but acts as armor. For Story 3.1, simply parse subdermal armor SP from cyberware snapshot and include it in the armor list.
- Source tree components to touch:
  - **[NEW]** [module/combat/armor-resolver.js](file:///Users/alexanderchuprikov/Documents/Code/Tabletop/Cyberpunk2020VTT/module/combat/armor-resolver.js)
  - **[MODIFY]** [module/combat/attack-resolver.js](file:///Users/alexanderchuprikov/Documents/Code/Tabletop/Cyberpunk2020VTT/module/combat/attack-resolver.js)
  - **[MODIFY]** [tests/combat/combat-fixtures.test.js](file:///Users/alexanderchuprikov/Documents/Code/Tabletop/Cyberpunk2020VTT/tests/combat/combat-fixtures.test.js)
- Testing standards summary:
  - Run `node tests/run-combat-fixtures.mjs` to execute unit tests.
  - Ensure tests run successfully without a live Foundry window.

### Project Structure Notes

- Alignment with unified project structure (paths, modules, naming).
- Target normalizer `module/combat/target-normalizer.js` already collects `equippedArmor` and `equippedCyberware` in the target snapshot, so we only need to extract and organize them inside `armor-resolver.js`.

### References

- Cite [Source: _bmad-output/planning-artifacts/epics.md#Story 3.1]
- Cite [Source: _bmad-output/planning-artifacts/architecture.md#AD-7]
- Cite [Source: module/combat/target-normalizer.js#normalizeItemSnapshots]

## Dev Agent Record

### Agent Model Used

Gemini 1.5 Pro (Antigravity)

### Debug Log References

### Completion Notes List

### File List

### Review Findings

- [x] [Review][Patch] Cyberware armor SP was not extracted from existing pack-style item data [module/combat/armor-resolver.js:51] — fixed by parsing armor cyberware SP from explicit fields or existing name/flavor text such as `Skinweave SP12` and `Subdermal Skull Armor SP6`, with fixture coverage for location filtering and source preservation.
