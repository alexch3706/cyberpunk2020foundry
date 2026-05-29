---
baseline_commit: 293e46536845a511ce06874731dbaec9f1dd63c1
---

# Story 5.4: Add Martial Arts Data Module

**Status**: done

## Story

As a maintainer,
I want martial arts styles and key techniques represented as inspectable data,
So that martial bonuses are not hard-coded or silently zero.

**Requirements:** FR18, FR21
**Epic 5:** Opposed Melee and Martial Arts
**Dependencies:** Story 5.1, 5.2, 5.3 (melee baseline, BTM modifiers) — all done
**Consumed by:** Story 5.5 (resolve martial actions with technique bonuses)

---

## Summary

Create `module/combat/martial-arts-data.js` — a pure data module defining all CP2020 corebook martial arts styles, their key technique bonuses, and action prerequisites. This module is **pure data with no Foundry dependencies** — testable outside a live game session.

Story 5.5 will consume this data to compute `keyTechniqueBonus` in `attack-resolver.js`. This story is data only: no resolver logic changes.

---

## Acceptance Criteria

1. **Given** a martial style name and action name
   **When** `getKeyTechniqueBonus(style, action)` is called
   **Then** it handles inputs case-insensitively (normalizes and trims case/whitespace)
   **And** it returns the correct corebook bonus for that style and action
   **And** invalid, unknown, or nonexistent style/action combinations return 0 defensively.

2. **Given** the martial arts data module
   **When** `MARTIAL_STYLES` is inspected
   **Then** it contains all 11 corebook styles plus Brawling
   **And** each style has a `name`, `displayKey`, `keyTechniques` map, and `requiresPrerequisite` map.

3. **Given** Brawling
   **When** its key techniques are examined
   **Then** ALL actions return bonus 0
   **And** `isTrainedMartial("Brawling")` returns `false`.

4. **Given** any trained martial art (e.g., Karate, Judo, Aikido)
   **When** `isTrainedMartial(style)` is called
   **Then** it handles inputs case-insensitively
   **And** it returns `true` for all non-Brawling styles
   **And** any invalid/nonexistent style returns `false`.

5. **Given** `getRequiresPrerequisite(style, action)`
   **When** called for any style and action
   **Then** it handles inputs case-insensitively
   **And** it returns the generic prerequisites for all styles (including Brawling and any trained martial arts):
     - `choke` always returns `["hold"]`
     - `escape` always returns `["grapple", "hold"]` (representing that either hold or grapple satisfies the prerequisite)
   **And** it returns the style-specific prerequisites from `requiresPrerequisite` when they exist (e.g. Aikido throw returns `["grapple", "blockParry", "dodge"]`)
   **And** it returns `null` if no prerequisite exists, or for invalid/nonexistent inputs.

6. **Given** the `MARTIAL_STYLES` dictionary
   **When** the module is loaded
   **Then** the object and its nested style definitions are frozen (e.g., via `Object.freeze` or deep freeze) to prevent accidental runtime mutations.

7. **Given** the module exports
   **When** imported by tests
   **Then** all exported functions can be called deterministically without a Foundry runtime
   **And** the array `MARTIAL_ACTIONS` is exported as the single source of truth for supported action keys
   **And** a test file `tests/combat/martial-arts-data.test.js` exercises every style's technique bonuses, generic/specific prerequisites, case-insensitivity, freezing, and error/defensive lookup boundaries.

8. **Given** the existing fixture and assertion suite
   **When** the new module is added
   **Then** all existing tests continue to pass (no runtime code was changed).

---

## Tasks / Subtasks

- [x] #1: Create `module/combat/martial-arts-data.js` with corebook data (AC: 1–5)
- [x] #2: Create `tests/combat/martial-arts-data.test.js` with full coverage (AC: 6)
- [x] #3: Verify all existing fixtures still pass (AC: 7)
- [x] #4: Update sprint status

### Review Findings

- [x] [Review][Patch] Action Key Casing Deviation [module/combat/martial-arts-data.js:16]
- [x] [Review][Patch] Untrained Style names matching Object prototype properties (e.g. toString) [module/combat/martial-arts-data.js:263]
- [x] [Review][Patch] Test suite structure prevents programmatic re-run and integration [tests/combat/martial-arts-data.test.js:1]
- [x] [Review][Patch] Missing trailing newlines in new files [module/combat/martial-arts-data.js:287]

---

## Developer Context

### Current State

The martial arts skill system in the project works like this:

- **Skill items**: Actors own skill items named `"Martial Arts: {Style}"` (e.g., `"Martial Arts: Karate"`). The legacy `trainedMartials()` method in `module/actor/actor.js:198` filters skill items starting with `"Martial"` where `level > 0`.
- **`module/lookups.js`**: Contains `martialActions` enum (all 11 actions) and `martialOptions()` for the modifiers dialog. Attack skills dictionary maps `"Melee"` → `["Fencing", "Melee", "Brawling"]`.
- **`module/combat/attack-resolver.js:661-669`**: Martial resolution picks `attackSkill = context.action.options?.martialArt || "brawling"`. The key technique bonus is explicitly a placeholder:
  ```js
  // Note: keyTechniqueBonus (martial arts technique bonuses) will be added in Story 5.5
  ```
- **`module/item/item.js:526-529`**: Legacy `__martialBonk` has a commented-out lookup:
  ```js
  // Will be something this line once I add the martial arts bonuses. None for brawling, remember
  // let martialBonus = this.actor?.skills.MartialArts[martialArt].bonuses[action];
  let keyTechniqueBonus = 0;
  ```
- **`module/combat/attack-resolver.js:861-864`**: Defender always uses Brawling for martial actions (opposed roll).

### What This Module Provides

The data module sits between `lookups.js` (system-wide enum of action names) and `attack-resolver.js` (runtime lookup). It is:

- A flat data dictionary of all martial art styles
- Per-style key technique bonus tables (action → bonus)
- Per-style prerequisite tables (action → prior action required)
- Helper functions for runtime access

### Architecture Compliance (AD-1, section 4.9)

From architecture.md section 4.9:

> **`martial-arts-data.js`** Responsibilities:
> - Define corebook martial styles and key technique bonuses as inspectable data.
> - Distinguish Brawling from trained martial arts.
> - Support action prerequisite checks for grapple, hold, choke, throw, escape, block/parry, dodge, disarm, and sweep/trip.

This is a **pure data module** — no document API calls, no Foundry globals. It must be require-able in tests without a live game session.

### Corebook Reference: Key Technique Bonuses

| Style | Strike | Kick | Block/Parry | Dodge | Disarm | Sweep/Trip | Grapple | Hold | Choke | Throw | Escape |
|-------|--------|------|-------------|-------|--------|------------|---------|------|-------|-------|--------|
| Brawling | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Aikido | +1 | — | +0 | — | +1 | — | — | +1 | — | +1 | — |
| Animal Kung Fu | +1 | +1 | +0 | +1 | — | — | +1 | — | — | — | — |
| Boxing | +2 | — | +1 | +0 | — | — | — | — | — | — | — |
| Capoeira | +0 | +2 | — | +1 | — | +1 | — | — | — | — | — |
| Choi Li Fut | +2 | +0 | +1 | — | — | — | +1 | — | — | — | — |
| Judo | +0 | — | — | — | +1 | — | — | +1 | — | +2 | +1 |
| Karate | +2 | +1 | +1 | +0 | — | — | — | — | — | — | — |
| Savate | +1 | +2 | +0 | +1 | — | — | — | — | — | — | — |
| Tae Kwon Do | +2 | +2 | +0 | — | — | — | — | — | — | — | — |
| Thai Kickboxing | +1 | +2 | +0 | — | — | — | +1 | — | — | — | — |
| Wrestling | +0 | — | — | — | — | — | +2 | +1 | — | — | +1 |

**Key:**
- `—` = Not a key technique for this style (bonus does not apply; the action can still be declared but gets +0).
- `+N` = Bonus added to the opposed roll when performing this action with this style.
- `+0` = Explicit zero — the action IS a key technique but gives no numerical advantage.

### Corebook Reference: Prerequisite Actions

Some actions in certain styles require prior successful actions:

| Style | Action | Requires |
|-------|--------|----------|
| Aikido | Throw | Successful Grapple or Block/Parry or Dodge |
| Aikido | Disarm | Successful Block/Parry or Dodge |
| Aikido | Hold | Successful Grapple or Block/Parry or Dodge |
| Judo | Throw | Successful Grapple |
| Judo | Hold | Successful Grapple |
| Wrestling | Hold | Successful Grapple |
| (general) | Choke | Hold active |
| (general) | Escape | Hold or Grapple active (defender action) |

The "general" prerequisites (Choke requires Hold, Escape requires Grapple/Hold) apply to ALL styles that have those as key techniques. Represent them as generic prerequisites rather than style-specific.

