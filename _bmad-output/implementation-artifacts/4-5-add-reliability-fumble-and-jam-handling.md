---
baseline_commit: 61003ff
---

# Story 4.5: Add Reliability, Fumble, and Jam Handling

**Status**: done

## Story

As a referee,
I want automatic weapon fumbles to surface reliability and jam outcomes,
So that automatic fire includes the risk behavior expected by the core rules.

## Acceptance Criteria

1. **Given** an automatic weapon attack (full auto or three-round burst) produces a natural 1 on the attack d10 (`isFumble: true`)
2. **When** reliability handling runs
3. **Then** the outcome distinguishes automatic weapon jams from non-automatic fumbles:
   - **Very Reliable**: no jam on fumble (fumble is just a miss, `isJam: false`)
   - **Standard**: jam on fumble (`isJam: true`) — weapon stoppage, needs clearing
   - **Unreliable**: jam on fumble (`isJam: true`) — weapon damaged, needs repair
4. **And** on a jam (`isJam: true`), the attack is forced to miss regardless of margin
5. **And** a fumble on a non-automatic weapon (semi-auto) does NOT produce a jam — standard CP2020 fumble table applies
6. **And** suppressive fire does NOT produce attack rolls, therefore the jam mechanic does not apply to suppressive fire
7. **And** jam state or unjam instruction is visible in chat evidence and fixture-covered
8. **And** the jam replaces (does not add to) the standard CP2020 fumble table for automatic weapons — no additional fumble table roll is made when the jam rule applies

## Tasks / Subtasks

- [x] Add pure helper `resolveJamOutcome` in `attack-resolver.js`
  - [x] Signature: `resolveJamOutcome(isFumble, fireMode, reliability, weaponName)`
  - [x] Fire mode must be lowercased (`"fullauto"`, `"threeroundburst"`)
  - [x] Returns `{ isJam, jamSeverity, warnings, pendingDecisions }` — plain data, no side effects
  - [x] React only to automatic fire modes (full auto, three-round burst)
  - [x] Suppressive fire: always returns `{ isJam: false }` (no attack roll = no jam)
  - [x] Semi-auto: always returns `{ isJam: false }` even on fumble
  - [x] Very Reliable: `{ isJam: false }` on any fumble
  - [x] Standard: `{ isJam: true, jamSeverity: "standard" }` on fumble
  - [x] Unreliable: `{ isJam: true, jamSeverity: "unreliable" }` on fumble
  - [x] Missing/unknown reliability: default to Standard
  - [x] No fumble: `{ isJam: false }` regardless of other params
- [x] Move jam check to action level in **`resolveSingleShotRangedAttack`** (NOT inside `buildTargetOutcome`)
  - [x] After the first attack roll is computed, check for jam
  - [x] If jam detected: force `hit: false` on all targets, skip hit resolution entirely
  - [x] Populate action-level `warnings` and `pendingDecisions`
  - [x] Jam does NOT block ammo deduction (rounds were fired when trigger was pulled)
- [x] Handle multi-target full auto jam semantics
  - [x] Each target gets its own attack roll in multi-target full auto
  - [x] If one target's attack roll produces a jam → abort remaining targets' attack loops
  - [x] Remaining unrolled targets get no attack roll, no hits
  - [x] Action-level warnings reflect the jam (do not duplicate per target)
- [x] Surface jam evidence in `CombatOutcome`
  - [x] Patch `isJam: true` onto the attack roll metadata that triggered the jam
  - [x] Action-level `warnings` array includes jam message with weapon name
  - [x] Action-level `pendingDecisions` includes `{ type: "jam", severity: "standard"|"unreliable", message }`
- [x] Surface jam in chat data (`combat-chat.js`)
  - [x] Add `isJam` propagation in `buildAttackChatData`
- [x] Add deterministic fixtures
  - [x] Create `tests/combat/fixtures/reliability-jam.json`
  - [x] 7 test cases (full-auto-fumble-standard, full-auto-fumble-unreliable, full-auto-fumble-very-reliable, burst-fumble-standard, semi-auto-fumble-standard, full-auto-hit-no-fumble, full-auto-fumble-missing-reliability)
  - [x] Register fixture URL in `combat-fixtures.test.js`

### Review Findings

- [x] [Review][Patch] Inconsistent/Empty attack Shape on Jam-Aborted Targets [module/combat/attack-resolver.js:116]
- [x] [Review][Patch] Redundant Case-Insensitivity Checks in resolveJamOutcome [module/combat/attack-resolver.js:34]
- [x] [Review][Patch] Missing Reliability Fallback Testing [tests/combat/fixtures/reliability-jam.json:471]

