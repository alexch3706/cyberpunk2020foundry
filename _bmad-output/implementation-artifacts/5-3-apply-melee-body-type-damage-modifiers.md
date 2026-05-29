---
baseline_commit: 293e46536845a511ce06874731dbaec9f1dd63c1
---

# Story 5.3: Apply Melee Body Type Damage Modifiers

**Status**: done

## Story

As a referee,
I want melee and unarmed damage to include the correct Body Type damage modifier,
So that melee damage matches the corebook strength/body table.

## Acceptance Criteria

1. **Given** a successful melee or unarmed attack with attacking BT **≤ 10**
   **When** `resolveMeleeHitDamage` computes raw damage
   **Then** the outcome contains `strengthDamageBonus` matching `btmFromBT(attackerBT) - 2`:
     - BT 2 → –2
     - BT 3–4 → –1
     - BT 5–7 → 0
     - BT 8–9 → +1
     - BT 10 → +2
   **And** the bonus is *subtracted from* raw weapon damage for weak attackers (negative bonus) and added for strong ones.

2. **Given** a successful melee or unarmed attack with attacking BT **11–12**
   **When** `resolveMeleeHitDamage` computes raw damage
   **Then** `strengthDamageBonus` is **+4**
   **And** fixtures verify this independently of `btmFromBT`.

3. **Given** a successful melee or unarmed attack with attacking BT **13–14**
   **When** `resolveMeleeHitDamage` computes raw damage
   **Then** `strengthDamageBonus` is **+5**
   **And** fixtures verify this independently of `btmFromBT`.

4. **Given** a successful melee or unarmed attack with attacking BT **15+**
   **When** `resolveMeleeHitDamage` computes raw damage
   **Then** `strengthDamageBonus` is **+8**
   **And** fixtures verify this independently of `btmFromBT`.

5. **Given** the **target** has BT **13 or 14** and penetrating damage from a melee hit
   **When** `resolveBodyTypeDamage` runs (via `btmFromBT`)
   **Then** `bodyTypeModifier` is **6** (BTM –6 → modifier 6)
   **And** the known Body Type 13–14 mismatch in `btmFromBT` is corrected.

6. **Given** the **target** has BT **15+** and penetrating damage from a melee hit
   **When** `resolveBodyTypeDamage` runs (via `btmFromBT`)
   **Then** `bodyTypeModifier` is **8** (BTM –8 → modifier 8)
   **And** BT 15+ no longer silently returns BTM –5 (modifier 5) as it does today.

7. **Given** the target has BT 11–12
   **When** `resolveBodyTypeDamage` runs
   **Then** `bodyTypeModifier` is **5** (unchanged from current behavior, now explicit rather than default fallthrough).

8. **Given** a deterministic melee fixture with BT 13 attacker and BT 14 target
   **When** the fixture runs
   **Then** the outcome shows `strengthDamageBonus: 5`, `bodyTypeModifier: 6`, `bodyTypeMitigation: 6`, and correct final damage.

9. **Given** a deterministic melee fixture with BT 15+ attacker and BT 15+ target
   **When** the fixture runs
   **Then** the outcome shows `strengthDamageBonus: 8`, `bodyTypeModifier: 8`, `bodyTypeMitigation: 8`, and correct final damage.

10. **Given** all existing fixtures and assertion tests
    **When** changes are applied
    **Then** all existing fixture tests continue to pass unchanged **except** `assertBodyTypeDamageResolver` which must be updated to reflect corrected values for BT values above the new explicit cases (specifically 11–12 remain 5, 13–14 become 6, and no caller supplies BT ≥ 15 so `resolveBodyTypeDamage(10, 15)` becomes a new assertion).

## Tasks / Subtasks

