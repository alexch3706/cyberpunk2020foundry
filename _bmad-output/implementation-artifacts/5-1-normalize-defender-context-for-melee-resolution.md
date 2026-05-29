---
baseline_commit: fc44c2eace30cbb8a287b554b2367fe3782a950f
---

# Story 5.1: Normalize Defender Context for Melee Resolution

**Status**: done

## Story

As a referee,
I want melee targets to resolve into defender actor context,
So that opposed rolls can use defender skills, stats, and target-specific hit locations.

## Acceptance Criteria

1. **Given** a melee or martial action is launched with a selected target
   **When** the combat resolver context is built
   **Then** the defender actor UUID, token UUID, relevant skills/stats, and hit location model are available
   **And** the action type is `"melee"` or `"martial"` and the context preserves all existing `CyberpunkItem` entry‑point behaviour.

2. **Given** a melee or martial action is launched **with no selected targets** (empty targets array)
   **When** target normalization runs
   **Then** `resolveCombatAction` falls through to the legacy `CyberpunkItem.__meleeBonk` / `__martialBonk` path unchanged
   **And** no structured `CombatOutcome` is produced.

3. **Given** a melee or martial action is launched **with a target that has no actor context** (actorless token)
   **When** target normalization runs
   **Then** the target is marked `manualResolution.required = true` with reason `"missing-target-actor"`
   **And** `resolveMeleeAction` produces a structured `CombatOutcome` with `manualResolution: { required: true }`
   **And** the action is **not** silently passed to legacy — the referee sees the manual-resolution state.

4. **Given** a melee or martial action context with all targets resolved
   **When** `resolveCombatAction` is called with `{ structured: true }`
   **Then** the structured resolver recognises the melee action type and produces a valid `CombatOutcome`
   **And** the outcome contains attacker ref, weapon ref, per-target refs with snapshots (including `snapshot.skills` with skill levels from `itemTypes.skill`), and `manualResolution: { required: false }`
   **And** `chat.status` is `"preview"`.

5. **Given** the structured melee path is active
   **When** an existing `assertTargetNormalization` fixture runs
   **Then** it must continue to pass without modification.

6. **Given** `CyberpunkItem.isRanged()` is called for a melee exotic weapon (e.g. Monokatana with `attackType: "Mono"`)
   **When** the check runs
   **Then** it correctly returns `false` (the weapon is recognized as melee)
   **And** the attack routes through the melee/martial path, not the ranged resolver.

## Tasks / Subtasks

- [x] #1: Audit current melee/martial context flow and identify gaps (AC: 1, 2, 3)
  - [x] Analyse `CyberpunkItem.__buildCombatResolverContext` for melee/martial action type
  - [x] Analyse `resolveCombatAction` routing — confirm melee falls through to legacy today
  - [x] Analyse `__buildCombatTargetContext` — confirm targets are cloned without snapshot enrichment
  - [x] Confirm `normalizeSelectedTargets` enriches with stats/hitLocations but **not** skills from `itemTypes.skill` on the target side
  - [x] Map the gaps: (A) resolver routing ignores melee, (B) target snapshots lack skill levels, (C) `isRanged()` misidentifies exotic melee

- [x] #2: Extend `combat-resolver.js` to accept melee/martial action type (AC: 4)
  - [x] Add `canResolveMeleeContext(context, roller)` guard:
    - For `action.type === "melee"`: validates `context.weapon.snapshot.attackSkill` is set
    - For `action.type === "martial"`: validates `context.action.meleeAction` is set (action chosen), **does not** require `attackSkill` on weapon (the skill comes from the chosen martial art)
  - [x] Import `resolveMeleeAction` from `attack-resolver.js`
  - [x] Wire `melee` and `martial` action types through `resolveCombatAction` with `{ structured: true }` path
  - [x] Preserve legacy fallback behaviour when `canResolveMeleeContext` returns false (missing data → fall through to legacy)