## Dev Notes

### Corebook Reliability & Jam Rule (Page 106)

Per Cyberpunk 2020 core rules, page 106:

- **Automatic weapons only**: On a fumble (natural 1 on the attack d10), the weapon may jam.
- **Very Reliable**: No jam effect — the weapon simply misses.
- **Standard**: The weapon jams. It cannot fire until the stoppage is cleared (requires a successful weapon skill roll or referee intervention).
- **Unreliable**: The weapon jams and is damaged. It cannot fire until repaired (requires repair skill or gunsmith).

**Key distinction**: jam *replaces* the standard fumble table for automatic weapons. Do NOT roll on the standard fumble table when the jam mechanic applies.

**Natural 1 = automatic miss**. Even if modifiers push the total above the DC, a natural 1 misses. On a jam, additionally the weapon is disabled.

### What Exists Today

- `weapon.snapshot.reliability` is already populated in the combat context from `item.js` line 244: `reliability: system.reliability`
- `lookups.js` defines `reliability = { very: "VeryReliable", standard: "Standard", unreliable: "Unreliable" }`  
  The stored value is the *value* (e.g. `"Standard"`), not the key. Use direct string comparison with stored values.
- `combat-outcome.js` has `isJam` and `isFumble` already defined in the `RollMetadata` typedef (lines 99-102)
- `attack-resolver.js` `normalizeAttackRoll` already sets `isFumble: rollResult.isFumble ?? natural === 1` (line 1119)
- `combat-chat.js` `buildAttackChatData` does NOT currently propagate `isJam` — needs to be added

### Where Jam Detection Should Live

**IMPORTANT**: Jam detection must run at the **action level** (`resolveSingleShotRangedAttack`), NOT inside `buildTargetOutcome`.

The flow for single-target attacks:
1. `resolveSingleShotRangedAttack` computes the attack roll via `normalizeAttackRoll`
2. Immediately after, check `attackRoll.isFumble` and fire mode → `resolveJamOutcome`
3. If jam: force `hit = false` on all targets, skip hit resolution, add action-level warnings/pendingDecisions
4. Ammo planning proceeds normally (rounds expended)

The flow for multi-target full auto:
1. For each target, a separate attack roll is made (current code in `resolveSingleShotRangedAttack` already does this)
2. After each attack roll, check for jam
3. If any attack roll produces a jam → abort remaining target loops, mark jam at action level
4. Targets that already rolled and didn't fumble: keep their outcomes
5. Aborted targets: no attack roll, no hits, no damage

### Why Action Level, Not Per-Target

- `buildTargetOutcome` has no access to `pendingDecisions` or action-level `warnings` — it builds only per-target data
- Jam affects the weapon globally, not per-target — if it jams on the first target, remaining targets shouldn't be resolved
- The `pendingDecisions: []` in `resolveSingleShotRangedAttack` return overrides anything set inside `buildTargetOutcome`

### What NOT to Break

- Semi-auto attacks with natural 1 must NOT show jam
- Three-round burst fumble must show jam for Standard/Unreliable weapons
- Full auto fumble must show jam for Standard/Unreliable
- Very Reliable weapons at full auto/burst fumble must NOT show jam
- Existing `isFumble` detection must remain intact
- Ammo still deducts on a jam
- Suppressive fire never shows jam (no attack roll)
- No existing fixture must break

### Reliability Value Mapping

The `lookups.js` storage values are:
- `"VeryReliable"` — stored value for very reliable
- `"Standard"` — stored value for standard
- `"Unreliable"` — stored value for unreliable

`resolveJamOutcome` should compare against these strings directly. Do NOT map through keys.

Default when reliability is missing/unknown: treat as `"Standard"`.

### File Structure Notes

```
module/combat/
  attack-resolver.js    ← add resolveJamOutcome helper, jam check in resolveSingleShotRangedAttack
  combat-outcome.js     ← already has isJam; no change needed
  combat-chat.js        ← add isJam to buildAttackChatData
tests/combat/
  fixtures/
    reliability-jam.json    ← new fixture with 7 test cases
  combat-fixtures.test.js   ← add fixture URL to FIXTURE_URLS
```

## Technical Requirements

### Jam Resolution Helper (`resolveJamOutcome`)