### Module Structure

```js
// module/combat/martial-arts-data.js

/**
 * List of all supported martial/brawling action keys.
 * @type {string[]}
 */
export const MARTIAL_ACTIONS = [...];

/**
 * @typedef {Object} MartialStyleDef
 * @property {string} name        Standard name of the martial art
 * @property {string} displayKey  Foundry localization key (e.g. CYBERPUNK.SkillMartial Arts:{name})
 * @property {Object<string,number>} keyTechniques  Action → bonus map.
 * @property {Object<string,string[]>} requiresPrerequisite  Action → [prior actions] map. 
 *                                     Note: The array elements represent an "OR" relationship (any one satisfies).
 */

/** 
 * Map of all martial styles by lowercase key.
 * This object and all nested style definitions are deeply frozen.
 * @type {Object<string, MartialStyleDef>}
 */
export const MARTIAL_STYLES = { ... };

/** 
 * Get key technique bonus for a style + action. 
 * Normalizes inputs to lowercase and trims whitespace.
 * Returns 0 if not a key technique, or if style/action is invalid.
 */
export function getKeyTechniqueBonus(style, action) { ... }

/** 
 * Returns true if the style is a trained martial art (not Brawling).
 * Normalizes inputs to lowercase and trims whitespace.
 * Returns false if style is invalid.
 */
export function isTrainedMartial(style) { ... }

/** 
 * Get prerequisite actions for a style + action. 
 * Normalizes inputs to lowercase and trims whitespace.
 * Merges general rules (Choke requires Hold, Escape requires Grapple/Hold) 
 * with style-specific ones. Returns null if none, or if invalid.
 */
export function getRequiresPrerequisite(style, action) { ... }

/** List all martial style names (lowercase keys). */
export function getMartialStyleNames() { ... }
```

### Localization Keys

Existing localization keys in `lang/en.json` for martial skill names:
- `CYBERPUNK.SkillMartial Arts: Aikido` → "Aikido"
- `CYBERPUNK.SkillMartial Arts: AnimalKungFu` → "Animal Kung Fu"
- `CYBERPUNK.SkillMartial Arts: Boxing` → "Boxing"
- `CYBERPUNK.SkillMartial Arts: Capoeira` → "Capoeira"
- `CYBERPUNK.SkillMartial Arts: ChoiLiFut` → "Choi Li Fut"
- `CYBERPUNK.SkillMartial Arts: Judo` → "Judo"
- `CYBERPUNK.SkillMartial Arts: Karate` → "Karate"
- `CYBERPUNK.SkillMartial Arts: Savate` → "Savate"
- `CYBERPUNK.SkillMartial Arts: TaeKwonDo` → "Tae Kwon Do"
- `CYBERPUNK.SkillMartial Arts: ThaiKickBoxing` → "Thai Kickboxing"
- `CYBERPUNK.SkillMartial Arts: Wrestling` → "Wrestling"
- `CYBERPUNK.SkillBrawling` → "Brawling"

The `displayKey` in each style definition should use the existing localization key format so the module can be used by localization-aware code without hardcoding display names.

### `action` Key Reference

The action keys in the data module must match the values in `module/lookups.js` `martialActions` (case-insensitive lookup is handled by the consumer):

| martialActions key | Action key for data module |
|--------------------|---------------------------|
| `dodge` | `"dodge"` |
| `blockParry` | `"blockParry"` |
| `strike` | `"strike"` |
| `kick` | `"kick"` |
| `disarm` | `"disarm"` |
| `sweepTrip` | `"sweepTrip"` |
| `grapple` | `"grapple"` |
| `hold` | `"hold"` |
| `choke` | `"choke"` |
| `throw` | `"throw"` |
| `escape` | `"escape"` |

### Existing Skills & Pattern Alignment

The actor skill items use `name` matching `"Martial Arts: {style}"`. The resolver's `attack-resolver.js:662` picks `context.action.options?.martialArt` which is the value from the modifiers dialog — which comes from `trainedMartials()` (actor skill names like `"Martial Arts: Karate"`) or `"Brawling"`.

The data module's style keys should be lowercase, consistent with how `attack-resolver.js:662` lowercases the martial art selection:
```js
attackSkill = context.action.options?.martialArt || "brawling";
```

