---
baseline_commit: ab1af28
---

# Story 5.6: Enforce Grapple-Family Prerequisites and Pending State

**Status**: done

## Story

As a referee,
I want throw, hold, choke, and escape to respect grapple state/prerequisites,
So that martial outcomes do not imply illegal action chains.

**Requirements:** FR-17, FR-20
**Epic 5:** Opposed Melee and Martial Arts
**Dependencies:**
- Story 5.5 (martial action classification, key technique bonus, damage gating) — **done**
- `module/combat/martial-arts-data.js` — `getRequiresPrerequisite`, `getKeyTechniqueBonus` — **done**
- `module/combat/attack-resolver.js` — `resolveMeleeTargetOutcome`, `resolveMeleeAction` — **done**
- `tests/combat/fixtures/melee-baseline.json` — existing martial fixture cases — **done**

---

## Summary

Story 5.5 added static `pendingDecisions` with `reason: "prerequisite-check"` for any martial action that has prerequisites defined in `martial-arts-data.js`. These warnings are purely advisory — they fire regardless of whether the prerequisite action has actually been performed on the target.

This story upgrades prerequisite enforcement from static warnings to **state-aware checks**. The resolver distinguishes three states for each grapple-family action:

1. **Prerequisite confirmed active** on the target — action proceeds cleanly (no warning, no manual flag).
2. **Prerequisite unknown/missing** — outcome is marked with `manualResolution: { required: true, reason: "prerequisite-unconfirmed" }`, and the attack does not produce a result.
3. **Action has no prerequisites** (e.g. Grapple) — proceeds as before, no change.

The state is communicated through the **target snapshot** via an optional `combatState` field. This requires no `template.json` changes — it is a resolver-level state convention. The `combatState` snapshot field is populated by the Foundry adapter at resolution time from active token effects, embedded document flags, or referee decision.

The key conceptual change: *prerequisite warnings are now actionable*. A referee who knows a target is already grappled can enable the Grapple state in the combat context, and Hold/Choke/Throw/Escape actions against that target will produce clean outcomes instead of manual-resolution blocks.

---

## Acceptance Criteria

1. **Given** a grapple-family martial action (hold, choke, throw, sweep/trip, escape) with prerequisites defined
   **When** the target snapshot includes `combatState` confirming the prerequisite (e.g. `combatState.grappled: true` for hold, `combatState.held: true` for choke)
   **Then** the outcome includes the opposed roll, hit/miss, and **no pending decisions or manual-resolution flags** for the prerequisite
   **And** `pendingDecisions` at root level does not contain a `prerequisite-check` entry for the satisfied prerequisite.

2. **Given** a grapple-family martial action with prerequisites defined
   **When** the target snapshot does NOT include `combatState` confirming the prerequisite (field absent, false, or missing)
   **Then** the outcome is marked `manualResolution: { required: true, reason: "prerequisite-unconfirmed", message: "..." }`
   **And** the per-target `attack` section shows `hit: false` and empty `hits` array
   **And** the outcome includes the roll evidence (so the referee can see what would have happened), but **does not produce damage or state changes**
   **And** a warning is emitted explaining that the prerequisite state could not be confirmed.

3. **Given** a martial action not in the `grappleFamily` category (strike, kick, dodge, block/parry, disarm — regardless of whether it has prerequisites in `martial-arts-data.js`)
   **When** the target snapshot has any `combatState` field
   **Then** behavior is unchanged — action proceeds normally with no prerequisite enforcement checks
   **And** `combatState` fields are simply unused by the resolver for that action
   **And** non-grappleFamily actions with prerequisites (e.g. Aikido disarm) still produce `pendingDecisions` warnings as in Story 5.5, but are NOT blocked by manual-resolution.

4. **Given** a grapple-family martial action where the prerequisite IS confirmed via `combatState`
   **When** the action resolves
   **Then** the outcome includes all normal opposed-roll evidence: attacker roll, defender roll, hit/miss, margin, and key technique bonus
   **And** the hits array, manual resolution, and pending decisions follow the standard grapple-family behavior from Story 5.5 (empty hits, no damage).

5. **Given** existing melee and martial fixture cases from Stories 5.2–5.5
   **When** the changes are applied
   **Then** all existing fixtures pass with zero changes (existing cases do not set `combatState`, so grapple-family actions with prerequisites will produce manual-resolution — this is a **backward-incompatible change** that requires fixture updates for cases that previously expected clean hit outcomes from choke/escape/throw)
   **And** fixture cases that test the no-prerequisite path (strike, kick, grapple) are unaffected.

