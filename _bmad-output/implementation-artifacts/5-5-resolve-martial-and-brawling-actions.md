---
baseline_commit: ab1af28
---

# Story 5.5: Resolve Martial and Brawling Actions

**Status**: done

## Story

As a referee,
I want martial and brawling actions to produce action-specific outcomes,
So that strike, kick, block/parry, dodge, disarm, sweep/trip, grapple, hold, choke, throw, and escape are not generic attacker-only rolls.

**Requirements:** FR-17, FR-18, FR-20, UX-DR3
**Epic 5:** Opposed Melee and Martial Arts
**Dependencies:**
- Story 5.2 (opposed melee roll baseline) — **done**
- Story 5.3 (BT damage modifiers) — **done**
- Story 5.4 (martial-arts-data.js with key technique bonuses) — **done**, data module ready
- `module/combat/martial-arts-data.js` — exports `getKeyTechniqueBonus`, `getRequiresPrerequisite`, `MARTIAL_ACTIONS` etc.

---

## Summary

`resolveMeleeAction` in `attack-resolver.js` currently treats all martial actions identically: opposed roll → hit → weapon die + strength bonus damage. This story differentiates all 11 martial/brawling actions with action-specific behavior:

1. **Plug in `keyTechniqueBonus`** from `martial-arts-data.js` into the opposed roll total.
2. **Categorize actions** into damage vs. non-damage vs. grapple-family outcomes.
3. **Surface prerequisite warnings** as `pendingDecisions` for any action with prerequisites, regardless of category.
4. **Build `MARTIAL_ACTION_CLASSIFICATIONS`** mapping for use by the resolver and potential UI consumers.
5. **Add fixtures** for every action category: strike/kick hit+damage, block/parry/dodge/disarm no-damage hit, grapple-family pending/prerequisite cases.


---

## Acceptance Criteria

1. **Given** a martial action with `context.action.meleeAction` and `context.action.options.martialArt`
   **When** `resolveMeleeTargetOutcome` is called
   **Then** `keyTechniqueBonus` from `martial-arts-data.js` is added to the attacker's opposed roll total
   **And** `getKeyTechniqueBonus(style, action)` lookup uses the normalized (lowercase, trimmed) martialArt and meleeAction values
   **And** the bonus is included in the `attack.roll` output evidence (e.g. as `keyTechniqueBonus`)
   **And** missing/invalid style returns 0 bonus (no crash).

2. **Given** any martial action (strike, kick, block/parry, dodge, disarm, sweep/trip, grapple, hold, choke, throw, escape)
   **When** resolution runs
   **Then** the action's category determines outcome behavior:
     - **damageOnly** (strike, kick): opposed roll → hit → damage resolved
     - **nonDamage** (dodge, block/parry, disarm): opposed roll → hit → no damage (hits array empty)
     - **grappleFamily** (grapple, hold, choke, throw, sweep/trip, escape): opposed roll → hit → no damage; **plus** `pendingDecisions` containing prerequisite warnings when applicable
   - **Any action with prerequisites** generates `pendingDecisions` on the root `CombatOutcome`, aggregated from all targets
   **And** the outcome includes `action.martialCategory` indicating the classification.

3. **Given** any martial action with prerequisites (e.g. choke requires hold, escape requires grapple/hold, Aikido disarm requires blockParry/dodge, style-specific prereqs)
   **When** resolver builds the outcome
   **Then** `pendingDecisions` on the root `CombatOutcome` includes one or more entries with:
     - `pendingDecisions[i].reason`: `"prerequisite-check"`
     - `pendingDecisions[i].message`: Human-readable requirement, e.g. `"Choke requires a successful Hold — verify Hold is active on the target before applying this outcome."`
     - `pendingDecisions[i].action`: the meleeAction that triggered the check
     - `pendingDecisions[i].requires`: array of required prior actions
   **And** null/empty prerequisites produce no pending decision.