```js
/**
 * Determine jam outcome from fumble state and weapon reliability.
 * Only applies to automatic weapon fire modes (fullauto, threeroundburst).
 * Suppressive fire has no attack roll → no jam (caller should not call this).
 *
 * @param {boolean} isFumble Whether the attack roll was a fumble (natural 1)
 * @param {string} fireMode Lowercased fire mode string
 * @param {string|undefined} reliability Weapon reliability (stored value: "VeryReliable" | "Standard" | "Unreliable")
 * @param {string} [weaponName="Weapon"] Display name for warning messages
 * @returns {{ isJam: boolean, jamSeverity: string|null, warnings: Array, pendingDecisions: Array }}
 */
export function resolveJamOutcome(isFumble, fireMode, reliability, weaponName = "Weapon")
```

Logic:
```
IF not isFumble → return { isJam: false }
IF fireMode is not "fullauto" or "threeroundburst" (automatic modes only) → return { isJam: false }
IF reliability === "VeryReliable" → return { isJam: false }
IF reliability === "Unreliable" → return jam with severity "unreliable"
ELSE (default to "Standard") → return jam with severity "standard"
```

Return shapes:

```js
// Standard jam:
{
  isJam: true,
  jamSeverity: "standard",
  warnings: [{
    code: "weapon-jam",
    severity: "warning",
    message: `"${weaponName}" jammed; clear stoppage before next shot.`
  }],
  pendingDecisions: [{
    type: "jam",
    severity: "standard",
    message: `Clear "${weaponName}" stoppage (weapon skill check or referee action).`
  }]
}

// Unreliable jam:
{
  isJam: true,
  jamSeverity: "unreliable",
  warnings: [{
    code: "weapon-jam",
    severity: "warning",
    message: `"${weaponName}" jammed and damaged; repair required before next shot.`
  }],
  pendingDecisions: [{
    type: "jam",
    severity: "unreliable",
    message: `"${weaponName}" damaged and requires repair (repair skill or gunsmith).`
  }]
}

// No jam:
{ isJam: false }
```

### Integration in `resolveSingleShotRangedAttack`

After `normalizeAttackRoll` (single-target) or each per-target `normalizeAttackRoll` (multi-target), call:

```js
// After attack roll normalization, before buildTargetOutcome
const jamResult = resolveJamOutcome(
  attackRoll.isFumble,
  fireMode,
  context.weapon?.snapshot?.reliability,
  context.weapon?.name || "Weapon"
);

if (jamResult.isJam) {
  attackRoll.isJam = true;
  // Collect into action-level arrays
  actionWarnings = [...actionWarnings, ...jamResult.warnings];
  actionPendingDecisions = [...actionPendingDecisions, ...jamResult.pendingDecisions];
}
```

Then, when processing targets:
- If jam: set `hit = false` unconditionally, skip hit resolution for all targets
- Ammo planning still runs with the full `roundsFired`

For multi-target full auto:
```
For each target (i = 0 .. n-1):
  1. Compute attack roll
  2. Run jam check on this roll
  3. If jam → mark jam, abort remaining targets
  4. Otherwise → resolve normally
```

### Action-Level Return Wires

In `resolveSingleShotRangedAttack`, replace the hardcoded `pendingDecisions: []` with the collected jam decisions:

```js
return {
  ...,
  warnings: [...ammoPlanning.warnings, ...actionWarnings], // ← merge jam warnings
  pendingDecisions: actionPendingDecisions,                // ← was []
  ...
};
```

### Chat Data

In `combat-chat.js` `buildAttackChatData`, add `isJam`:

```js
function buildAttackChatData(attack = {}) {
  return compactPlainObject({
    total: attack?.roll?.total,
    formula: attack?.roll?.formula,
    die: clonePlainData(attack?.roll?.die),
    targetNumber: attack?.targetNumber,
    opposedRoll: clonePlainData(attack?.opposedRoll),
    hit: attack?.hit,
    margin: attack?.margin,
    warnings: cloneArray(attack?.warnings),
    burstHitsRoll: clonePlainData(attack?.burstHitsRoll),
    save: attack?.save ? clonePlainData(attack.save) : undefined,
    isJam: attack?.roll?.isJam  // ← ADD
  });
}
```

### Fixture Structure

New file `tests/combat/fixtures/reliability-jam.json` with these cases:

1. **full-auto-fumble-standard** — Full auto, natural 1, Standard reliability → `isJam: true`, hit forced to false, warnings present, pendingDecisions present
2. **full-auto-fumble-unreliable** — Full auto, natural 1, Unreliable reliability → `isJam: true`, severity "unreliable"
3. **full-auto-fumble-very-reliable** — Full auto, natural 1, VeryReliable → `isJam: false`, no jam warnings
4. **burst-fumble-standard** — Three-round burst, natural 1, Standard → `isJam: true`
5. **semi-auto-fumble-standard** — Semi-auto, natural 1, Standard → `isJam: false` (jam only for automatic weapons)
6. **full-auto-hit-no-fumble** — Full auto, hit, no fumble, Standard → `isJam: false`
7. **full-auto-fumble-missing-reliability** — Full auto, natural 1, reliability missing → defaults to Standard, `isJam: true`