- [ ] #1: Fix `btmFromBT` in `module/lookups.js` (AC: 5, 6, 7)
  - Add explicit cases for BT 11–12 → return 5
  - Add explicit cases for BT 13–14 → return 6
  - Change `default` → return 8 (currently returns 5)
  - Preserve all cases ≤ 10 unchanged
  - Remove the now-dead `case 2` that was shadowed by the `body <= 2` guard
  - The corrected function:
    ```js
    export function btmFromBT(body) {
      if(body <= 2) return 0;
      switch(body) {
        case 3: case 4: return 1;       // BTM –1
        case 5: case 6: case 7: return 2; // BTM –2
        case 8: case 9: return 3;       // BTM –3
        case 10: return 4;              // BTM –4
        case 11: case 12: return 5;     // BTM –5
        case 13: case 14: return 6;     // BTM –6
        default: return 8;              // BTM –8 (BT 15+)
      }
    }
    ```

- [ ] #2: Update `assertBodyTypeDamageResolver` in `tests/combat/combat-fixtures.test.js` (AC: 10)
  - Keep all existing BT ≤ 10 assertions unchanged
  - Add new assertions for BT 13, BT 14, and BT 15
  - Verify BT 13–14 produces modifier 6, BT 15 produces modifier 8
  - Verify minimum damage 1 still enforced across all BT ranges
  - Verify zero penetrating damage is still handled correctly

- [ ] #3: Add melee fixture cases for BTM/varied BT in `tests/combat/fixtures/melee-baseline.json` (AC: 8, 9)
  - Add singleShotCase: **melee-bt13-vs-bt14**
    - Attacker BT 13 → `strengthDamageBonus: 5`
    - Target BT 14 → BTM modifier 6
    - Armor: low SP so 5–20 damage gets through
    - Rolls: attack (win), defend (lose), location, damage
    - Expected: rawDamage = damageDie + 5, bodyTypeModifier = 6, finalDamage computed correctly
  - Add singleShotCase: **melee-bt15-vs-bt15**
    - Attacker BT 15 → `strengthDamageBonus: 8`
    - Target BT 15 → BTM modifier 8
    - Rolls: attack (win), defend (lose), location, damage
    - Expected: rawDamage = damageDie + 8, bodyTypeModifier = 8, minimumDamageApplied may trigger if BTM > penetrating damage
  - Add singleShotCase: **melee-bt10-vs-bt10**
    - Attacker BT 10 → `strengthDamageBonus: 2`
    - Target BT 10 → BTM modifier 4
    - Verifies boundary case where `btmFromBT(10) = 4` still works
  - All existing melee baseline cases must remain unchanged and continue passing

- [ ] #4: Verify all existing fixtures still pass (AC: 10)
  - Run `node tests/run-combat-fixtures.mjs`
  - All 6 existing ranged/auto/suppressive fixture files must continue passing
  - All `assertTargetNormalization`, `assertWoundPlanning`, `assertSavePromptResolution`, `assertArmorResolver`, `assertCombatResolverRouting`, `assertSettingsHelpers` must pass
  - `assertBodyTypeDamageResolver` must pass with both old and new assertions

- [x] #5: Update sprint status
  - Mark `5-3-apply-melee-body-type-damage-modifiers: ready-for-dev` in `sprint-status.yaml`

### Review Findings

- [x] [Review][Patch] Strict equality comparison in btmFromBT and strengthDamageBonus causes string/float inputs to resolve to max default values. [module/lookups.js:268]
- [x] [Review][Patch] Missing melee fixture verifying strength damage bonus for BT 11–12. [tests/combat/fixtures/melee-baseline.json:251]
- [x] [Review][Patch] Missing unit test assertions for target BT 11–12 body type modifier. [tests/combat/combat-fixtures.test.js:460]
- [x] [Review][Patch] Missing unit test coverage for BT 2 or BT < 3 target BTM. [tests/combat/combat-fixtures.test.js:460]

### Dev Notes

#### Current State of `btmFromBT`

```js
export function btmFromBT(body) {
    if(body <= 2) {
        return 0;
    }
    switch(body) {
        case 2: return 0
        case 3: case 4: return 1
        case 5: case 6: case 7: return 2;
        case 8: case 9: return 3;
        case 10: return 4;
        default: return 5;   // ← Covers ALL of 11+
    }
}
```