- [x] #3: Add `resolveMeleeAction` shell function in `attack-resolver.js` (AC: 4, 3)
  - [x] Accept context, weapon, targets
  - [x] Validate required context fields:
    - `context.attacker.snapshot.stats` (REF)
    - For `"melee"`: `context.weapon.snapshot.attackSkill`
    - For `"martial"`: `context.action.meleeAction` (the chosen martial action like Strike/Kick)
  - [x] When any validation fails → `canResolveMeleeContext` already prevents routing; the guard is sufficient
  - [x] Produce a `CombatOutcome` with action, attacker, weapon, per-target outcomes
  - [x] Each target outcome has: target ref, `attack: { hit: false }` (placeholder; actual opposed resolution deferred to Story 5.2), `hits: []`, `plannedUpdates`, `warnings`
  - [x] If a target has `manualResolution.required = true` → propagate it; produce action-level `manualResolution`
  - [x] No damage resolution — this story is *context normalisation* only

- [x] #4: Enrich melee/martial target context with defender snapshot (AC: 1, 4)
  - [x] ~~Melee/martial targets already pass through `normalizeSelectedTargets` in `actor-sheet.js` (line 233) before `__weaponRoll` is called~~ — this is already done project-wide
  - [x] **But** `target-normalizer.js`: `buildTargetSnapshot` only clones `actor.system.skills` which is often empty or partial. Fix: enrich `snapshot.skills` from `actor.itemTypes.skill` (same pattern as `__buildCombatSkillSnapshot` in `item.js`)
  - [x] Verify `manualResolution.required = true` + `reason: "missing-target-actor"` is already correctly set for actorless tokens in `normalizeSelectedTargets`
  - [x] Verify that tokens without `.actor` don't crash `normalizeSelectedTargets` (defensive code already present)
  - [x] `snapshot.hitLocations` already propagates through `normalizeSelectedTargets` — confirm it's present

- [x] #5: Fix `isRanged()` exotic melee bug (AC: 6)
  - [x] In `module/item/item.js`, change `isRanged()` check to compare against `Object.values(meleeAttackTypes)` instead of `Object.keys(...)` which uses lowercased keys
  - [x] Verify `system.attackType` values match `Object.values(meleeAttackTypes)` (`"Melee"`, `"Mono"`, `"Martial"`, `"Beast"`)
  - [x] Ensure this doesn't break any existing ranged weapons

- [x] #6: Add deterministic fixture for melee context normalisation (AC: 4, 3, 5)
  - [x] Create `tests/combat/fixtures/melee-baseline.json` with:
    - **Root level**: `"rolls": []`, `"expected": { "outcome": { "chatStatus": "preview" }, "plannedUpdates": {}, "chatData": { "preview": {} } }` (required by `runFixture` test runner)
    - baseline context: melee weapon, attacker with stats/skills, one target with actor snapshot
    - singleShotCase: **melee-valid-defender** — melee action with valid defender → outcome has target snapshot with stats/skills/hitLocations, `manualResolution: { required: false }`
    - singleShotCase: **melee-actorless-target** — melee action with no‑actor target → `manualResolution.required = true`, structured outcome (not legacy)
    - singleShotCase: **martial-valid-defender** — martial action with valid defender → `action.type = "martial"`, target has skills, `meleeAction` present
    - singleShotCase: **melee-no-targets** — empty targets array → `canResolveMeleeContext` returns false → falls to legacy fallback (tested via legacyExpected sentinel if feasible, or just verify guard behaviour)
  - [x] Run `node tests/combat/combat-fixtures.test.js` — all 7 fixtures + commit test pass

- [x] #7: Update sprint status and document (AC: all)
  - [x] Mark story Status: `review`
  - [x] Update `sprint-status.yaml`: `5-1-normalize-defender-context-for-melee-resolution: review`
  - [x] Move epic-5 to `in-progress` (already was)

### Review Findings

- [x] [Review][Patch] Make operator precedence explicit in isRanged() check [module/item/item.js:29]

## Dev Notes

### Current State (Before Story)

#### Melee Routing Gap

`resolveCombatAction` in `module/combat/combat-resolver.js` only routes to the structured resolver for:
- **Ranged** single‑shot (semi‑auto, 3‑round burst, full‑auto)
- **Ranged** suppressive fire with valid zone inputs

Melee and martial actions (`action.type === "melee"` / `"martial"`) **always fall through** to `context.legacy.fallback` (`__meleeBonk` / `__martialBonk`).

#### Target Context — Skills Gap