Each `singleShotCase` must assert:
- `targets[0].attack.roll.isFumble`
- `targets[0].attack.roll.isJam` (or absence)
- `targets[0].attack.hit` (must be false on jam even if margin would say hit)
- Action-level `warnings` array (or absence)
- `pendingDecisions` (or `[]` when no jam)

## Architecture Compliance

- **AD-1 (module/combat/)**: Jam helper lives in `attack-resolver.js`
- **AD-2 (CombatOutcome)**: `isJam` added to attack roll metadata; warnings/pendingDecisions at action level
- **AD-3 (Pure Mechanics)**: `resolveJamOutcome` is a pure function with no Foundry dependency
- **AD-9 (Fixtures)**: New fixture file follows same JSON scripted-roller pattern
- **No new settings**: Jam derived from existing `reliability` field

## File List

### Files CREATED

- `tests/combat/fixtures/reliability-jam.json` — 7 singleShotCases covering all jam/fumble permutations

### Files MODIFIED

- `module/combat/attack-resolver.js` — added `resolveJamOutcome` pure helper; integrated jam check and fumble-forced-miss in `resolveSingleShotRangedAttack` (both single-target and multi-target paths); wired action-level `warnings`/`pendingDecisions`
- `module/combat/combat-chat.js` — added `isJam` propagation in `buildAttackChatData`
- `tests/combat/combat-fixtures.test.js` — registered new fixture URL, added `useStructured` support via fixture flag

### Files VERIFIED (no change needed)

- `module/combat/combat-outcome.js` — `isJam` already in `RollMetadata` typedef ✓
- `module/item/item.js` — `reliability` already in weapon snapshot ✓
- `module/combat/combat-resolver.js` — no routing changes needed ✓

- `module/combat/combat-outcome.js` — `isJam` already in `RollMetadata` typedef ✓
- `module/item/item.js` — `reliability` already in weapon snapshot ✓
- `module/combat/combat-resolver.js` — no routing changes needed

## Testing Requirements

### Deterministic Fixture Coverage

Each fixture case as a `singleShotCase` entry. Each must:
1. Define scripted rolls including attack roll with `die.natural` set for fumble scenarios
2. Set `weapon.snapshot.reliability` to the appropriate stored value
3. For jam cases: assert `outcome.targets[0].attack.roll.isJam === true`, `hit === false`, warnings present
4. For no-jam cases: assert no jam warnings, hit follows normal rules
5. For Very Reliable: fumble but no jam
6. For missing reliability: jam (defaults to Standard)

### Existing Test Behavior Check

```
node tests/run-combat-fixtures.mjs
```

All existing 4+ fixtures must continue passing.

### Manual Foundry Check (Documented)

After implementation, validate in Foundry:
1. Standard reliability full-auto weapon, natural 1 → jam warning in chat, hit = false, ammo deducted
2. Very Reliable full-auto weapon, natural 1 → no jam, miss only
3. Semi-auto weapon, natural 1 → no jam
4. Standard reliability full-auto, successful hit → no jam, normal damage flow

## Previous Story Intelligence

### Story 4.4 — Suppressive Fire Resolver

- Suppressive fire uses REF + Athletics + 1d10 saves, NOT attack rolls → NO jam mechanic
- `buildSuppressiveFireManual` pattern for manual-resolution outcomes with blocked update categories
- Fixtures use `singleShotCases` pattern; fixture runner uses `createScriptedRoller` + `assertObjectIncludes`
- Fixture routing bypasses legacy fallback with `options.structured: true`

### Key Files Modified in 4.4

- `module/combat/attack-resolver.js` — `resolveSuppressiveFire`, `resolveSuppressiveFireTarget`, `buildSuppressiveFireManual`
- `module/combat/combat-resolver.js` — `canResolveSuppressiveFireContext`
- `module/combat/target-normalizer.js` — `skills` in target snapshot
- `tests/combat/combat-fixtures.test.js` — partial-matching for suppressive fire

## Git Intelligence Summary