Therefore style keys: `"brawling"`, `"aikido"`, `"animalkungfu"`, `"boxing"`, `"capoeira"`, `"choilifut"`, `"judo"`, `"karate"`, `"savate"`, `"taekwondo"`, `"thaikickboxing"`, `"wrestling"`.

### Data Module Skeleton

```js
export const MARTIAL_ACTIONS = ["dodge", "blockParry", "strike", "kick", "disarm",
  "sweepTrip", "grapple", "hold", "choke", "throw", "escape"];

const rawStyles = {
  brawling: {
    name: "Brawling",
    displayKey: "CYBERPUNK.SkillBrawling",
    keyTechniques: {
      dodge: 0, blockParry: 0, strike: 0, kick: 0, disarm: 0,
      sweepTrip: 0, grapple: 0, hold: 0, choke: 0, throw: 0, escape: 0
    },
    requiresPrerequisite: {} // generic prerequisites handled dynamically in getter helper
  },
  aikido: {
    name: "Aikido",
    displayKey: "CYBERPUNK.SkillMartial Arts: Aikido",
    keyTechniques: {
      strike: 1, disarm: 1, hold: 1, throw: 1, blockParry: 0
    },
    requiresPrerequisite: {
      throw: ["grapple", "blockParry", "dodge"],
      disarm: ["blockParry", "dodge"],
      hold: ["grapple", "blockParry", "dodge"]
    }
  },
  // ... all other 10 corebook styles follow same pattern ...
};

// Deep freeze helper to prevent accidental runtime mutations
function deepFreeze(obj) {
  Object.freeze(obj);
  Object.keys(obj).forEach(key => {
    if (typeof obj[key] === "object" && obj[key] !== null && !Object.isFrozen(obj[key])) {
      deepFreeze(obj[key]);
    }
  });
  return obj;
}

export const MARTIAL_STYLES = deepFreeze(rawStyles);

// Safe, case-insensitive getters with default fallbacks
export function getKeyTechniqueBonus(style, action) {
  const s = String(style || "").toLowerCase().trim();
  const a = String(action || "").toLowerCase().trim();
  return MARTIAL_STYLES[s]?.keyTechniques?.[a] ?? 0;
}

export function isTrainedMartial(style) {
  const s = String(style || "").toLowerCase().trim();
  if (!MARTIAL_STYLES[s]) return false;
  return s !== "brawling";
}

export function getRequiresPrerequisite(style, action) {
  const s = String(style || "").toLowerCase().trim();
  const a = String(action || "").toLowerCase().trim();

  if (!MARTIAL_STYLES[s] || !MARTIAL_ACTIONS.includes(a)) {
    return null;
  }

  // 1. Enforce generic/general rules that apply to all styles (including Brawling)
  if (a === "choke") {
    return ["hold"];
  }
  if (a === "escape") {
    return ["grapple", "hold"];
  }

  // 2. Fall back to style-specific prerequisites
  return MARTIAL_STYLES[s].requiresPrerequisite?.[a] ?? null;
}

export function getMartialStyleNames() {
  return Object.keys(MARTIAL_STYLES);
}
```

---

## Impact Analysis

### Files to Create

| File | Description |
|------|-------------|
| `module/combat/martial-arts-data.js` | **NEW** — Pure data module with all martial arts styles, key techniques, and prerequisites |

### Files to Modify

| File | Change | Risk |
|------|--------|------|
| `tests/combat/martial-arts-data.test.js` | **NEW** — Full coverage for every style's technique bonuses and prerequisites | None (new file) |

### Files NOT Touched

- `module/combat/attack-resolver.js` — keyTechniqueBonus stays 0 (Story 5.5 consumes this data)
- `module/combat/combat-resolver.js` — routing unchanged
- `module/lookups.js` — `martialActions` enum unchanged
- `module/item/item.js` — legacy `__martialBonk` unchanged
- `module/actor/actor.js` — `trainedMartials()` unchanged
- Any existing fixture or test files — all must continue passing unchanged

### Localization Impact

No localization changes needed. The module reuses existing `CYBERPUNK.SkillMartial Arts: {Style}` and `CYBERPUNK.SkillBrawling` keys via `displayKey` strings.

Any new localization strings (e.g., technique names in chat) belong in Story 5.5.

---

## Testing Requirements

### `tests/combat/martial-arts-data.test.js`

Import and run via `tests/run-combat-fixtures.mjs` by adding the file URL to the import chain, **or** run as a standalone script with `node tests/combat/martial-arts-data.test.js`.

**Required assertions:**