`normalizeSelectedTargets` is called project-wide in `actor-sheet.js` line 233 **before** any weapon roll:

```js
let targetTokens = normalizeSelectedTargets(game.users.current.targets.values());
```

This means **all** weapon types (ranged, melee, martial) already receive enriched targets with `snapshot.stats`, `snapshot.damage`, `snapshot.hitLocations`, `equippedArmor`, and `equippedCyberware` via `target-normalizer.js:buildTargetSnapshot`.

**However**, `buildTargetSnapshot` only does:
```js
skills: clonePlainData(actor.system.skills),
```

In the Cyberpunk2020 system, actor skills are primarily stored as **item documents** (`actor.itemTypes.skill`), not directly in `actor.system.skills`. The attacker-side code in `item.js:__buildCombatSkillSnapshot` correctly iterates `actor.itemTypes.skill`:
```js
const skills = clonePlainData(actor?.system?.skills?.skills || actor?.system?.skills || {}) || {};
for(const skill of actor?.itemTypes?.skill || []) {
  skills[skill.name] = { level: actor.getSkillVal(skill.name) };
}
```

**Defender targets get empty or partial skill objects.** This story fixes `target-normalizer.js` to use the same pattern so defender `snapshot.skills` contains real skill levels for Melee, Brawling, Martial Arts, and Athletics.

#### `isRanged()` Exotic Melee Bug

Current code in `item.js`:
```js
return !(system.weaponType === "Melee" || system.weaponType === "Exotic" && Object.keys(meleeAttackTypes).includes(system.attackType));
```

`Object.keys(meleeAttackTypes)` → `["melee", "mono", "martial", "cyberbeast"]` (lowercase)
`system.attackType` for exotic melee → `"Mono"` or `"Beast"` (PascalCase)

So `"mono".includes("Mono")` → `false` → exotic melee weapon is identified as **ranged** (`isRanged()` returns `true`).
Fix: use `Object.values(meleeAttackTypes)` → `["Melee", "Mono", "Martial", "Beast"]` — matches stored data.

This is a live bug that prevents exotic melee weapons (monokatana, cyberbeast claws) from routing through the melee/martial path. Fixing it here is correct scope: this story is about making melee routing work.

#### Existing Melee Legacy Methods

`__meleeBonk` (item.js:504):
- Rolls `1d10x10 + @stats.ref.total + @attackBonus` — **unopposed**, just an attack roll, no defender roll, no DC, no opposed mechanic
- Rolls `@{weapon.damage} + @strengthBonus` using `strengthDamageBonus(bt)`
- Rolls hit location via `rollLocation`
- Returns a `Multiroll` chat card — no `CombatOutcome`, no preview/confirm

`__martialBonk` (item.js:519):
- Uses `attackMods.action` to determine the martial action (Strike, Kick, etc.)
- Uses `attackMods.martialArt` for the chosen martial art skill
- Rolls `1d10x10 + @stats.ref.total + @attackBonus + @keyTechniqueBonus`
- For damaging actions (strike, kick, throw, choke) rolls damage with `@strengthBonus + @martialDamageBonus`
- For non-damaging actions just produces the attack roll
- Returns a `Multiroll` chat card

#### Strength Damage Bonus (lookups.js:291)

```js
export function strengthDamageBonus(bt) {
  let btm = btmFromBT(bt);
  if(btm < 5) return btm - 2;
  switch(bt) {
    case 11: case 12: return 4;
    case 13: case 14: return 5;
    default: return 8;
  }
}
```

Note the known BT 13-14 mismatch (Story 5.3 will fix this). For Story 5.1 we just preserve existing behaviour.

### What This Story Changes

1. **`combat-resolver.js`** — adds `canResolveMeleeContext` guard (differentiates melee vs martial validation), imports `resolveMeleeAction`, routes melee/martial action types through structured path
2. **`attack-resolver.js`** — adds `resolveMeleeAction` shell that validates context and produces a minimal `CombatOutcome` (defender snapshots present, no actual opposed roll yet)
3. **`target-normalizer.js`** — enrich target `snapshot.skills` from `actor.itemTypes.skill` (defender skills were previously empty)
4. **`item.js`** — fix `isRanged()` exotic melee bug (`Object.keys` → `Object.values`)