4. **Given** `resolveMeleeTargetOutcome` with a martial action that is not in `MARTIAL_ACTIONS`  
   **When** resolution runs
   **Then** the action falls back to **damageOnly** behavior (strike/kick pattern)
   **And** `keyTechniqueBonus` is 0 for the unknown action.

5. **Given** existing melee and martial fixture cases
   **When** the changes are applied
   **Then** all existing fixtures continue to pass unchanged (the `martial-action-shell` case still produces a valid hit outcome with `keyTechniqueBonus: 0` and no `pendingDecisions`, since it uses `meleeAction: "Strike"` with no martialArt selected — brawling default).

---

## Tasks / Subtasks

- [x] #1: Add `KEY_TECHNIQUE_BONUS_DISPLAY` constant or integrate key technique bonus into the martial attack roll (AC: 1)
- [x] #2: Add `MARTIAL_ACTION_CLASSIFICATIONS` — categorize all 11 actions into `damageOnly`, `nonDamage`, `grappleFamily` (AC: 2)
- [x] #3: Modify `resolveMeleeTargetOutcome` to apply action classification and skip damage for non-damage actions (AC: 2)
- [x] #4: Add prerequisite pending decisions for any action with prerequisites, aggregated to root CombatOutcome (AC: 3)
- [x] #5: Add fallback for unknown actions (AC: 4)
- [x] #6: Verify all existing fixtures pass (AC: 5)
- [x] #7: Add new martial action fixtures covering each category (AC: 1-4)
- [x] #8: Update sprint status

### Review Findings

- [x] [Review][Patch] Unused Import of `MARTIAL_ACTIONS` [module/combat/attack-resolver.js:4]
- [x] [Review][Dismiss] Unused Variable `attackerSkillLevel` [module/combat/attack-resolver.js:701] — false positive, used dynamically in rollData
- [x] [Review][Dismiss] Mismatched Action Keys in `MARTIAL_ACTION_CLASSIFICATIONS` [module/combat/attack-resolver.js:29-37] — false positive, matches internal data keys which don't use slashes
- [x] [Review][Patch] Fragile Root-Level `martialCategory` Resolution [module/combat/attack-resolver.js:641-645]
- [x] [Review][Dismiss] Prerequisite Warning Generated on Misses/Fumbles [module/combat/attack-resolver.js:780-791] — false positive, design choice to check prerequisites on any attempt

---

## Developer Context

### Current State

`module/combat/attack-resolver.js` `resolveMeleeTargetOutcome` (line 597 onwards):

```js
// Current martial attack skill lookup (line 661-662):
if (context.action?.type === "martial") {
  attackSkill = context.action.options?.martialArt || "brawling";
}

// Current keyTechniqueBonus placeholder (line 669):
const attackerSkillLevel = getSkillValueCaseInsensitive(attacker?.snapshot?.skills, attackSkill);
// Note: keyTechniqueBonus (martial arts technique bonuses) will be added in Story 5.5

// The attack roll uses only REF + skill (no key technique bonus):
const attackRequest = {
  formula: "1d10x10 + @stats.ref.total + @skill." + attackSkill,
  terms: ["1d10x10", "@stats.ref.total", "@skill." + attackSkill],
};
const attackRoll = normalizeMeleeRoll(roll(roller, attackRequest));
```

Currently all martial actions follow the same path: hit → damage. There is no action categorization.

Defender skill resolution (line 861-864):
```js
if (actionType === "martial") {
  const brawlingKey = Object.keys(targetSkills).find(k => k.toLowerCase() === "brawling");
  return brawlingKey || "Brawling";
}
```

`pendingDecisions` in martial outcomes is always `[]` (line 623).

The `resolveMeleeTargetOutcome` return shape includes `attack.roll`, `attack.opposedRoll`, `hits[]`, but no `keyTechniqueBonus` or action classification metadata.

### What This Story Changes

**File: `module/combat/attack-resolver.js`**

Change points are concentrated in **one function** (`resolveMeleeTargetOutcome`) and its surrounds.