| Assertion Group | What to Verify |
|----------------|----------------|
| **All styles present** | `MARTIAL_STYLES` has exactly 12 keys: brawling, aikido, animalkungfu, boxing, capoeira, choilifut, judo, karate, savate, taekwondo, thaikickboxing, wrestling |
| **Brawling all zero** | Every action for Brawling returns bonus 0 |
| **Brawling is not trained** | `isTrainedMartial("brawling")` → false |
| **All trained styles** | Every non-brawling style returns true for `isTrainedMartial` |
| **Key technique precision** | Every style's documented +2/+1/+0 bonuses match the corebook table |
| **Non-key techniques return 0** | Actions marked `—` in the table return 0, not undefined |
| **Generic prerequisites** | `getRequiresPrerequisite("brawling", "choke")` → `["hold"]`; `getRequiresPrerequisite("karate", "choke")` → `["hold"]`; any style's `escape` → `["grapple", "hold"]` |
| **Specific prerequisites** | Aikido throw → `["grapple", "blockParry", "dodge"]`; Judo throw → `["grapple"]`; Wrestling hold → `["grapple"]` |
| **Data integrity and frozen state** | `Object.isFrozen(MARTIAL_STYLES)` is `true`, and all nested objects are frozen |
| **Exported Actions array** | `MARTIAL_ACTIONS` matches the 11 supported action keys |
| **Getter functions** | `getKeyTechniqueBonus("karate", "strike")` → 2; `getKeyTechniqueBonus("brawling", "strike")` → 0 |
| **Case insensitivity** | `getKeyTechniqueBonus("  KaRaTe  ", "  sTrIkE  ")` returns 2; `getRequiresPrerequisite("  AiKiDo  ", "  ThRoW  ")` matches; inputs are normalized and trimmed |
| **Invalid style** | `getKeyTechniqueBonus("nonexistent", "strike")` → 0; `getRequiresPrerequisite("nonexistent", "strike")` → null; `isTrainedMartial("nonexistent")` → false |
| **Invalid action** | `getKeyTechniqueBonus("karate", "nonexistent")` → 0; `getRequiresPrerequisite("karate", "nonexistent")` → null |

### Verifying No Regressions

```sh
node tests/run-combat-fixtures.mjs
```

All existing 7 fixture files (ranged, burst, full auto, suppressive, reliability/jam, unsupported, melee) must pass unchanged. No resolver code was touched, so regression risk is zero.

---

## Implementation Order

1. Create `module/combat/martial-arts-data.js` (pure data, no imports from Foundry)
2. Create `tests/combat/martial-arts-data.test.js` (full coverage)
3. Run `node tests/run-combat-fixtures.mjs` — all pass
4. Optionally run `node tests/combat/martial-arts-data.test.js` for martial-only check
5. Update `_bmad-output/implementation-artifacts/sprint-status.yaml`

---

## File List

| Action | File |
|--------|------|
| CREATE | `module/combat/martial-arts-data.js` |
| CREATE | `tests/combat/martial-arts-data.test.js` |
| MODIFY | `_bmad-output/implementation-artifacts/sprint-status.yaml` |

---

## Project Context Reference

- **Source:** `module/lookups.js:105-118` — `martialActions` enum with all 11 action keys
- **Source:** `module/combat/attack-resolver.js:598-670` — `resolveMeleeAction` and martial routing; `keyTechniqueBonus` placeholder at line 669
- **Source:** `module/combat/attack-resolver.js:861-866` — Defender always uses Brawling for martial actions
- **Source:** `module/item/item.js:519-560` — Legacy `__martialBonk` with commented-out data structure reference
- **Source:** `module/actor/actor.js:198-206` — `trainedMartials()` skill filter
- **Source:** `lang/en.json:127-138` — Martial art localization keys
- **Source:** `_bmad-output/planning-artifacts/architecture.md#4.9` — Martial arts data module responsibilities
- **Source:** `_bmad-output/planning-artifacts/epics.md#Story 5.4` — Epic-level story requirements
- **Source:** `_bmad-output/planning-artifacts/prds/prd-Cyberpunk2020VTT-2026-05-24/prd.md:246-256` — FR-18 requirements

---

## Previous Story Intelligence

### Story 5.3 — BT Damage Modifiers

- `btmFromBT` was fixed in `module/lookups.js` (BT 13–14 → 6, BT 15+ → 8)
- All 8 fixture files pass with corrections verified
- No existing fixture uses target BT > 10 (regression-safe)
- Test pattern: use `assertBodyTypeDamageResolver` for unit-functions and `runFixture()` with `singleShotCases` for integration