### What This Story Does NOT Change

- `CyberpunkItem.__meleeBonk` / `__martialBonk` — legacy paths remain untouched
- Opposed roll mechanics — deferred to Story 5.2
- Damage modifiers (BT damage bonus) — deferred to Story 5.3
- Martial arts data module — deferred to Story 5.4
- Preview/confirm for melee — deferred to later stories
- `actor-sheet.js` — the `normalizeSelectedTargets` call is already correct
- Existing `assertTargetNormalization()` — must continue passing unchanged
- `combat-chat.js`, `state-planner.js`, `combat-commit.js` — unchanged (melee stays on legacy chat)

### Structured vs Legacy Resolution Paths for Melee

| Scenario | `canResolveMeleeContext` | Action |
|---|---|---|
| Melee, no targets selected | `false` (targets empty) | Falls to legacy `__meleeBonk` |
| Melee, valid target with actor | `true` | Structured `resolveMeleeAction` → CombatOutcome |
| Melee, actorless target | `true` (target exists) | Structured `resolveMeleeAction` → CombatOutcome with `manualResolution.required = true` |
| Martial, no meleeAction chosen | `false` (guard rejects) | Falls to legacy `__martialBonk` |
| Martial, valid action + target | `true` | Structured `resolveMeleeAction` → CombatOutcome |
| Martial, no attackSkill on weapon | `true` (martial does NOT require weapon.attackSkill) | Structured path — skill comes from martial art choice |

### Project Structure Notes

Files to **MODIFY**:
- `module/combat/combat-resolver.js` — add `canResolveMeleeContext` guard + routing
- `module/combat/attack-resolver.js` — add `resolveMeleeAction` shell function
- `module/combat/target-normalizer.js` — enrich `snapshot.skills` from `actor.itemTypes.skill`
- `module/item/item.js` — fix `isRanged()` exotic melee bug (`Object.keys` → `Object.values`)
- `tests/combat/combat-fixtures.test.js` — register new fixture for melee (`FIXTURE_URLS`)

Files to **CREATE**:
- `tests/combat/fixtures/melee-baseline.json` — melee context normalisation fixtures (4 singleShotCases)

Files **NOT TOUCHED** (cross-cutting contract):
- `module/combat/combat-outcome.js` — contracts unchanged
- `module/combat/state-planner.js` — no new state planning for melee yet
- `module/combat/combat-chat.js` — chat rendering unchanged (melee stays on legacy chat path)
- `module/combat/combat-commit.js` — no commit changes
- `module/combat/armor-resolver.js` — no changes
- `module/combat/save-resolver.js` — no changes
- `module/combat/settings-helpers.js` — no changes
- `module/lookups.js` — no changes
- `module/actor/actor-sheet.js` — already calls `normalizeSelectedTargets` correctly
- `module/item/item-sheet.js` — no changes
- `docs/testing/foundry-manual-checks.md` — no changes (Foundry checks deferred to Story 5.7)
- All existing fixture files — must continue passing unchanged

### References