#### 1. Add `MARTIAL_ACTION_CLASSIFICATIONS` constant

Define near the top of the file alongside `RANGED_MODIFIERS`:

```js
/**
 * Martial action classification.
 * Each entry maps a lowercase action key to its behavior category.
 * @type {Object<string, string>}
 */
const MARTIAL_ACTION_CLASSIFICATIONS = Object.freeze({
  strike:     "damageOnly",
  kick:       "damageOnly",
  dodge:      "nonDamage",
  blockparry: "nonDamage",
  disarm:      "nonDamage",
  sweeptrip:   "grappleFamily",
  grapple:     "grappleFamily",
  hold:        "grappleFamily",
  choke:       "grappleFamily",
  throw:       "grappleFamily",
  escape:      "grappleFamily",
});
```

#### 2. Add key technique bonus to attack roll

Inside `resolveMeleeTargetOutcome`, at the martial skill block (around line 661-669):

```js
if (context.action?.type === "martial") {
  attackSkill = context.action.options?.martialArt || "brawling";
  const meleeAction = context.action.meleeAction || "";
  const keyTechniqueBonus = getKeyTechniqueBonus(attackSkill, meleeAction);
  // keyTechniqueBonus is added to the total but NOT reflected in the roll formula —
  // it's a flat modifier applied AFTER the dice roll, like accuracy.
}
```

**How to apply:**
- Keep the roll formula unchanged
- Add `keyTechniqueBonus` to the to the `attackRoll.total` instead of modifying the formula
- OR include it in the roll data and formula if you prefer: `"1d10x10 + @stats.ref.total + @skill." + attackSkill + " + @keyTechniqueBonus"`

**Recommendation:** Apply as a separate additive step after `normalizeMeleeRoll` — simpler and avoids formula string complexity:

```js
// After normalizeMeleeRoll:
attackRoll.keyTechniqueBonus = keyTechniqueBonus;
attackRoll.total += keyTechniqueBonus;
```

Store `keyTechniqueBonus` on the roll object so the test assertions can verify it.

#### 3. Determine action category

```js
const meleeAction = String(context.action?.meleeAction || "").toLowerCase().trim();
const martialCategory = MARTIAL_ACTION_CLASSIFICATIONS[meleeAction] || "damageOnly";
```

#### 4. Skip damage for all non-damage categories

After the opposed result and hit determination, gate damage resolution:

```js
if (hit && martialCategory === "damageOnly") {
  // ... existing damage resolution (weapon die + strength bonus) ...
}
```

Only `damageOnly` actions (strike, kick) resolve weapon damage. For both `nonDamage` and `grappleFamily` the hits array remains **empty** — the opposed roll outcome IS the result.

#### 5. Add pending decisions for any action with prerequisites

Check prerequisites for ALL actions, not just grapple-family (e.g. Aikido disarm requires blockParry/dodge):

```js
const prereqs = getRequiresPrerequisite(attackSkill, meleeAction);
if (prereqs && prereqs.length > 0) {
  targetPendingDecisions.push({
    reason: "prerequisite-check",
    message: `${martialActionLabel} requires ${prereqs.join(" or ")} — verify prerequisite is active before applying this outcome.`,
    action: meleeAction,
    requires: prereqs
  });
}
```

Collect per-target `pendingDecisions` up to the root `CombatOutcome` in `resolveMeleeAction`:

```js
// In resolveMeleeAction, after resolving all targets:
const allPending = targets
  .filter(t => Array.isArray(t.pendingDecisions))
  .flatMap(t => t.pendingDecisions);

return {
  ...existingReturnShape,
  pendingDecisions: allPending
};
```

#### 6. Include martial category and key technique bonus in outcome

Must be set on BOTH the root action and the per-target attack:

```js
// Root action in resolveMeleeAction:
return {
  action: {
    ...action,
    martialCategory  // e.g. "damageOnly", "nonDamage", "grappleFamily"
  },
  ...
};

// Per-target in resolveMeleeTargetOutcome:
attack.keyTechniqueBonus = keyTechniqueBonus;
attack.martialCategory = martialCategory;
```