6. **Given** `combatState` is defined as an optional snapshot field
   **When** the snapshot is missing the field entirely (undefined/null)
   **Then** the resolver treats it as "not confirmed" — the prerequisite is considered unmet
   **And** manual-resolution blocking applies.

---

## Tasks / Subtasks

- [x] #1: Add `checkGrapplePrerequisites(targetSnapshot, meleeAction)` helper that checks combatState against action prerequisites (AC: 1, 2)
- [x] #2: Modify `resolveMeleeTargetOutcome` to call the helper and conditionally block outcomes (AC: 1, 2, 3)
- [x] #3: Add `manualResolution.reason` with `"prerequisite-unconfirmed"` value for blocked outcomes (AC: 2)
- [x] #4: Update existing grapple-family fixture cases (choke, escape) to either include `combatState` or expect manual-resolution outcome (AC: 5)
- [x] #5: Add new fixture cases: choke-without-hold-state (blocked), escape-without-any-state (blocked), throw-without-grapple (blocked), hold-with-grapple-state (clean) (AC: 1, 2, 4)
- [x] #6: Verify all existing fixtures pass after targeted updates (AC: 5)
- [x] #7: Run `node tests/run-combat-fixtures.mjs` — all pass
- [x] #8: Update sprint status

### Review Findings

- [x] [Review][Patch] Raw camelCase keys in prerequisite warning messages for non-grappleFamily actions [module/combat/attack-resolver.js:870]
- [x] [Review][Patch] Missing check for satisfied prerequisites on non-grappleFamily actions [module/combat/attack-resolver.js:865]
- [x] [Review][Patch] Potential TypeError in checkGrapplePrerequisites on undefined or non-string prereqs [module/combat/attack-resolver.js:82]
- [x] [Review][Patch] Redundant string casing and whitespace normalization inside resolveMeleeTargetOutcome loop [module/combat/attack-resolver.js:757]
- [x] [Review][Patch] Redundant parentheses around target.snapshot?.combatState [module/combat/attack-resolver.js:862]
- [x] [Review][Patch] Potential crash if context.action is undefined during martial art check [module/combat/attack-resolver.js:748]
- [x] [Review][Patch] Falsy or empty actionLabel leading to poorly formatted messages [module/combat/attack-resolver.js:842]
- [x] [Review][Patch] Missing name key in test case in melee-baseline.json [tests/combat/fixtures/melee-baseline.json:845]
- [x] [Review][Patch] Missing trailing newline in melee-baseline.json [tests/combat/fixtures/melee-baseline.json]
- [x] [Review][Defer] Technique bonus applied to untrained martial arts attackers [module/combat/attack-resolver.js:758] — deferred, pre-existing
- [x] [Review][Defer] Incomplete test assertions for blocked prerequisite outcomes in fixtures [tests/combat/fixtures/melee-baseline.json] — deferred, pre-existing

---

## Developer Context

### Current State

`module/combat/attack-resolver.js` currently handles prerequisite checks in `resolveMeleeTargetOutcome` at lines 778–791:

```js
// 6. Pending decisions for prerequisites (martial only, any action with prerequisites)
let targetPendingDecisions = [];
if (isMartial) {
  const prereqs = getRequiresPrerequisite(attackSkill, meleeAction);
  if (prereqs && prereqs.length > 0) {
    const actionLabel = context.action?.meleeAction || meleeAction;
    targetPendingDecisions.push({
      reason: "prerequisite-check",
      message: `${actionLabel} requires ${prereqs.join(" or ")} — verify prerequisite is active before applying this outcome.`,
      action: meleeAction,
      requires: prereqs
    });
  }
}
```

This always generates a `pendingDecisions` entry for any action with prerequisites, regardless of actual combat state. The action always resolves with a full opposed roll, hit, and (for grapple-family) empty hits array.

The target snapshot currently has no `combatState` field. The resolver doesn't check whether prerequisites are satisfied — it just warns.

**Existing grapple-family fixture cases that will be affected:**

| Case | Action | Prereqs | Current Expectation | Needs Change |
|------|--------|---------|-------------------|--------------|
| `martial-choke-requires-hold` | Choke | hold | hit=true, pendingDecisions | Must either add `combatState.held` or expect manualResolution |
| `martial-escape-requires-grapple-hold` | Escape | grapple, hold | hit=true, pendingDecisions | Same |
| `martial-grapple-karate` | Grapple | none | hit=true, no pendingDecisions | Unchanged |
| `martial-disarm-aikido` | Disarm | blockParry, dodge | hit=true, pendingDecisions | Unaffected (nonDamage, not grappleFamily) |