- [Source: `module/combat/combat-resolver.js`#L13-L15] — `resolveCombatAction` routes only ranged, melee/martial falls through to legacy
- [Source: `module/combat/combat-resolver.js`#L43-L49] — `canResolveSingleShotRangedContext` checks `action.type === "ranged"`
- [Source: `module/item/item.js`#L222-L228] — action type is set to `"melee"` or `"martial"` in `__buildCombatResolverContext`
- [Source: `module/item/item.js`#L29-L31] — `isRanged()` bug: `Object.keys(meleeAttackTypes)` uses lowercased keys
- [Source: `module/combat/target-normalizer.js`#L42-L64] — `buildTargetSnapshot` clones `actor.system.skills` directly without iterating `itemTypes.skill`
- [Source: `module/item/item.js`#L335-L348] — `__buildCombatSkillSnapshot` correctly iterates `itemTypes.skill`
- [Source: `module/actor/actor-sheet.js`#L233] — `normalizeSelectedTargets` is already called before all weapon rolls
- [Source: `module/combat/combat-outcome.js`#L42-L49] — `CombatActionContext.type` accepts `"melee"` and `"martial"` per JSDoc
- [Source: `module/combat/combat-outcome.js`#L7-L9] — `COMBAT_CHAT_STATUS` constants
- [Source: `module/item/item.js`#L504-L517] — `__meleeBonk` legacy method (unopposed)
- [Source: `module/item/item.js`#L519-L553] — `__martialBonk` legacy method (unopposed, action‑aware)
- [Source: `module/lookups.js`#L66-L73] — `meleeAttackTypes` including `"melee"`, `"mono"`, `"martial"`, `"cyberbeast"` (object keys are lowercased)
- [Source: `module/lookups.js`#L291-L300] — `strengthDamageBonus(bt)` current implementation
- [Source: `tests/combat/combat-fixtures.test.js`#L19-L28] — `assertTargetNormalization` test (3 targets)
- [Source: `epics.md`#Epic 5] — FR15, FR17 coverage; both emphasize defender context availability

### `resolveMeleeAction` Shell Contract

```js
/**
 * Resolve a melee or martial action — produces a CombatOutcome with target
 * snapshots and placeholder attack data. Actual opposed resolution deferred
 * to Story 5.2.
 *
 * @param {Object} context CombatActionContext with type "melee" or "martial".
 *   For "melee": context.weapon.snapshot.attackSkill is required (validated by guard).
 *   For "martial": context.action.meleeAction is required (validated by guard);
 *                  weapon.attackSkill is NOT required (skill comes from martial art selection).
 * @param {Object} [options] Reserved for future resolver options.
 * @param {Function} [roller] Deterministic roller for fixture support.
 * @returns {Object} Minimal CombatOutcome with enriched target snapshots.
 */
export function resolveMeleeAction(context, options = {}, roller = undefined) {
  // Structure:
  // - attacker ref + snapshot (stats, skills)
  // - weapon ref + snapshot
  // - per-target outcomes:
  //   - target ref with snapshot.stats (REF, BT), snapshot.skills (Melee, Brawling, Martial Arts, Athletics),
  //     snapshot.hitLocations
  //   - attack: { hit: false } (placeholder — real opposed roll in Story 5.2)
  //   - hits: [] (no damage in this story)
  //   - manualResolution: propagated from target if missing actor
  //   - warnings: propagated from target
  // - action-level manualResolution: required if any target has manualResolution
  // - chat.status: "preview"
  // - No state planning, no saves, no ammo delta (melee doesn't consume ammo)
}
```

### `canResolveMeleeContext` Guard Design

```js
function canResolveMeleeContext(context, roller) {
  const actionType = context?.action?.type || "";
  if (actionType !== "melee" && actionType !== "martial") return false;
  if (typeof roller !== "function") return false;
  if (!context?.attacker?.snapshot?.stats) return false;
  if (!Array.isArray(context.targets) || context.targets.length === 0) return false;

  if (actionType === "melee") {
    // Melee weapons always have attackSkill (Melee, Fencing, Brawling, etc.)
    if (!context?.weapon?.snapshot?.attackSkill) return false;
  } else if (actionType === "martial") {
    // Martial requires an action choice (Strike, Kick, etc.); skill comes from martial art
    if (!context?.action?.meleeAction) return false;
  }

  return true;
}
```

### Fixture File Shape (`tests/combat/fixtures/melee-baseline.json`)

```json
{
  "name": "melee-baseline",
  "useStructured": true,
  "rolls": [],
  "expected": {
    "outcome": {
      "chatStatus": "preview"
    },
    "plannedUpdates": {},
    "chatData": {
      "preview": {}
    }
  },
  "context": {
    "action": {
      "type": "melee",
      "fireMode": null,
      "meleeAction": null,
      "range": null,
      "targetArea": null,
      "options": {}
    },
    "attacker": {
      "actorUuid": "Actor.attacker",
      "name": "Solo",
      "snapshot": {
        "stats": { "ref": { "total": 8 }, "bt": { "total": 6 } },
        "skills": {
          "melee": { "level": 5 },
          "brawling": { "level": 4 }
        }
      }
    },
    "weapon": {
      "itemUuid": "Actor.attacker.Item.knife",
      "name": "Knife",
      "snapshot": {
        "damage": "1d6",
        "attackSkill": "melee",
        "attackType": "Melee"
      }
    },
    "targets": [
      {
        "tokenUuid": "Scene.s.Token.defender",
        "actorUuid": "Actor.defender",
        "name": "Guard",
        "snapshot": {
          "stats": { "ref": { "total": 6 }, "bt": { "total": 8 } },
          "skills": {
            "melee": { "level": 4 },
            "brawling": { "level": 2 },
            "athletics": { "level": 3 }
          },
          "hitLocations": {
            "torso": { "label": "Torso" },
            "head": { "label": "Head" }
          }
        }
      }
    ]
  },
  "singleShotCases": [
    {
      "name": "melee-valid-defender",
      "context": {},
      "rolls": [],
      "expected": {
        "action": { "type": "melee" },
        "attacker": { "actorUuid": "Actor.attacker" },
        "weapon": { "itemUuid": "Actor.attacker.Item.knife" },
        "targets": [
          {
            "target": {
              "actorUuid": "Actor.defender",
              "name": "Guard",
              "snapshot": {
                "stats": { "ref": { "total": 6 } },
                "skills": {
                  "melee": { "level": 4 },
                  "brawling": { "level": 2 },
                  "athletics": { "level": 3 }
                },
                "hitLocations": {
                  "torso": { "label": "Torso" },
                  "head": { "label": "Head" }
                }
              }
            },
            "attack": { "hit": false },
            "manualResolution": { "required": false }
          }
        ],
        "manualResolution": { "required": false },
        "chat": { "status": "preview" }
      }
    },
    {
      "name": "melee-actorless-target",
      "context": {
        "targets": [
          {
            "tokenUuid": "Scene.s.Token.actorless",
            "name": "Mysterious Figure",
            "manualResolution": {
              "required": true,
              "reason": "missing-target-actor",
              "message": "Target Actor is unavailable; resolve target damage, armor, and saves manually.",
              "blockedUpdateCategories": ["target-damage", "target-armor", "target-saves"]
            }
          }
        ]
      },
      "rolls": [],
      "expected": {
        "action": { "type": "melee" },
        "targets": [
          {
            "manualResolution": { "required": true, "reason": "missing-target-actor" }
          }
        ],
        "manualResolution": { "required": true }
      }
    },
    {
      "name": "martial-valid-defender",
      "context": {
        "action": {
          "type": "martial",
          "meleeAction": "Strike",
          "options": {}
        },
        "attacker": {
          "snapshot": {
            "stats": { "ref": { "total": 9 }, "bt": { "total": 6 } },
            "skills": {
              "brawling": { "level": 6 },
              "karate": { "level": 5 }
            }
          }
        },
        "weapon": {
          "snapshot": {
            "damage": "1d3",
            "attackSkill": null,
            "attackType": "Martial"
          }
        },
        "targets": [
          {
            "actorUuid": "Actor.defender",
            "name": "Guard",
            "snapshot": {
              "stats": { "ref": { "total": 6 }, "bt": { "total": 8 } },
              "skills": {
                "brawling": { "level": 3 },
                "karate": { "level": 2 }
              },
              "hitLocations": { "torso": { "label": "Torso" }, "head": { "label": "Head" } }
            }
          }
        ]
      },
      "rolls": [],
      "expected": {
        "action": { "type": "martial", "meleeAction": "Strike" },
        "targets": [
          {
            "target": { "actorUuid": "Actor.defender" },
            "attack": { "hit": false },
            "manualResolution": { "required": false }
          }
        ],
        "manualResolution": { "required": false }
      }
    },
    {
      "name": "melee-no-targets",
      "context": {
        "targets": []
      },
      "rolls": [],
      "legacyExpected": {
        "manualResolution": true,
        "warning": "Legacy fallback for empty targets"
      },
      "expected": {}
    }
  ]
}
```

Note: `"melee-no-targets"` tests the guard rejecting empty targets. Since `runFixture` will try to run the structured path and `canResolveMeleeContext` returns false, it falls to legacy fallback. The `legacyExpected` sentinel is used because the structured resolver won't handle it (empty array → guard rejects → `context.legacy.fallback` called → returns `legacyExpected`).

## Testing Requirements

### Deterministic Fixture Coverage

Run after changes:
```sh
node tests/run-combat-fixtures.mjs
```

New fixture file `tests/combat/fixtures/melee-baseline.json` must pass with all 4 singleShotCases. All existing 6 fixture files + commit test must continue passing unchanged.

### Existing Test Behaviour Check

The following existing assertions must NOT break:
- `assertTargetNormalization()` — 3 test targets (actor-backed, actorless, plain)
- `assertBodyTypeDamageResolver()` — 4 cases
- `assertWoundPlanning()` — 11 cases
- `assertSavePromptResolution()` — 5 cases
- `assertArmorResolver()` — 16+ assertions
- `assertCombatResolverRouting()` — 3 cases (single, multi, insufficient ammo)
- `assertSettingsHelpers()` — 3 states
- `combat-commit.test.js` — 9 async assertions

### What NOT to Break

- All 6 existing fixture files must continue passing
- `combat-commit.test.js` must continue passing
- `__meleeBonk` and `__martialBonk` legacy methods must remain functional and unchanged
- `renderTemplate`, chat rendering, preview/confirm dialog — all unchanged by this story
- `isRanged()` for non-exotic weapons must continue returning correct values
- Ranged weapons must never be affected by the `isRanged()` fix

## Architecture Compliance

- **AD-1 (module/combat/)**: New resolver module entry added (`resolveMeleeAction` in attack-resolver.js)
- **AD-2 (CombatOutcome)**: Melee outcomes follow the same `CombatOutcome` shape
- **AD-3 (Pure Mechanics)**: `resolveMeleeAction` is pure — no Foundry dependencies
- **AD-4 (Target Selection)**: Defender actor context preserved in target refs with snapshots; skills now properly enriched
- **AD-5 (Preview/Confirm)**: Not yet wired for melee — preview/confirm deferred to later stories
- **AD-6 (Planned Updates)**: No state planning for melee yet
- **AD-7 (Armor at Resolution Time)**: No armor resolution for melee yet
- **AD-8 (Corebook Fidelity)**: No settings changes
- **AD-9 (Fixtures)**: New fixture file `melee-baseline.json` with 4 singleShotCases

## Previous Story Intelligence

### Story 4.7 — Automatic Fire Fixtures (Most Recent)

Key learnings applicable to this story:
- Fixture pattern: `singleShotCases` with `assertObjectIncludes` for partial matching
- Structured fixtures use `useStructured: true` flag and bypass legacy fallback
- Context override in singleShotCases: only set what differs from baseline
- Scripted roller consumes rolls in order; `roller.assertComplete()` ensures no unused rolls
- `__UNDEFINED__` sentinel for optional/missing fields in fixtures
- Zero-roll fixtures (melee shell has no rolls in this story) should use empty `rolls: []`
- `legacyExpected` sentinel used when the resolver should fall through to fallback

### Story 4.6 — Disable Unsupported Modes

- `filterSupportedFireModes` exists in `settings-helpers.js`
- Melee fire modes are not currently filtered — no impact on this story

### Story 4.5 — Reliability/Fumble/Jam

- `resolveJamOutcome` only applies to `fullauto` and `threeroundburst` fire modes — no impact on melee

### Epic 2 — Target Normalization

- `normalizeSelectedTargets` in `target-normalizer.js` already handles actor-backed, actorless, and plain target patterns
- `assertTargetNormalization` covers all three patterns
- This story fixes the skills enrichment gap in the normalizer

## Git Intelligence Summary

```
fc44c2e feat(combat): complete story 4.6 and 4.7 - automatic fire mode suppression and fixture coverage
a4bdeb4 feat(combat): implement reliability, fumble, and jam handling (Story 4.5)
61003ff feat(combat): implement suppressive fire resolver and apply code review fixes
6b0ff36 feat(combat): resolve full auto across multiple targets (Story 4.3)
95de336 feat: implement Story 4.2 full auto against one target and fix review findings
fcd44cd feat(combat): migrate three-round burst to resolver/outcome pipeline (story 4-1)
be2d7ba feat(combat): implement combat story 3.7 - add damage pipeline fixtures and manual checks checklist
```

Recent commits all focused on automatic fire. Melee/martial is the next frontier — no prior melee resolver work exists yet.

## Project Context Reference

- **Resolver entry**: `module/combat/combat-resolver.js` → `resolveCombatAction(context, options, roller)`
- **Target normalizer**: `module/combat/target-normalizer.js` → `normalizeSelectedTargets()`
- **Attack resolver**: `module/combat/attack-resolver.js` → has `resolveSingleShotRangedAttack`, `resolveSuppressiveFire`, `resolveJamOutcome`, `resolveBodyTypeDamage`
- **Outcome contracts**: `module/combat/combat-outcome.js` — typed typedefs
- **Lookups**: `module/lookups.js` — `meleeAttackTypes`, `strengthDamageBonus`, `btmFromBT`
- **Legacy melee**: `module/item/item.js` — `__meleeBonk` (line 504), `__martialBonk` (line 519), `isRanged()` (line 29)
- **Fixture runner**: `node tests/run-combat-fixtures.mjs` — pure Node, no Foundry
- **Test module**: `tests/combat/combat-fixtures.test.js` — exports `runCombatFixtures()`
- **Existing fixtures**: 6 files in `tests/combat/fixtures/`
- **Settings helpers**: `module/combat/settings-helpers.js`

## Dev Agent Record

### Agent Model Used

openrouter/deepseek/deepseek-v4-flash

### Debug Log References

- Melee routing gap: `resolveCombatAction` lines 28-31 — only ranged actions routed to structured
- Skills enrichment gap: `target-normalizer.js:buildTargetSnapshot` only clones `actor.system.skills`, missing `itemTypes.skill` iteration
- `isRanged()` bug: `Object.keys(meleeAttackTypes)` vs `Object.values(meleeAttackTypes)` — case mismatch for exotic melee
- `normalizeSelectedTargets` already called project-wide at `actor-sheet.js:233`
- `canResolveMeleeContext` guard: melee validates `attackSkill`, martial validates `meleeAction`
- `resolveMeleeAction`: produces minimal CombatOutcome, no opposed roll, no damage, no state planning
- No new dependencies on Foundry globals — pure resolver function

### Completion Notes List

- ✅ `isRanged()` exotic melee bug fixed (`Object.keys` → `Object.values`)
- ✅ `target-normalizer.js` skills enrichment: `buildTargetSnapshot` now builds enriched skills from `actor.itemTypes.skill` via `buildEnrichedSkills`
- ✅ `resolveMeleeAction` shell added to `attack-resolver.js` — produces minimal `CombatOutcome` with per-target snapshots, placeholder `attack: { hit: false }`, and `manualResolution` propagation
- ✅ `canResolveMeleeContext` guard added to `combat-resolver.js` — differentiates melee (validates `attackSkill`) vs martial (validates `meleeAction`), rejects empty targets
- ✅ Melee/martial action types wired through `resolveCombatAction` structured path before legacy fallback
- ✅ Fixture file `melee-baseline.json` created with 4 singleShotCases — all pass alongside 6 existing fixtures
- ✅ All 8 combat fixture tests pass, all assertion-based tests pass
- No resolver logic beyond context normalisation — Story 5.2 handles actual opposed roll mechanics

### File List

- `module/combat/combat-resolver.js` — MODIFY: add `canResolveMeleeContext` guard + `resolveMeleeAction` import + routing
- `module/combat/attack-resolver.js` — MODIFY: add `resolveMeleeAction` shell function
- `module/combat/target-normalizer.js` — MODIFY: enrich `snapshot.skills` from `actor.itemTypes.skill`
- `module/item/item.js` — MODIFY: fix `isRanged()` exotic melee bug (`Object.keys` → `Object.values`)
- `tests/combat/fixtures/melee-baseline.json` — CREATE: 4 singleShotCases for melee context normalisation
- `tests/combat/combat-fixtures.test.js` — MODIFY: add `melee-baseline.json` to `FIXTURE_URLS`

## Change Log

| Date | Change |
|------|--------|
| 2026-05-29 | Initial story specification created |
| 2026-05-29 | Implementation complete: isRanged() fix, target-normalizer skills enrichment, resolveMeleeAction shell, canResolveMeleeContext guard + routing, melee-baseline fixture |

## Status

**Status**: review
**Modified by**: Vesper (implementation)
**Date**: 2026-05-29