### Data Module Import

```js
import {
  getKeyTechniqueBonus,
  getRequiresPrerequisite,
  isTrainedMartial
} from "./martial-arts-data.js";
```

This is the **only** new import needed. `getKeyTechniqueBonus` normalizes inputs internally, so the raw `attackSkill` and `meleeAction` values can be passed directly.

### Defender Skill for Martial Actions

Keep using **Brawling** for all martial defender responses (current behavior). This is the corebook default: martial arts are opposed by the defender's best combat skill, but for MVP the defender always uses Brawling when the action type is martial. A future story could allow skill selection.

### Martial Action Source of Truth

The 11 action keys are defined in `module/combat/martial-arts-data.js` as `MARTIAL_ACTIONS`:

```js
["dodge", "blockParry", "strike", "kick", "disarm",
 "sweepTrip", "grapple", "hold", "choke", "throw", "escape"]
```

These same keys must be used in `MARTIAL_ACTION_CLASSIFICATIONS` — note that the classification keys must be **lowercase** to match the normalized `meleeAction` value after `.toLowerCase().trim()`.

### pendingDecisions Shape

`pendingDecisions` entries follow the existing pattern (see `combat-resolver.js` and `attack-resolver.js` for examples):

```js
{
  reason: "prerequisite-check",
  message: "Choke requires a successful Hold — verify Hold is active on the target before applying this outcome.",
  action: "choke",
  requires: ["hold"]
}
```

- `reason`: always `"prerequisite-check"` for this story
- `message`: human-readable, includes the required actions
- `action`: the meleeAction being checked
- `requires`: array of required prior actions (OR relationship)

---

## Impact Analysis

### Files to Modify

| File | Change | Risk |
|------|--------|------|
| `module/combat/attack-resolver.js` | Add key technique bonus, action classification, damage gating, prerequisite pending decisions | Medium — existing melee/martial flow must remain intact |
| `tests/combat/combat-fixtures.test.js` | May need update if existing `martial-action-shell` case needs structural adjustment | Low |
| `tests/combat/fixtures/melee-baseline.json` | Add new martial action fixture cases | Low (new cases only, existing cases untouched) |

### Files NOT Touched (Verified)

| File | Reason |
|------|--------|
| `module/combat/combat-resolver.js` | Routing unchanged — already dispatches to `resolveMeleeAction` |
| `module/combat/combat-outcome.js` | `CombatOutcome` shape stable |
| `module/combat/martial-arts-data.js` | Pure data module — imported, not modified |
| `module/combat/armor-resolver.js` | No armor changes for martial |
| `module/combat/damage-resolver.js` | No damage pipeline changes |
| `module/combat/save-resolver.js` | No save changes |
| `module/combat/state-planner.js` | No planning changes |
| `module/combat/combat-chat.js` | Chat rendering unchanged in this story |
| `module/lookups.js` | `martialActions` enum unchanged |
| `module/item/item.js` | Legacy `__martialBonk` unchanged |
| `module/actor/actor.js` | `trainedMartials()` unchanged |
| All other fixture/test files | Must pass unchanged |

### Localization Impact

None for this story. All action labels are derived from existing `martialActions` keys. UI strings for pending decisions are English-only for MVP (future story can localize).

---

## Testing Requirements

### Existing Fixture: `martial-action-shell`

The current `martial-action-shell` case in `melee-baseline.json` uses:
- `meleeAction: "Strike"` with no `martialArt` option set (defaults to `"brawling"`)
- Rolls to hit and expects `hits` array with damage entry

After this story, the same case must:
- Still hit and produce damage (strike is `damageOnly`)
- Include `keyTechniqueBonus: 0` in the attack roll output (Brawling has no bonuses)
- Have no `pendingDecisions` (strike has no prerequisites)
- Include `martialCategory: "damageOnly"`