```
61003ff feat(combat): implement suppressive fire resolver and apply code review fixes
6b0ff36 feat(combat): resolve full auto across multiple targets (Story 4.3)
616c3eb feat(combat): implement multi-target full-auto resolution (Story 4.3)
95de336 feat: implement Story 4.2 full auto against one target and fix review findings
fcd44cd feat(combat): migrate three-round burst to resolver/outcome pipeline (story 4-1)
```

Story 4.5 adds the final missing risk layer for automatic fire before Story 4.6 (disable unsupported modes) and Story 4.7 (fixture/coverage sweep).

## Project Context Reference

- **FoundryVTT system**: `system.json` → `cyberpunk2020`, compat 10–12
- **Runtime**: Plain JS ES modules, no bundler/npm/TypeScript
- **Resolver modules**: Under `module/combat/`, testable with `node tests/run-combat-fixtures.mjs`
- **Weapon reliability**: Stored as `"VeryReliable"` | `"Standard"` | `"Unreliable"` in `system.reliability`, populated in `weapon.snapshot.reliability`
- **FireMode casing**: `resolveSingleShotRangedAttack` lowercases to `"fullauto"`, `"threeroundburst"`, `"semiauto"`, `"suppressivefire"` — match these strings
- **Attack roll metadata**: `normalizeAttackRoll` sets `isFumble`, `isCritical` — `isJam` is in typedef but never set before this story
- **Lookups**: `reliability` in `module/lookups.js`: keys are `very`, `standard`, `unreliable` — but use *values* (`"VeryReliable"`, etc.) for comparison

## Dev Agent Record

### Implementation Plan

1. Created `resolveJamOutcome(isFumble, fireMode, reliability, weaponName)` in `attack-resolver.js` — pure function with no Foundry dependency. Checks for fumble + automatic fire mode + reliability tier, returns structured jam results with warnings and pendingDecisions.

2. Integrated jam check into `resolveSingleShotRangedAttack` at the action level (NOT inside `buildTargetOutcome`):
   - Single-target path: after `normalizeAttackRoll`, runs jam check. On fumble + jam, forces `hit: false` for all targets and populates action-level arrays.
   - Multi-target full auto path: runs jam check after each per-target attack roll. If jam detected, aborts remaining targets, marks jam at action level.
   - Natural 1 (fumble) always forces `hit: false` regardless of jam outcome — even Very Reliable weapons miss on fumble.
   - `pendingDecisions: []` replaced with collected jam decisions; `warnings` merged with ammo warnings.

3. Added `isJam` propagation in `buildAttackChatData` in `combat-chat.js`.

4. Created `tests/combat/fixtures/reliability-jam.json` with 7 singleShotCases covering all permutations.

5. Updated `tests/combat/combat-fixtures.test.js` — registered fixture URL, added `useStructured` fixture flag.

6. Fixed existing `ranged-full-auto.json` fixture case 0 (had natural 1 on attack die but expected hits — changed to non-fumble natural).

### Debug Log

- Existing fixture `full auto success with 3 hits` had `natural: 1` on attack die — would now trigger jam with Standard reliability. Changed to `natural: 8` (same total 18) to preserve original test intent.
- Reliability comparison uses stored string values (`"Standard"`, `"VeryReliable"`, `"Unreliable"`) — also handles case-insensitive lowercased comparison as safety.
- `useStructured: true` fixture flag added to bypass legacy fallback for reliability-jam fixture (same pattern as suppressive fire).

### Completion Notes

Story 4.5 implemented. All 7 acceptance criteria satisfied. 6 combat fixtures pass (4 existing + 1 new with 7 cases). Key behaviors:
- Standard weapons jam on automatic fumble → miss + warning + pending decision
- Unreliable weapons jam with "unreliable" severity → miss + repair decision
- Very Reliable weapons don't jam on fumble, but still miss (natural 1)
- Semi-auto fumble → miss only, no jam
- Suppressive fire untouched (no attack rolls)
- Multi-target full auto: jam on first target aborts remaining targets
- Ammo always deducts

## Change Log

| Date | Change |
|------|--------|
| 2026-05-28 | Added `resolveJamOutcome` pure helper |
| 2026-05-28 | Integrated jam check in `resolveSingleShotRangedAttack` (action level) |
| 2026-05-28 | Added `isJam` propagation in `buildAttackChatData` |
| 2026-05-28 | Created `reliability-jam.json` fixture with 7 singleShotCases |
| 2026-05-28 | Registered fixture URL + `useStructured` support in test runner |
| 2026-05-28 | Fixed existing `ranged-full-auto.json` case 0 (natural 1 → 8) |

## Status

**Status**: done
**Modified by**: dev-story workflow
**Date**: 2026-05-28