**Problem:** `btmFromBT(13)` returns 5 (BTM –5). CP2020 corebook specifies BTM –6 for BT 13–14. `btmFromBT(15)` also returns 5 but should return 8 (BTM –8). All values above 10 collapse into one, making BT 15+ characters *less* damage-resistant than they should be.

#### How `strengthDamageBonus` Currently Handles This

`strengthDamageBonus` already has correct hardcoded values for BT 11+ that bypass `btmFromBT`:

```js
export function strengthDamageBonus(bt) {
    let btm = btmFromBT(bt);
    if(btm < 5) return btm - 2;
    switch(bt) {
        case 11: case 12: return 4   // BTM –5 → bonus +4
        case 13: case 14: return 5   // BTM –6 → bonus +5
        default: return 8            // BTM –8 → bonus +8
    }
}
```

The `strengthDamageBonus` values match CP2020 corebook verbatim (page 99 body-type damage-modifier table). This function **does not need changes**. The `btm < 5` guard means BT ≤ 10 (BTM ≤ 4) are computed from `btmFromBT`, and BT 11+ hit the switch.

**Critical:** fixing `btmFromBT` will change what `btm < 5` evaluates to for BT 13+:
- Currently: `btmFromBT(13)` = 5 → `btm < 5` is false → hits switch → returns 5 ✓
- After: `btmFromBT(13)` = 6 → `btm < 5` is false → hits switch → returns 5 ✓
- After: `btmFromBT(15)` = 8 → `btm < 5` is false → hits switch → returns 8 ✓

**No change to `strengthDamageBonus` return values for any BT!** The switch hardcodes are preserved.

#### What `resolveBodyTypeDamage` Uses

`resolveBodyTypeDamage(penetratingDamage, bodyType)` calls `btmFromBT(normalizeBodyType(bodyType))` to get the BTM modifier for the **target**. This affects how much the target's body type reduces damage. Fixing `btmFromBT` directly improves the target's damage resistance for BT 13+.

#### CP2020 Reference Table (page 99)

| Body Type | BTM    | BTM Modifier (btmFromBT) | Strength Damage Bonus |
|-----------|--------|--------------------------|----------------------|
| 2         | 0      | 0                        | –2                   |
| 3–4       | –1     | 1                        | –1                   |
| 5–7       | –2     | 2                        | 0                    |
| 8–9       | –3     | 3                        | +1                   |
| 10        | –4     | 4                        | +2                   |
| 11–12     | –5     | 5                        | +4                   |
| 13–14     | –6     | **6** (was 5)            | +5                   |
| 15+       | –8     | **8** (was 5)            | +8                   |

#### Unarmed Damage Note

Unarmed attacks (punches, kicks) resolve through the same `resolveMeleeHitDamage` path. The unarmed weapon item (typically "Fist" or "Punch" with `system.damage = "1d3"`) provides the base damage die. The BT modifier from `strengthDamageBonus` is added to the die result just like any other melee weapon. No special unarmed damage formula is needed in this story — the existing `resolveMeleeHitDamage` path handles it correctly.

For Brawling:
- Punch: 1d3 damage + strengthBonus
- Kick: 1d6 damage + strengthBonus