The case's expected values **must be updated** to include these new fields. Forward-compatible assertion: use `"attack"` section assertions that accept new properties (existing fixture runner does deep partial matching on expected).

### New Fixture Cases

Add the following `singleShotCases` entries to `melee-baseline.json`:

| Case | Action | Category | Key Points |
|------|--------|----------|------------|
| `martial-strike-karate-bonus` | Strike with Karate | damageOnly | Key technique bonus +2 applied to attack total, damage resolved |
| `martial-kick-savate-bonus` | Kick with Savate | damageOnly | Key technique bonus +2 applied, damage resolved |
| `martial-block-parry` | Block/Parry with Boxing | nonDamage | Hit with no damage, `martialCategory: "nonDamage"`, `keyTechniqueBonus: 1` |
| `martial-dodge-capoeira` | Dodge with Capoeira | nonDamage | Hit with no damage, `keyTechniqueBonus: 1` |
| `martial-disarm-aikido` | Disarm with Aikido | nonDamage | Hit with no damage, `keyTechniqueBonus: 1`, `pendingDecisions` at root for Aikido disarm prereqs (blockParry/dodge) |
| `martial-grapple-karate` | Grapple with Karate | grappleFamily | Hit with no damage, `martialCategory: "grappleFamily"`, no pendingDecisions (no prereqs for grapple) |
| `martial-choke-requires-hold` | Choke with Brawling | grappleFamily | Hit with no damage, root `pendingDecisions` containing `reason: "prerequisite-check"`, `requires: ["hold"]` |
| `martial-escape-requires-grapple-hold` | Escape with Judo | grappleFamily | Hit with no damage, root `pendingDecisions` with `requires: ["grapple", "hold"]` |
| `martial-unknown-action-fallback` | Unknown action | damageOnly | Action not in MARTIAL_ACTIONS → fallback to damageOnly, keyTechniqueBonus 0 |

### Mandatory Verifications

```sh
# Run all existing fixtures — must pass with zero changes to other files
node tests/run-combat-fixtures.mjs

# Run martial arts data tests separately — must pass
node tests/combat/martial-arts-data.test.js
```

### What to Assert in New Fixtures

For each new martial case, at minimum:

| Field | Required | Notes |
|-------|----------|-------|
| `action.type` | `"martial"` | From context |
| `action.meleeAction` | Action key | e.g. `"Strike"`, `"Choke"` |
| `action.martialCategory` | Classification | `"damageOnly"`, `"nonDamage"`, `"grappleFamily"` — **new field on action** |
| `targets[0].attack.roll.total` | Expected total | Must include key technique bonus |
| `targets[0].attack.roll.keyTechniqueBonus` | Bonus value | 0, 1, or 2 |
| `targets[0].attack.hit` | true/false | |
| `targets[0].hits.length` | 0 for non-damage, 1+ for damage | |
| `pendingDecisions` | Array (root level) | Prerequisite warnings aggregated from all targets; `[]` if none |

---

## Implementation Order

1. Add `MARTIAL_ACTION_CLASSIFICATIONS` constant to `attack-resolver.js`
2. Import `getKeyTechniqueBonus` and `getRequiresPrerequisite` from `martial-arts-data.js`
3. In `resolveMeleeTargetOutcome`:
   a. Determine `martialCategory` from action key (normalized to lowercase)
   b. Compute `keyTechniqueBonus` and add to attack roll total
   c. Gate damage resolution: only `martialCategory === "damageOnly"` produces damage
   d. Build per-target `pendingDecisions` for any action with non-null prerequisites
   e. Include `keyTechniqueBonus` and `martialCategory` in target outcome
4. In `resolveMeleeAction`: collect per-target pendingDecisions into root `pendingDecisions`; set `action.martialCategory` from the first target
5. Update the `martial-action-shell` fixture case to expect new fields
6. Add new fixture cases for all action categories
7. Run `node tests/run-combat-fixtures.mjs` — all pass
8. Run `node tests/combat/martial-arts-data.test.js` — all pass
9. Update `_bmad-output/implementation-artifacts/sprint-status.yaml`