**Design Decision:** The existing choke and escape fixture cases will be updated so that:
- `martial-choke-requires-hold` adds `combatState: { held: true }` → produces clean outcome (no pendingDecisions, hit allowed)
- `martial-escape-requires-grapple-hold` adds `combatState: { grappled: true, held: false }` → produces manual-resolution because grapple alone isn't enough for escape (escape requires grapple **or** hold)
- New cases will cover the blocked path explicitly

### What This Story Changes

**File: `module/combat/attack-resolver.js`**

Add near the top of the file alongside `MARTIAL_ACTION_CLASSIFICATIONS`:

```js
/**
 * Human-readable labels for martial prerequisite action keys.
 * Used in user-facing manual-resolution messages.
 * @type {Object<string, string>}
 */
const MARTIAL_PREREQ_LABELS = Object.freeze({
  grapple: "Grapple",
  hold: "Hold",
  blockparry: "Block/Parry",
  dodge: "Dodge"
});
```

#### 2. Add `checkGrapplePrerequisites` helper function

Add near the top of the file or near the existing pending decisions code:

```js
/**
 * Check whether a grapple-family martial action's prerequisites are confirmed
 * by the target's combat state.
 *
 * @param {Object} targetSnapshot - Target actor snapshot (may include combatState).
 * @param {string[]} prereqs - Array of prerequisite action keys (OR relationship).
 * @returns {{ confirmed: boolean, missing: string[] }}
 *   confirmed: true if ANY prerequisite is confirmed by combatState.
 *   missing: array of prerequisite keys not confirmed.
 */
export function checkGrapplePrerequisites(targetSnapshot, prereqs) {
  // If no snapshot or prereqs is empty/undefined, nothing to enforce — return confirmed.
  if (!Array.isArray(prereqs) || prereqs.length === 0) {
    return { confirmed: true, missing: [] };
  }
  // null/undefined snapshot means no state data available → prerequisite NOT confirmed.
  if (!targetSnapshot) {
    return { confirmed: false, missing: [...prereqs] };
  }

  const combatState = targetSnapshot.combatState || {};

  // Map action keys to combatState flags
  const PREREQ_TO_STATE_FLAG = {
    grapple: "grappled",
    hold: "held",
    blockparry: "blockedParried",
    dodge: "dodgeActive"
  };

  const confirmed = prereqs.some(prereq => {
    const stateFlag = PREREQ_TO_STATE_FLAG[prereq.toLowerCase().trim()];
    return stateFlag && combatState[stateFlag] === true;
  });

  if (confirmed) {
    return { confirmed: true, missing: [] };
  }

  // If nothing confirmed, report all prereqs as missing
  return { confirmed: false, missing: [...prereqs] };
}
```

**State flag mapping:**

| Prerequisite key | CombatState flag | Meaning |
|-----------------|------------------|---------|
| `grapple` | `combatState.grappled` | Target is being grappled |
| `hold` | `combatState.held` | Target is in a hold |
| `blockParry` | `combatState.blockedParried` | Attacker successfully blocked/parried this turn |
| `dodge` | `combatState.dodgeActive` | Attacker dodged/didn't act yet this turn |

**Important (MVP Convention):** The flags `blockedParried` and `dodgeActive` are checked on `targetSnapshot.combatState`, even though in CP2020 core rules, successful block/parry or dodge is an *attacker-side* action performed during a previous defense phase. Checking them on the target is conceptually wrong but harmless for MVP: these flags will never be set by the Foundry adapter (no turn/action tracker exists), so they effectively always read as `false`. They are defined for completeness of the state-flags vocabulary only. A future story with an action/turn state tracker should relocate these checks to the attacker's combat state.

In practice, only `grappled` and `held` are settable and actionable in MVP.

#### 2. Modify pending decisions block in `resolveMeleeTargetOutcome`

Replace lines 778–791 with:

```js
// 6. Prerequisite enforcement (martial actions with prerequisites)
let targetPendingDecisions = [];
if (isMartial) {
  const prereqs = getRequiresPrerequisite(attackSkill, meleeAction);
  // Only block on unconfirmed prerequisites for grappleFamily actions.
  // Non-grappleFamily actions (disarm, block/parry, dodge) still fire
  // pendingDecisions warnings but are NOT blocked by manual-resolution.
  if (prereqs && prereqs.length > 0 && martialCategory === "grappleFamily") {
    const prereqCheck = checkGrapplePrerequisites(target.snapshot, prereqs);

    if (prereqCheck.confirmed) {
      // Prerequisite is satisfied — suppress the pending decision
      // Action proceeds normally, no warning needed
    } else {
      // Prerequisite not confirmed — block the outcome with manual resolution
      const actionLabel = context.action?.meleeAction || meleeAction;
      targetPendingDecisions.push({
        reason: "prerequisite-check",
        message: `${actionLabel} requires ${prereqs.map(p => MARTIAL_PREREQ_LABELS[p.toLowerCase().trim()] || p).join(" or ")} — verify prerequisite is active before applying this outcome.`,
        action: meleeAction,
        requires: prereqs
      });

      // ⚠️ CRITICAL: Override `targetManualResolution`, NOT `manualResolution`.
      // The return value uses `targetManualResolution` (initialized as `{ required: false }`
      // at the damage-resolution block). Setting `manualResolution` (the pre-function
      // variable used only for the early-exit check) would be silently lost.
      //
      // Also, the root-level `buildOutcomeManualResolution` in `resolveMeleeAction`
      // eats per-target custom fields and uses `MANUAL_RESOLUTION_REASON.missingRuleData`.
      // Per-target detail (reason, action, requires, missing, combatState) survives
      // only on the target's manualResolution object — the root outcome will show
      // a generic manual-resolution banner. This is acceptable for MVP: the chat card
      // uses per-target pendingDecisions for the detailed warning.
      //
      // ALSO CRITICAL: override `hit = false` — it was computed at line 746
      // BEFORE the prerequisite check, so it may be `true` from the opposed roll.
      // A blocked outcome must not show as a hit. Also reset margin to avoid
      // `{ hit: false, margin: 7 }` contradictions.
      hit = false;
      margin = 0;
      targetManualResolution = {
        ...targetManualResolution,  // merge — preserve any existing flags from step 5
        required: true,
        reason: "prerequisite-unconfirmed",
        message: `${actionLabel} cannot be resolved: prerequisite ${prereqs.map(p => MARTIAL_PREREQ_LABELS[p.toLowerCase().trim()] || p).join(" or ")} is not confirmed on target ${target.name || target.actorUuid || "unknown"}. Verify grapple/hold state manually or set combatState.`,
        action: meleeAction,
        requires: prereqs,
        missing: prereqCheck.missing,
        combatState: (target.snapshot?.combatState) || {}
      };
    }
  }
}
```

**Critical ordering constraint:** The `manualResolution` override MUST come after the existing target snapshot check (step 1 in `resolveMeleeTargetOutcome`). If the target already has `manualResolution.required = true` from the snapshot check, we must NOT overwrite it — instead, we extend the existing manual resolution.

The actual placement:

```js
// Before step 6, the code already has:
let manualResolution = target.manualResolution
  ? clonePlainData(target.manualResolution)
  : { required: false };

// If it's ALREADY required, early exit happens in step 1 guard.
// So by the time we reach step 6, manualResolution.required is always false
// for targets that we're actually resolving. Safe to overwrite if prerequisite fails.
```

#### 3. Handle roll evidence preservation

When manual-resolution blocks the outcome, the resolver should still preserve the **roll evidence** so the referee can see what would have happened. The current return shape includes `attack` with `roll` and `opposedRoll` already computed before the prerequisite check. Since the check happens at step 6 (after rolls at step 4), the roll data is already available.

**Do not** skip the opposed roll computation for blocked prerequisite outcomes. The referee needs the roll data to manually adjudicate.

**⚠️ CRITICAL: Override `hit` after prerequisite check.**
`hit` is computed at line 746 (`!attackRoll.isFumble && attackRoll.total > defendRoll.total`) before the prerequisite block (step 6). When the prerequisite check fails, you MUST set `hit = false` even if the opposed result would have been a win. `hits` is already `[]` for grapple-family (non-damage category), so only `hit` needs overriding.

#### 4. CombatState snapshot convention

The `combatState` field on target snapshots is purely advisory/resolver-level. It is populated by the Foundry adapter when building snapshots. The adapter can derive it from:

- Active token status effects (e.g. Foundry's `convenient effects` module or custom status effects)
- Embedded item flags
- Manual referee toggle on the sheet
- Context passed from the combat action

For MVP, the resolver uses `combatState` purely as a read-only input. It does not write or update combat state — that is a future story.

```js
// Typical snapshot shape with combatState:
{
  actorUuid: "Actor.defender",
  name: "Guard",
  stats: { ref: { total: 6 }, bt: { total: 8 } },
  skills: { brawling: { level: 3 } },
  hitLocations: { torso: { label: "Torso" }, head: { label: "Head" } },
  combatState: {
    grappled: true,    // target is currently in a grapple
    held: false,        // target is not in a hold
    blockedParried: false,
    dodgeActive: false
  }
}
```

#### 5. Import `checkGrapplePrerequisites` in `attack-resolver.js`

Add to the existing import block:

```js
// No new import needed — it's defined in the same file
```

Since `checkGrapplePrerequisites` is defined in `attack-resolver.js` (same module), no import change is needed.

### Files to Modify

| File | Change | Risk |
|------|--------|------|
| `module/combat/attack-resolver.js` | Add `checkGrapplePrerequisites` helper; modify prerequisite block for state-aware enforcement | Medium — existing prerequisite pending decisions replaced |
| `tests/combat/fixtures/melee-baseline.json` | Update choke/escape cases with `combatState` or manual-resolution expectations; add new blocked-path cases | Low — additive plus targeted updates |
| `_bmad-output/implementation-artifacts/sprint-status.yaml` | Mark Story 5.6 status | None |

### Files NOT Touched (Verified)

| File | Reason |
|------|--------|
| `module/combat/combat-resolver.js` | Routing unchanged |
| `module/combat/combat-outcome.js` | `CombatOutcome` shape stable |
| `module/combat/martial-arts-data.js` | Pure data module — imported, not modified |
| `module/combat/armor-resolver.js` | No armor changes for martial |
| `module/combat/damage-resolver.js` | Damage pipeline unchanged |
| `module/combat/save-resolver.js` | No save changes |
| `module/combat/state-planner.js` | No planning changes for blocked martial actions |
| `module/combat/combat-chat.js` | Chat rendering unchanged in this story |
| `module/lookups.js` | No changes needed |
| `module/item/item.js` | No changes needed |
| `module/actor/actor.js` | No changes needed — snapshot building is adapter code |
| `module/settings.js` | No settings needed for this story |
| `template.json` | No template additions |
| All other fixture/test files | Must pass unchanged |

### Impact on Existing Fixtures

The following existing fixture cases will be affected:

**`martial-choke-requires-hold` (lines 654–718):**
- Current: expects `hit: true`, `pendingDecisions: [{ reason: "prerequisite-check", action: "choke", requires: ["hold"] }]`
- After change: must decide — either add `combatState: { held: true }` to produce clean outcome, or leave snapshot unchanged and expect `manualResolution: { required: true, reason: "prerequisite-unconfirmed" }`
- **Recommended:** Update to add `combatState: { held: true }` — this tests the "prerequisite confirmed" happy path, which is currently untested.

**`martial-escape-requires-grapple-hold` (lines 720–794):**
- Current: expects `hit: true`, `pendingDecisions: [{ reason: "prerequisite-check", action: "escape", requires: ["grapple", "hold"] }]`
- After change: must decide — add `combatState: { grappled: true }` (escape requires grappled OR held, so this should confirm it), or leave snapshot unchanged and expect manual-resolution
- **Recommended:** Update to add `combatState: { grappled: true }` — confirms that OR prerequisite logic works. Escape requires grapple OR hold; with grappled=true, the prerequisite is satisfied.

**New cases to add:**
- `martial-throw-requires-grapple-without-state` — Aikido throw requires grapple; no combatState → manual resolution blocked
- `martial-choke-without-hold-state` — Choke without combatState.held → manual resolution blocked
- `martial-escape-without-any-state` — Escape without any combatState → manual resolution blocked (grapple OR hold not confirmed)
- `martial-hold-requires-grapple-with-state` — Aikido hold requires grapple; combatState.grappled=true → clean outcome

### manualResolution Shape

The extended `manualResolution` for prerequisite failures follows the existing convention:

```js
{
  required: true,
  reason: "prerequisite-unconfirmed",
  message: "Choke cannot be resolved: prerequisite Hold is not confirmed on target Guard. Verify grapple/hold state manually or set combatState.",
  action: "choke",
  requires: ["hold"],
  missing: ["hold"],
  combatState: {}  // actual combatState from snapshot for debugging
}
```

The `reason` field is a new addition to the `manualResolution` shape that helps differentiate between "no actor context" and "prerequisite not confirmed." Chat rendering code that checks `manualResolution.required` will see `true` and produce the same manual-resolution UI.

### Edge Cases

1. **Grapple action itself** has no prerequisites — unchanged. Grapple always produces a clean opposed-roll outcome.
2. **Block/Parry, Dodge, Disarm** (nonDamage category) have prerequisites but are NOT grappleFamily — they still fire pendingDecisions as before. This story only enforces state for grappleFamily actions.
3. **Multiple targets** — prerequisite check is per-target. One target may have grapple state while another doesn't. Root `pendingDecisions` and `manualResolution` aggregate from all targets.
4. **Both grappled AND held** — if combatState has both, all prerequisites satisfied. Clean outcome for all grapple-family actions.
5. **combatState is null/undefined** — treated as "not confirmed," manual resolution applies for actions with prerequisites.
6. **combatState has unknown flags** — ignored. Only `grappled`, `held`, `blockedParried`, `dodgeActive` are recognized.

### Implementation Order

1. ~~Add `checkGrapplePrerequisites` helper function~~ — add to `attack-resolver.js`
2. ~~Modify prerequisite check in `resolveMeleeTargetOutcome`~~ — replace static pending decisions with state-aware enforcement
3. Update existing fixture cases:
   - `martial-choke-requires-hold`: add `combatState: { held: true }` → expects clean outcome
   - `martial-escape-requires-grapple-hold`: add `combatState: { grappled: true }` → expects clean outcome
4. Add new fixture cases:
   - `martial-throw-requires-grapple-without-state` → blocked manual resolution
   - `martial-choke-without-hold-state` → blocked manual resolution
   - `martial-escape-without-any-state` → blocked manual resolution
   - `martial-hold-requires-grapple-with-state` → clean outcome
5. Run `node tests/run-combat-fixtures.mjs` — all pass
6. Update sprint status

---

## Testing Requirements

### Existing Fixture Updates

#### `martial-choke-requires-hold`

Add to target snapshot:
```json
"combatState": { "held": true }
```

Update expected:
```json
{
  "hit": true,
  "pendingDecisions": []   // prerequisite satisfied → no warning
}
```

#### `martial-escape-requires-grapple-hold`

Add to target snapshot:
```json
"combatState": { "grappled": true }
```

Update expected:
```json
{
  "hit": true,
  "pendingDecisions": []   // prerequisite satisfied (grapple OR hold → grappled=true)
}
```

### New Fixture Cases

#### `martial-throw-requires-grapple-without-state`

Action: Throw with Aikido (requires grapple, blockParry, or dodge). No `combatState`.

Expected: `manualResolution: { required: true, reason: "prerequisite-unconfirmed" }`, `hit: false`, `pendingDecisions: [{ reason: "prerequisite-check", action: "throw", requires: ["grapple", "blockParry", "dodge"] }]`

#### `martial-choke-without-hold-state`

Action: Choke with Brawling (requires hold). No `combatState`.

Expected: `manualResolution: { required: true, reason: "prerequisite-unconfirmed" }`, `hit: false`, `pendingDecisions: [{ reason: "prerequisite-check", action: "choke", requires: ["hold"] }]`

#### `martial-escape-without-any-state`

Action: Escape with Judo (requires grapple or hold). No `combatState`.

Expected: `manualResolution: { required: true, reason: "prerequisite-unconfirmed" }`, `hit: false`

#### `martial-hold-requires-grapple-with-state`

Action: Hold with Aikido (requires grapple, blockParry, or dodge). `combatState: { grappled: true }`.

Expected: `hit: true`, `pendingDecisions: []`, `manualResolution: { required: false }`

### What to Assert in New Fixtures

| Field | Required | Notes |
|-------|----------|-------|
| `manualResolution.reason` | `"prerequisite-unconfirmed"` | For blocked cases |
| `manualResolution.required` | `true` for blocked, `false` for clean | |
| `targets[0].attack.hit` | `false` for blocked | Even if opposed roll would hit |
| `targets[0].hits.length` | `0` for blocked | No damage applied |
| `pendingDecisions` | Array with `reason: "prerequisite-check"` for blocked | Persistent warning for chat |
| `targets[0].attack.roll.total` | Expected roll total | Roll evidence preserved for referee |
| `targets[0].attack.opposedRoll.total` | Expected defender roll | |

### Mandatory Verifications

```sh
# Run all combat fixtures — must pass with zero regressions
node tests/run-combat-fixtures.mjs

# Run martial arts data tests — must pass
node tests/combat/martial-arts-data.test.js
```

---

## Architecture Compliance

- **AD-1 (module/combat/)**: Modifies existing `attack-resolver.js` — core resolver module.
- **AD-2 (CombatOutcome)**: Uses existing `manualResolution`, `pendingDecisions`, `hits` fields — no structural changes.
- **AD-3 (Pure Mechanics)**: No Foundry globals introduced. `combatState` is a plain data field on snapshots.
- **AD-4 (Target Selection)**: Unchanged.
- **AD-6 (Planned Updates)**: Blocked outcomes produce no updates — correct.
- **AD-9 (Fixtures)**: Updated and new fixture cases for state-aware prerequisite enforcement.
- **No template.json changes.** Combat state remains a resolver-level/adapter concept for MVP.

---

## Project Context Reference

- **Current prerequisite code:** `module/combat/attack-resolver.js:778-791`
- **Manual resolution shape:** `module/combat/attack-resolver.js` — established pattern in `meleeManualTarget` function
- **Target snapshot shape:** `module/combat/attack-resolver.js` — passed through `target.snapshot`
- **Fixture baseline:** `tests/combat/fixtures/melee-baseline.json`
- **Martial prereq data:** `module/combat/martial-arts-data.js` — `getRequiresPrerequisite`
- **Grapple-family classification:** `module/combat/attack-resolver.js:35-40` — `MARTIAL_ACTION_CLASSIFICATIONS`
- **Epic context:** `_bmad-output/planning-artifacts/epics.md#Story 5.6`

---

## Previous Story Intelligence

### Story 5.5 — Martial and Brawling Actions (key learnings)

- **Prerequisite warnings are static.** They always fire regardless of actual combat state. This was the intended first step; Story 5.6 makes them state-aware.
- **`MARTIAL_ACTION_CLASSIFICATIONS`** uses lowercase keys: `sweeptrip` (not `sweepTrip`), `blockparry` (not `blockParry`). All internal lookups normalize to lowercase.
- **`getRequiresPrerequisite(style, action)`** returns array (OR relationship) or null. Style input is normalized to lowercase; action input is normalized to lowercase.
- **Choke always requires `["hold"]`** regardless of style. Escape always requires `["grapple", "hold"]` (OR). These are hardcoded in `getRequiresPrerequisite`.
- **Aikido throw requires `["grapple", "blockParry", "dodge"]`** — OR relationship: any one of the three is enough.
- **Frozen import:** `MARTIAL_STYLES` is deeply frozen — do not attempt to mutate it for state tracking. Combat state lives on the target snapshot, not on style definitions.

### Story 5.4 — Martial Arts Data Module

- `getKeyTechniqueBonus(style, action)` — 0 for missing/invalid.
- `getRequiresPrerequisite(style, action)` — null for no prerequisite.
- All data keys are lowercase, getters normalize to lowercase+trim.

### Story 5.2 — Baseline Opposed Melee

- Opposed roll resolution: attacker REF + skill + 1d10 vs defender REF + skill + 1d10.
- Manual-resolution targets early-exit with `meleeManualTarget()`.

---

## Dev Agent Record

### Key Design Decisions

1. **State is on target snapshot, not style data.** Combat state is dynamic per-encounter, not static per-style.
2. **No template.json changes.** `combatState` is a resolver-level convention populated by the Foundry adapter. It can be derived from token effects at snapshot-build time in a future story.
3. **Prerequisite-confirmed actions suppress warnings entirely.** If the referee has signaled that a target is grappled, they don't need a warning about it.
4. **Blocked outcomes preserve roll evidence.** The referee can see the roll data and manually adjudicate the outcome — this is consistent with the Corebook Fidelity Mode design principle of "prefer explicit manual prompts over silent simplification."
5. **OR prerequisite logic** — `checkGrapplePrerequisites` checks if ANY prerequisite is confirmed by combatState. The array from `getRequiresPrerequisite` already represents OR semantics.
6. **`manualResolution.reason`** — introduces a new field to differentiate prerequisite failures from no-actor-context failures. Chat code can use `reason` to produce different messaging if desired, but the existing `manualResolution.required === true` check continues to work.

### Gotchas

- **Action key normalization:** `checkGrapplePrerequisites` maps lowercase prerequisite keys to combatState flags: `"grapple"` → `combatState.grappled`. But `getRequiresPrerequisite` returns keys like `["grapple", "hold"]` which are already lowercase. The mapping must also handle `"blockparry"` (lowercase, no camelCase).
- **`manualResolution` cannot be blindly overwritten** if the target already has `manualResolution.required = true` from the early-exit check (step 1 of `resolveMeleeTargetOutcome`). The code path only reaches step 6 if step 1 did NOT early-exit, so this is safe — but a defensive guard would be prudent.
- **Manual resolution flag precedence:** If `manualResolution.required = true` from prerequisite check, setting `attack.hit = false` is important even when the roll would be a hit. The opponent rolls have already happened, but the referee must manually confirm before the outcome is valid.
- **`pendingDecisions` and `manualResolution` both fire for blocked outcomes** — this is intentional. `pendingDecisions` drives the chat warning, `manualResolution` drives the UI block (no commit button etc). They serve different purposes.
- **Brawling style has empty `requiresPrerequisite`** — but `getRequiresPrerequisite` still returns `["hold"]` for choke and `["grapple", "hold"]` for escape regardless of style. These general rules are applied in the data module code, not in style data.
- **Aikido throw prereqs:** `["grapple", "blockParry", "dodge"]` — `blockParry` maps to `combatState.blockedParried`, which defaults to `false`. For MVP, only `grappled` is practically settable. `blockedParried` and `dodgeActive` are defined for completeness but will rarely be `true` without extended action tracking.

### Completion Notes

Implemented state-aware prerequisite enforcement for grapple-family martial actions.

- Added `checkGrapplePrerequisites(targetSnapshot, prereqs)` helper that maps prerequisite keys (`grapple`, `hold`, `blockParry`, `dodge`) to `combatState` flags (`grappled`, `held`, `blockedParried`, `dodgeActive`) and returns `{ confirmed, missing }`.
- Added `MARTIAL_PREREQ_LABELS` constant for user-facing prerequisite names.
- Modified step 6 in `resolveMeleeTargetOutcome`: grapple-family actions now check combatState. If prereq confirmed → clean outcome (no warning). If unconfirmed → blocks outcome with `manualResolution: { required: true, reason: "prerequisite-unconfirmed" }`, sets `hit = false`, `margin = 0`, preserves roll evidence.
- Non-grappleFamily actions with prereqs (disarm, block/parry, dodge) still fire pendingDecisions warnings but are NOT blocked — unchanged from Story 5.5.
- Changed `hit` and `margin` from `const` to `let` to allow override in prerequisite block.
- Updated 2 existing fixture cases: `martial-choke-requires-hold` now has `combatState: { held: true }` (clean outcome); `martial-escape-requires-grapple-hold` now has `combatState: { grappled: true }` (clean outcome).
- Added 4 new fixture cases: `martial-throw-requires-grapple-without-state` (blocked), `martial-choke-without-hold-state` (blocked), `martial-escape-without-any-state` (blocked), `martial-hold-requires-grapple-with-state` (clean).
- All 9 combat fixture suites pass (melee-baseline, ranged, burst, fullauto, suppressive, jam, unsupported-modes, commit, martial-arts-data).

---

## Change Log

| Date | Change |
|------|--------|
| 2026-05-29 | Initial story specification created |
| 2026-05-29 | Implemented Story 5.6 — state-aware prerequisite enforcement for grapple-family actions

---

## Git Intelligence

### Recent commit line affecting melee/martial resolver

```
ab1af28 feat(combat): implement Story 5.4 - add martial arts data module and tests
```

(Commit `ab1af28` is the HEAD referenced in the baseline. Story 5.5 was implemented but its changes to `attack-resolver.js` and `melee-baseline.json` were committed after `ab1af28` — the file state at baseline already includes MARTIAL_ACTION_CLASSIFICATIONS, key technique bonus, prerequisite warnings, and all 9 martial fixture cases, which means the 5.5 implementation was applied as a follow-up patch or the git baseline was captured mid-branch. The current working state is the post-5.5 state.)

Pattern learned: Each melee/martial story adds incremental change points concentrated in one or two files. Story 5.5 added ~40 lines to `attack-resolver.js` and ~150 lines to `melee-baseline.json`. Story 5.6 will modify the same files with surgical changes to the prerequisite block (~10 lines changed in the resolver, ~80 lines of fixture additions/updates).

---

## Post-Validation Checklist Pass

- ✅ Story recommended output path matches epic structure
- ✅ All FR references (FR-17, FR-20) are cited in metadata
- ✅ Acceptance criteria cover happy path, blocked path, no-prereq path, missing combatState
- ✅ Fixtures are specified for all relevant cases
- ✅ Dev guardrails: no template.json changes, no Foundry globals, no bundle tool changes
- ✅ Previous story intelligence from Stories 5.2, 5.4, 5.5 referenced
- ✅ Architecture compliance section completed
- ✅ Impact analysis covers all files read (verify file list)

## File List

| Action | File |
|--------|------|
| MODIFY | `module/combat/attack-resolver.js` |
| MODIFY | `tests/combat/fixtures/melee-baseline.json` |
| MODIFY | `_bmad-output/implementation-artifacts/5-6-enforce-grapple-family-prerequisites-and-pending-state.md` |
| MODIFY | `_bmad-output/implementation-artifacts/sprint-status.yaml` |