### Story 5.2 — Baseline Opposed Melee

- `resolveMeleeAction` produces CombatOutcome with opposed rolls per target
- Defender skill resolution is case-insensitive; martial defender always uses Brawling
- Melee fixture JSON pattern established: `{ name, context, rolls, expected }` with `useStructured: true`

---

## Architecture Compliance

- **AD-1 (module/combat/)**: New file in the resolver directory — exactly what was planned
- **AD-2 (CombatOutcome)**: Data module is consumed *by* resolver later; no outcome shape change now
- **AD-3 (Pure Mechanics)**: `martial-arts-data.js` is a pure data module with zero Foundry dependencies
- **AD-4 (Target Selection)**: Unchanged
- **AD-7 (Armor at Resolution Time)**: Unchanged
- **AD-9 (Fixtures)**: New test file for martial arts data coverage (independent of fixure-based resolver tests)

---

## Dev Agent Record

### Implementation Plan

1. Create `module/combat/martial-arts-data.js` with all 12 corebook martial styles (brawling + 11 trained), their key technique bonuses per CP2020 corebook, action prerequisite maps (generic + style-specific), and deep-freeze immutability.
2. Create `tests/combat/martial-arts-data.test.js` exercising every style's technique bonuses, generic/specific prerequisites, case-insensitivity, deep-freeze integrity, defensive zero/null boundaries, and export shape.
3. Verify all 8 existing fixture tests pass unchanged (no runtime code was modified).

### Completion Notes

- **Task #1**: Created `module/combat/martial-arts-data.js` — pure data module with zero Foundry dependencies. Contains:
  - `MARTIAL_ACTIONS` (11 lowercase action keys) and `MARTIAL_STYLES` (deep-frozen map of all 12 styles)
  - All corebook key technique bonuses (±0/±1/±2 per style×action matrix, total ~50 data points)
  - All style-specific prerequisites (Aikido, Judo, Wrestling) plus generic rules (Choke→Hold, Escape→Grapple/Hold)
  - Case-insensitive, whitespace-trimming getter functions: `getKeyTechniqueBonus`, `isTrainedMartial`, `getRequiresPrerequisite`, `getMartialStyleNames`

- **Task #2**: Created `tests/combat/martial-arts-data.test.js` with full coverage:
  - All 12 styles verified present with correct name, displayKey, keyTechniques, requiresPrerequisite
  - Every documented bonus value asserted (all styles, all key techniques)
  - Non-key techniques return 0 (not undefined)
  - Brawling all-zero and `isTrainedMartial(false)` verified
  - All non-Brawling styles return true for `isTrainedMartial`
  - Case-insensitivity with trimmed whitespace (e.g. getKeyTechniqueBonus("  KaRaTe  ", "  sTrIkE  ") → 2)
  - Invalid style/action returns 0 (bonus) or null (prerequisites)
  - Generic prerequisites (Choke→Hold, Escape→Grapple/Hold) across all styles
  - Style-specific prerequisites (Aikido, Judo, Wrestling) verified
  - Deep-frozen MARTIAL_STYLES + all nested objects verified frozen
  - MARTIAL_ACTIONS export matches exactly 11 action keys
  - displayKey alignment with existing localization keys verified

- **Task #3**: Ran `node tests/run-combat-fixtures.mjs` — all 8 fixture tests pass without regressions

- **Task #4**: Updated sprint status from `ready-for-dev` to `in-progress` then to `review`; story file status updated

### Debug Log

- Initial test run failed: `getKeyTechniqueBonus("karate", "blockParry")` returned 0 instead of 1.
  - Root cause: data keys used camelCase (`blockParry`, `sweepTrip`) but `getKeyTechniqueBonus` lowercases input to `blockparry`, `sweeptrip`.
  - Fix: Changed all internal action keys in the data module to lowercase — consistent with how the getter normalizes consumer input.
  - Lesson: All internal keys in the data module must be lowercase because getters normalize consumer inputs to lowercase. Tests must use lowercase action keys for direct assertions.

## Change Log

| Date | Change |
|------|--------|
| 2026-05-29 | Initial story specification created |
| 2026-05-29 | Implemented — created martial-arts-data.js and test file, all ACs satisfied, 8 existing fixtures pass |

## Status

**Status**: review
**Generated by**: Vesper (Story Context Engine)
**Date**: 2026-05-29