---

## Architecture Compliance

- **AD-1 (module/combat/)**: Modifies existing `attack-resolver.js` — core resolver module.
- **AD-2 (CombatOutcome)**: New fields on target outcome (`keyTechniqueBonus`, `martialCategory`, `pendingDecisions`) — additive, backward-compatible.
- **AD-3 (Pure Mechanics)**: No Foundry globals introduced. Data module import is pure JS.
- **AD-4 (Target Selection)**: Unchanged.
- **AD-6 (Planned Updates)**: No new update planning — damage dodge/block/parry actions produce no state changes.
- **AD-9 (Fixtures)**: New fixture cases for martial action categories.

---

## Project Context Reference

- **Data module:** `module/combat/martial-arts-data.js` — `getKeyTechniqueBonus`, `getRequiresPrerequisite`, `MARTIAL_ACTIONS`
- **Current martial routing:** `module/combat/attack-resolver.js:597-715` — `resolveMeleeAction` and `resolveMeleeTargetOutcome`
- **Key technique placeholder:** `module/combat/attack-resolver.js:669`
- **pendingDecisions empty:** `module/combat/attack-resolver.js:623`
- **Defender skill:** `module/combat/attack-resolver.js:861-864` — Brawling for martial
- **Fixture baseline:** `tests/combat/fixtures/melee-baseline.json` — `martial-action-shell` case
- **Epic context:** `_bmad-output/planning-artifacts/epics.md#Story 5.5`
- **FR-17 (martial action support):** `_bmad-output/planning-artifacts/prds/prd-Cyberpunk2020VTT-2026-05-24/prd.md` — 11 actions, distinct outcomes
- **FR-18 (key techniques):** `_bmad-output/planning-artifacts/prds/prd-Cyberpunk2020VTT-2026-05-24/prd.md` — bonuses from Style → Action table

---

## Previous Story Intelligence

### Story 5.4 — Martial Arts Data Module

- `martial-arts-data.js` is a pure data module with zero Foundry dependencies.
- All internal action keys are **lowercase** (the getter normalizes input to lowercase).
- Style keys are lowercase: `"brawling"`, `"karate"`, `"aikido"`, `"judo"`, `"boxing"`, etc.
- `getKeyTechniqueBonus(style, action)` — returns 0 for invalid/missing inputs. Case-insensitive, whitespace-trimming.
- `getRequiresPrerequisite(style, action)` — returns prerequisite array or null.
- **Important bugfix from review:** Data keys were originally camelCase but gotters normalize to lowercase. All data must use lowercase keys.
- Existing 8 fixture files must continue passing.

### Story 5.2 — Baseline Opposed Melee

- `resolveMeleeAction` produces CombatOutcome with opposed rolls per target.
- Melee fixture JSON pattern: `{ name, context, rolls, expected }` with `useStructured: true`.
- Tie and fumble cases already covered for melee.

### Story 5.3 — BT Damage Modifiers

- `btmFromBT` fixed for BT 13-14 (→ 6) and BT 15+ (→ 8).
- `strengthDamageBonus` from `module/lookups.js` provides BT-based strength bonus.

---

## Dev Agent Record

### Implementation Plan

1. Add `MARTIAL_ACTION_CLASSIFICATIONS` constant before `resolveMeleeAction`.
2. Import `getKeyTechniqueBonus`, `getRequiresPrerequisite` from `./martial-arts-data.js`.
3. In `resolveMeleeTargetOutcome`, after resolving `attackSkill` for martial:
   - Compute `keyTechniqueBonus = getKeyTechniqueBonus(attackSkill, meleeAction)`
   - Add to rolling total: `attackRoll.total += keyTechniqueBonus`; attach `attackRoll.keyTechniqueBonus = keyTechniqueBonus`
   - Determine `martialCategory` from `MARTIAL_ACTION_CLASSIFICATIONS[meleeAction]` with `"damageOnly"` fallback