These are item data concerns (the Fist item's damage field), not resolver logic. The resolver already delegates damage formula to `weapon.snapshot.damage`.

### Impact Analysis

#### Changed Files

| File | Change | Risk |
|------|--------|------|
| `module/lookups.js` | Fix `btmFromBT` — add explicit cases for 11–12, 13–14, correct default to 8 | **Medium.** Affects ALL `resolveBodyTypeDamage` callers (ranged, burst, full auto, melee). BT 15+ targets become more damage-resistant |
| `tests/combat/combat-fixtures.test.js` | Update `assertBodyTypeDamageResolver` — add BT 13, 14, 15 assertions | Low. Test-only |
| `tests/combat/fixtures/melee-baseline.json` | Add 3 new singleShotCases for BT 13–14 and BT 15+ | Low. Test-only |

#### Files NOT Touched

- `module/combat/attack-resolver.js` — `strengthDamageBonus` import unchanged, `resolveMeleeHitDamage` unchanged, `resolveBodyTypeDamage` unchanged
- `module/combat/combat-resolver.js` — routing unchanged
- `module/combat/target-normalizer.js` — unchanged
- `module/combat/state-planner.js` — unchanged
- `module/combat/armor-resolver.js` — unchanged
- `module/combat/save-resolver.js` — unchanged (save thresholds use BT, but that path reads `stats.bt.total` differently)
- All other existing fixture files — must continue passing

#### `save-resolver.js` BTM/Risk Check

The save resolver uses `bodyType.value` (stat value, not BTM) for threshold calculation — not `btmFromBT`. The `btmFromBT` change does NOT affect save threshold logic. Confirmed safe path.

#### `resolveBodyTypeDamage` Test Behavior After Fix

Current assertions:
```js
assert.deepEqual(resolveBodyTypeDamage(5, 6), {
  bodyTypeModifier: 2,  // BT 6 → BTM –2 → unchanged
  ...
});
assert.deepEqual(resolveBodyTypeDamage(1, 6), {
  bodyTypeModifier: 2,  // BT 6 → BTM –2 → unchanged
  ...
});
assert.deepEqual(resolveBodyTypeDamage(5, "not-a-number"), {
  bodyTypeModifier: 0,  // Invalid → normalizeBodyType → 0 → unchanged
  ...
});
```

The BT 6 and "not-a-number" assertions are unaffected. New assertions must be added for BT 13, 14, and 15:
```js
// 7 penetrating - 6 BTM = 1, positive → minimum is NOT enforced (exact arithmetic)
assert.deepEqual(resolveBodyTypeDamage(7, 13), {
  penetratingDamage: 7,
  bodyTypeModifier: 6,     // BT 13 → BTM –6 → modifier 6 (was 5)
  bodyTypeMitigation: 6,   // full BTM reduction
  finalDamage: 1,
  minimumDamageApplied: false  // 7 - 6 = 1 > 0 → natural result, not forced
}, "BT 13 BTM reduces penetrating damage to exactly 1 (not minimum-forced)");

// 5 penetrating - 6 BTM = -1, would go negative → minimum damage kicks in
assert.deepEqual(resolveBodyTypeDamage(5, 14), {
  penetratingDamage: 5,
  bodyTypeModifier: 6,     // BT 14 → BTM –6 → modifier 6 (was 5)
  bodyTypeMitigation: 4,   // can only reduce to floor of 1 (5 - 4 = 1)
  finalDamage: 1,
  minimumDamageApplied: true  // 5 - 6 = -1, forced to minimum 1
}, "BT 14 BTM forces minimum damage when BTM exceeds penetrating damage");

assert.deepEqual(resolveBodyTypeDamage(10, 15), {
  penetratingDamage: 10,
  bodyTypeModifier: 8,     // BT 15+ → BTM –8 → modifier 8 (was 5)
  bodyTypeMitigation: 8,
  finalDamage: 2,
  minimumDamageApplied: false
}, "BT 15 BTM correctly resolves to modifier 8");
```

### Fixture Design

#### `melee-bt13-vs-bt14`

Context: attacker BT 13, defender BT 14.
Attacker BF → `strengthDamageBonus(13)` = 5. Defender → `btmFromBT(14)` = 6.

```json
{
  "name": "melee-bt13-vs-bt14",
  "context": {
    "attacker": {
      "snapshot": {
        "stats": { "ref": { "total": 8 }, "bt": { "total": 13 } },
        "skills": { "melee": { "level": 5 } }
      }
    },
    "weapon": {
      "snapshot": {
        "damage": "1d10",
        "attackSkill": "melee",
        "attackType": "Melee"
      }
    },
    "targets": [
      {
        "actorUuid": "Actor.tough",
        "name": "Tough Guard",
        "snapshot": {
          "stats": { "ref": { "total": 6 }, "bt": { "total": 14 } },
          "skills": { "melee": { "level": 3 } },
          "hitLocations": { "torso": { "label": "Torso" } },
          "equippedArmor": [
            { "id": "armor-jacket", "name": "Armor Jacket", "system": { "equipped": true, "coverage": { "torso": { "stoppingPower": 4, "ablation": 0 } } } }
          ]
        }
      }
    ]
  },
  "rolls": [
    { "id": "attack", "total": 18, "die": { "natural": 5 } },
    { "id": "defend", "total": 12, "die": { "natural": 3 } },
    { "id": "location", "total": 4, "die": { "natural": 4 }, "location": "torso" },
    { "id": "damage", "total": 8, "die": { "natural": 8 } }
  ],
  "expected": {
    "targets": [
      {
        "attack": { "hit": true, "margin": 6, "roll": { "total": 18 }, "opposedRoll": { "total": 12 } },
        "hits": [
          {
            "location": "torso",
            "rawDamage": 13,
            "strengthDamageBonus": 5,
            "effectiveStoppingPower": 4,
            "armorMitigation": 4,
            "penetratingDamage": 9,
            "bodyTypeModifier": 6,
            "bodyTypeMitigation": 6,
            "finalDamage": 3,
            "minimumDamageApplied": false
          }
        ]
      }
    ]
  }
}
```

#### `melee-bt15-vs-bt15`

BT 15 → `strengthDamageBonus(15)` = 8. Target BT 15 → `btmFromBT(15)` = 8.

```json
{
  "name": "melee-bt15-vs-bt15",
  "context": {
    "attacker": {
      "snapshot": {
        "stats": { "ref": { "total": 10 }, "bt": { "total": 15 } },
        "skills": { "melee": { "level": 6 } }
      }
    },
    "weapon": {
      "snapshot": {
        "damage": "1d6",
        "attackSkill": "melee",
        "attackType": "Melee"
      }
    },
    "targets": [
      {
        "actorUuid": "Actor.powerhouse",
        "name": "Powerhouse",
        "snapshot": {
          "stats": { "ref": { "total": 8 }, "bt": { "total": 15 } },
          "skills": { "melee": { "level": 4 } },
          "hitLocations": { "torso": { "label": "Torso" } },
          "equippedArmor": []
        }
      }
    ]
  },
  "rolls": [
    { "id": "attack", "total": 20, "die": { "natural": 4 } },
    { "id": "defend", "total": 14, "die": { "natural": 2 } },
    { "id": "location", "total": 4, "die": { "natural": 4 }, "location": "torso" },
    { "id": "damage", "total": 4, "die": { "natural": 4 } }
  ],
  "expected": {
    "targets": [
      {
        "attack": { "hit": true, "roll": { "total": 20 }, "opposedRoll": { "total": 14 } },
        "hits": [
          {
            "rawDamage": 12,
            "strengthDamageBonus": 8,
            "bodyTypeModifier": 8,
            "bodyTypeMitigation": 8,
            "finalDamage": 4,
            "minimumDamageApplied": false
          }
        ]
      }
    ]
  }
}
```

#### `melee-bt10-vs-bt10`

BT 10 → `strengthDamageBonus(10)` = 2. Target BT 10 → `btmFromBT(10)` = 4.

```json
{
  "name": "melee-bt10-vs-bt10",
  "context": {
    "attacker": {
      "snapshot": {
        "stats": { "ref": { "total": 8 }, "bt": { "total": 10 } },
        "skills": { "melee": { "level": 4 } }
      }
    },
    "weapon": {
      "snapshot": {
        "damage": "1d6",
        "attackSkill": "melee",
        "attackType": "Melee"
      }
    },
    "targets": [
      {
        "actorUuid": "Actor.strong",
        "name": "Strong Target",
        "snapshot": {
          "stats": { "ref": { "total": 6 }, "bt": { "total": 10 } },
          "skills": { "melee": { "level": 3 } },
          "hitLocations": { "torso": { "label": "Torso" } },
          "equippedArmor": []
        }
      }
    ]
  },
  "rolls": [
    { "id": "attack", "total": 17, "die": { "natural": 5 } },
    { "id": "defend", "total": 12, "die": { "natural": 3 } },
    { "id": "location", "total": 4, "die": { "natural": 4 }, "location": "torso" },
    { "id": "damage", "total": 4, "die": { "natural": 4 } }
  ],
  "expected": {
    "targets": [
      {
        "attack": { "hit": true, "roll": { "total": 17 }, "opposedRoll": { "total": 12 } },
        "hits": [
          {
            "rawDamage": 6,
            "strengthDamageBonus": 2,
            "bodyTypeModifier": 4,
            "bodyTypeMitigation": 4,
            "finalDamage": 2,
            "minimumDamageApplied": false
          }
        ]
      }
    ]
  }
}
```

### Existing Test Compatibility

The only existing test that changes is `assertBodyTypeDamageResolver`:
- BT 6, 5 penetrating → modifier 2, unchanged
- BT 6, 1 penetrating → modifier 2, minimum damage, unchanged
- "not-a-number" → modifier 0, unchanged
- New: BT 13, 7 penetrating → modifier 6
- New: BT 14, 7 penetrating → modifier 6
- New: BT 15, 10 penetrating → modifier 8

No other assertion test or fixture changes. All ranged/auto burst/suppressive fixtures must produce identical outputs — they use target BTs ≤ 10 in their fixture data.

### Regression Proof

| Scenario | Before | After | Change? |
|----------|--------|-------|---------|
| BT 2 (btmFromBT) | 0 | 0 | No |
| BT 6 (btmFromBT) | 2 | 2 | No |
| BT 10 (btmFromBT) | 4 | 4 | No |
| BT 11 (btmFromBT) | 5 (default) | 5 (explicit) | No |
| BT 12 (btmFromBT) | 5 (default) | 5 (explicit) | No |
| BT 13 (btmFromBT) | 5 (default) | **6** (explicit) | **Yes** |
| BT 14 (btmFromBT) | 5 (default) | **6** (explicit) | **Yes** |
| BT 15+ (btmFromBT) | 5 (default) | **8** (default) | **Yes** |
| strDamageBonus(10) | 2 | 2 | No |
| strDamageBonus(12) | 4 | 4 | No |
| strDamageBonus(13) | 5 | 5 | No |
| strDamageBonus(15) | 8 | 8 | No |

**Existing fixtures unaffected** because no existing fixture uses target BT > 10. The only runtime change is for actors with BT 13+ — they become more damage-resistant, which is the intended fix.

### Project Context Reference

- **Source:** `module/lookups.js:268-283` — `btmFromBT` function to fix
- **Source:** `module/lookups.js:291-300` — `strengthDamageBonus` (unchanged)
- **Source:** `module/combat/attack-resolver.js:925-955` — `resolveBodyTypeDamage` (unchanged, calls `btmFromBT`)
- **Source:** `module/combat/attack-resolver.js:747-860` — `resolveMeleeHitDamage` computes `strengthDamageBonus` for attacker
- **Source:** `tests/combat/combat-fixtures.test.js:720-740` — `assertBodyTypeDamageResolver`
- **Source:** `tests/combat/fixtures/melee-baseline.json` — fixture file to extend
- **Source:** `epics.md#Epic 5 / Story 5.3` — FR16 coverage; BT 13-14 mismatch explicitly called out

### Previous Story Intelligence

#### Story 5.2 — Baseline Opposed Melee

- `resolveMeleeHitDamage` already calls `strengthDamageBonus(attackerBT)` and `resolveBodyTypeDamage(penetratingDamage, resolveTargetBodyType(target))`
- All melee fixture cases in `melee-baseline.json` use BT values ≤ 10
- The strength bonus field `strengthDamageBonus` is already present in the hit detail structure
- The body type modifier field `bodyTypeModifier` is populated from `resolveBodyTypeDamage`

#### Story 4.7 — Automatic Fire Fixtures

- Fixture pattern: `singleShotCases` override context fields selectively
- `assertObjectIncludes` for partial matching allows adding expected fields without full outcome specification

### Implementation Order

1. Edit `module/lookups.js`: fix `btmFromBT` switch statement
2. Edit `tests/combat/combat-fixtures.test.js`: add new `assertBodyTypeDamageResolver` assertions for BT 13, 14, 15
3. Edit `tests/combat/fixtures/melee-baseline.json`: add 3 new singleShotCases
4. Run `node tests/run-combat-fixtures.mjs` — all fixtures + assertions must pass
5. Update `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Testing Requirements

Run after all changes:
```sh
node tests/run-combat-fixtures.mjs
```

Expected: all 6 existing fixture files + updated melee-baseline pass. All assertion-based tests pass including updated `assertBodyTypeDamageResolver`.

### Architecture Compliance

- **AD-1 (module/combat/)**: No new resolver modules. Data change in `lookups.js` only.
- **AD-2 (CombatOutcome)**: Outcome shape unchanged; existing `bodyTypeModifier` and `bodyTypeMitigation` now correctly computed for BT 13+.
- **AD-3 (Pure Mechanics)**: `btmFromBT` is pure — no Foundry dependencies.
- **AD-4 (Target Selection)**: Unchanged.
- **AD-7 (Armor at Resolution Time)**: Unchanged.
- **AD-9 (Fixtures)**: New fixture cases for BT 13–14 and BT 15+ melee scenarios.

## File List

- `module/lookups.js` — MODIFY: fix `btmFromBT` with explicit cases for 11–12 (5), 13–14 (6), default (8)
- `tests/combat/combat-fixtures.test.js` — MODIFY: add `assertBodyTypeDamageResolver` assertions for BT 13, 14, 15
- `tests/combat/fixtures/melee-baseline.json` — MODIFY: add 3 new singleShotCases (melee-bt13-vs-bt14, melee-bt15-vs-bt15, melee-bt10-vs-bt10)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — MODIFY: set `5-3-apply-melee-body-type-damage-modifiers: ready-for-dev`

## Change Log

| Date | Change |
|------|--------|
| 2026-05-29 | Initial story specification created |
| 2026-05-29 | Implemented: fixed `btmFromBT` in lookups.js (cases 11-12→5, 13-14→6, 15+→8); added BT 13/14/15 assertions; added 3 new melee fixture cases; all 8 tests pass |

## Dev Agent Record

### Implementation Plan
- **Task #1**: Fixed `btmFromBT` in `module/lookups.js`. Added explicit cases for BT 11-12 (return 5), BT 13-14 (return 6), changed default to 8 (was 5). Removed dead `case 2` (shadowed by `body <= 2` guard). Verified `strengthDamageBonus` unchanged — it bypasses `btmFromBT` for BT 11+ via hardcoded switch cases.
- **Task #2**: Updated `assertBodyTypeDamageResolver` in `tests/combat/combat-fixtures.test.js`. Added 3 new assertions for BT 13 (modifier 6, 7 pen → 1 dmg, no minimum), BT 14 (modifier 6, 5 pen → minimum forced), BT 15 (modifier 8, 10 pen → 2 dmg). All existing BT ≤ 10 assertions unchanged.
- **Task #3**: Added 3 new singleShotCases to `melee-baseline.json`: melee-bt13-vs-bt14 (str bonus 5, BTM 6), melee-bt15-vs-bt15 (str bonus 8, BTM 8), melee-bt10-vs-bt10 (boundary, str bonus 2, BTM 4). All existing 6 cases unchanged.
- **Task #4**: All 8 fixture files pass (ranged, burst, full auto, suppressive, reliability, unsupported, melee, commit).

### Completion Notes
Story 5.3 complete. `btmFromBT` now matches CP2020 corebook page 99: BT 13-14 returns BTM -6 (modifier 6), BT 15+ returns BTM -8 (modifier 8). Existing fixtures unaffected because none use target BT > 10. Regression verified.

## Status

**Status**: done
**Generated by**: Vesper (Story Context Engine)
**Date**: 2026-05-29
**Completed**: 2026-05-29