4. Gate damage resolution: only `martialCategory === "damageOnly"` resolves damage hits; both `nonDamage` and `grappleFamily` produce empty hits array
5. Add `pendingDecisions` for any action with non-null prerequisites (no category filter)
6. In `resolveMeleeAction`: collect per-target pendingDecisions to root `pendingDecisions`; set `action.martialCategory`
7. Include `martialCategory` on per-target attack roll
8. Update existing `martial-action-shell` fixture to expect `keyTechniqueBonus: 0`, `martialCategory: "damageOnly"`
9. Add new fixture cases for each category

### Key Gotchas

- **Action keys are lowercase** in `MARTIAL_ACTIONS` and `MARTIAL_ACTION_CLASSIFICATIONS`. The `meleeAction` from context may be capitalized (`"Strike"`) — normalize to lowercase for the classification and data module lookups.
- **Key technique bonus is additive to total**, not part of the formula. Don't try to embed it in `attackRequest.formula`.
- **Existing fixture assertion pattern** uses deep partial matching. Adding new fields to target outcome is backward-compatible as long as existing expected values only specify the fields they care about.
- **Do not modify the defender skill resolution.** Leave Brawling as the martial defender default for MVP.

### Completion Notes

**Implemented:**
- Added `MARTIAL_ACTION_CLASSIFICATIONS` constant mapping all 11 martial actions to 3 categories (`damageOnly`, `nonDamage`, `grappleFamily`)
- Added import of `getKeyTechniqueBonus`, `getRequiresPrerequisite` from `martial-arts-data.js`
- Key technique bonus is computed from martial art style + action and added as `attackRoll.keyTechniqueBonus`, with `attackRoll.total` incremented accordingly
- Damage resolution is gated: only `damageOnly` category actions (strike, kick) produce damage hits; `nonDamage` and `grappleFamily` produce empty hits array
- Prerequisite pending decisions are generated for any action with prerequisites (via `getRequiresPrerequisite`), aggregated to root `pendingDecisions`
- Unknown/bogus actions fall back to `damageOnly` category with `keyTechniqueBonus: 0`
- `martialCategory` is included on both root `action` and per-target `attack.roll`
- Fixed existing `normalizeLocationRoll` to propagate `location` from roller (bugfix)

**Fixture changes:**
- Updated `martial-action-shell` to expect `keyTechniqueBonus: 0` and `martialCategory: "damageOnly"`
- Added 9 new martial action fixtures:
  - `martial-strike-karate-bonus` — strike with karate, +2 bonus, damage
  - `martial-kick-savate-bonus` — kick with savate, +2 bonus, damage
  - `martial-block-parry` — block/parry with boxing, +1 bonus, no damage
  - `martial-dodge-capoeira` — dodge with capoeira, +1 bonus, no damage
  - `martial-disarm-aikido` — disarm with aikido, +1 bonus, no damage, prerequisite pending
  - `martial-grapple-karate` — grapple with karate, 0 bonus, no damage, no prereq
  - `martial-choke-requires-hold` — choke with brawling, 0 bonus, no damage, hold prerequisite
  - `martial-escape-requires-grapple-hold` — escape with judo, +1 bonus, no damage, grapple/hold prerequisite
  - `martial-unknown-action-fallback` — unknown action, 0 bonus, damageOnly fallback, damage resolved

**Tests:** All 9 combat fixture suites pass (0 regressions). All martial arts data tests pass.

---

## Change Log

| Date | Change |
|------|--------|
| 2026-05-29 | Initial story specification created |
| 2026-05-29 | Implemented key technique bonus, action classification, damage gating, prerequisite pending decisions, unknown action fallback, new fixture cases (AC 1-5 all satisfied) |

---

## File List

| Action | File |
|--------|------|
| MODIFY | `module/combat/attack-resolver.js` |
| MODIFY | `tests/combat/fixtures/melee-baseline.json` |
| MODIFY | `_bmad-output/implementation-artifacts/sprint-status.yaml` |