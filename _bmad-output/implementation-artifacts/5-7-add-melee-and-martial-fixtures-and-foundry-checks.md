---
baseline_commit: b944776
---

# Story 5.7: Add Melee and Martial Fixtures and Foundry Checks

**Status**: done

## Story

As a maintainer,
I want fixtures and manual checks for opposed melee and martial actions,
So that melee/martial combat fidelity does not regress.

**Requirements:** FR-15, FR-16, FR-17, FR-18, FR-21, FR-22
**Epic 5:** Opposed Melee and Martial Arts
**Dependencies:**
- Story 5.1 (defender context normalization) — **done**
- Story 5.2 (baseline opposed melee) — **done**
- Story 5.3 (Body Type damage modifiers) — **done**
- Story 5.4 (martial arts data module) — **done**
- Story 5.5 (martial/brawling actions) — **done**
- Story 5.6 (grapple-family prerequisites) — **done**
- Existing fixture suite in `tests/combat/fixtures/melee-baseline.json` — **23 fixture cases, all passing**

---

## Summary

All Epic 5 melee and martial resolver behavior already exists and is covered by 23 deterministic fixture cases. No new resolver code is needed. This story:

1. **Documents** the complete fixture coverage map for Epic 5 (verifying all acceptance criteria are covered)
2. **Adds one missing fixture case** (`martial-sweep-trip-basic`) for the sweep/trip action, which is a grapple-family action with no prerequisites
3. **Adds a Foundry manual verification section** in `docs/testing/foundry-manual-checks.md` for Epic 5 melee and martial actions
4. **Verifies** all existing fixtures pass and remain stable

This is a **documentation-and-verification-only** story — no resolver code changes are required beyond the optional sweep/trip fixture addition.

---

## Acceptance Criteria

1. **Given** Epic 5 melee/martial behavior
   **When** fixtures run
   **Then** they cover opposed melee hit/miss (attacker wins, defender wins, tie, fumble, manual target)
   **And** a Foundry manual check verifies melee attack launch, target/defender snapshot, and chat evidence.

2. **Given** Epic 5 Body Type damage modifier behavior
   **When** fixtures run
   **Then** they cover BT 10, BT 11, BT 13, BT 14, and BT 15 damage modifier values
   **And** the known BT 13-14 correction (both map to modifier 6) is fixture-covered.

3. **Given** Epic 5 martial key technique bonus behavior
   **When** fixtures run
   **Then** they cover at least Karate strike bonus (+2), Savate kick bonus (+2), Boxing block/parry bonus (+1), Capoeira dodge bonus (+1), Aikido disarm bonus (+1), and Judo escape bonus (+1)
   **And** Brawling returns +0 for all actions.

4. **Given** Epic 5 strike/kick damage resolution
   **When** fixtures run
   **Then** they cover martial damage resolution with weapon damage plus strength bonus, armor mitigation, BTM application, and wound transition
   **And** non-damage martial actions (block/parry, dodge, grapple-family) produce empty hits arrays.

5. **Given** Epic 5 grapple-family prerequisite path
   **When** fixtures run
   **Then** they cover choke-with-state (clean outcome), escape-with-state (OR prerequisite satisfied), hold-with-state (clean outcome),
         choke-without-state (manual resolution blocked), escape-without-state (manual resolution blocked),
         throw-without-state (manual resolution blocked)
   **And** non-grappleFamily actions with prerequisites (disarm) still fire pendingDecisions warnings without blocking.

6. **Given** the Foundry manual verification checklist for Epic 5
   **When** a maintainer follows the checklist
   **Then** it covers melee attack launch with targeted defender, martial action selection (strike, kick, grapple, choke),
         preview/confirm where damage applies, manual-resolution fallback for prerequisite-unconfirmed actions,
         and chat evidence with opposed roll, action label, martial category, and key technique bonus display.

---

## Tasks / Subtasks

- [x] #1: Document existing fixture coverage map (verify all ACs are covered)
- [x] #2 (optional): Add `martial-sweep-trip-basic` fixture case for sweep/trip grapple-family action with no prerequisites
- [x] #3: Add Epic 5 melee/martial section to `docs/testing/foundry-manual-checks.md`
- [x] #4: Run `node tests/run-combat-fixtures.mjs` — all pass (verify no regressions)
- [x] #5: Update sprint status

### Review Findings

- [x] [Review][Patch] Inconsistent Attacker Melee skill setup and roll formula in manual checks [docs/testing/foundry-manual-checks.md:287] (fixed)
- [x] [Review][Patch] Kevlar Vest SP 12 vs Knife 1d6 damage makes damage resolution untestable [docs/testing/foundry-manual-checks.md:294] (fixed)
- [x] [Review][Dismiss] Redundant ammo checks for melee weapons [docs/testing/foundry-manual-checks.md:306] (dismissed, negative testing preferred)
- [x] [Review][Patch] Directing manual tester to set internal combatState in Foundry UI [docs/testing/foundry-manual-checks.md:363] (fixed, macro command added)
- [x] [Review][Patch] Missing Kick and Choke Verification in Manual Checklist [docs/testing/foundry-manual-checks.md:328] (fixed)
- [x] [Review][Patch] Missing Martial Category Validation in Chat Evidence Checklist [docs/testing/foundry-manual-checks.md:330] (fixed)
- [x] [Review][Dismiss] Outdated/Contradictory note comment in sprint-status.yaml [_bmad-output/implementation-artifacts/sprint-status.yaml:40] (dismissed, historical comment)

---

## Developer Context

### Current State

All Epic 5 resolver code is implemented and tested. The fixture file `tests/combat/fixtures/melee-baseline.json` contains 23 fixture cases covering every melee and martial action path.

**File `tests/combat/combat-fixtures.test.js`** already loads and validates `melee-baseline.json` as the 7th fixture in `FIXTURE_URLS`. The `runFixture()` function calls `assertSingleShotCases(fixture)` which iterates all cases in `melee-baseline.json`'s `singleShotCases` array.

**File `tests/combat/martial-arts-data.test.js`** is a standalone unit test (also run by `run-combat-fixtures.mjs`) that validates all 12 martial styles, key technique bonuses, prerequisites, deep-freezing, and defensive boundaries. It is NOT part of the fixture JSON — it's a separate JS test module.

**Existing manual check documentation** lives in `docs/testing/foundry-manual-checks.md` and covers:
- Sections 1-3: Epic 2 single-shot setup and flow
- Section 4: Manual resolution fallbacks
- Section 5: Running fixtures (currently says "2 fixture(s) passed" — needs update to "9")
- Section 6: Epic 3 damage pipeline
- Section 7: Epic 4 automatic fire
- **No Epic 5 section exists yet** — this story adds it.

### Fixture Coverage Map

Below is the complete coverage of all 23 existing fixture cases mapped against the story ACs.

| # | Case Name | Category | ACs Covered |
|---|-----------|----------|-------------|
| 1 | `melee-attacker-wins` | Melee hit | AC1: opposed hit |
| 2 | `melee-defender-wins` | Melee miss | AC1: opposed miss |
| 3 | `melee-tie` | Melee tie | AC1: tie = miss |
| 4 | `melee-fumble` | Melee fumble | AC1: fumble miss |
| 5 | `melee-actorless-target` | Manual target | AC1: manual fallback |
| 6 | `martial-action-shell` | Basic strike | AC1, AC4: damage martial |
| 7 | `martial-strike-karate-bonus` | Key technique +2 | AC3: Karate strike +2 |
| 8 | `martial-kick-savate-bonus` | Key technique +2 | AC3: Savate kick +2 |
| 9 | `martial-block-parry` | Non-damage +1 | AC3, AC4: Boxing block/parry +1, empty hits |
| 10 | `martial-dodge-capoeira` | Non-damage +1 | AC3, AC4: Capoeira dodge +1, empty hits |
| 11 | `martial-disarm-aikido` | Non-damage +1 + warning | AC3, AC5: Aikido disarm +1, pendingDecisions warning |
| 12 | `martial-grapple-karate` | Grapple-family no prereq | AC4, AC5: empty hits, no prerequisites |
| 13 | `martial-choke-requires-hold` | Prereq confirmed | AC5: clean outcome with combatState.held |
| 14 | `martial-escape-requires-grapple-hold` | Prereq confirmed (OR) | AC5: clean outcome with combatState.grappled |
| 15 | `martial-unknown-action-fallback` | Unknown action | AC4: fallback to damageOnly with damage |
| 16 | `melee-bt13-vs-bt14` | BT 13 vs BT 14 | AC2: BT 13 modifier 6, BT 14 modifier 6, armor |
| 17 | `melee-bt15-vs-bt15` | BT 15 vs BT 15 | AC2: BT 15 modifier 8 |
| 18 | `melee-bt10-vs-bt10` | BT 10 vs BT 10 | AC2: BT 10 modifier 4 |
| 19 | `melee-bt11-vs-bt11` | BT 11 vs BT 11 | AC2: BT 11 modifier 5 |
| 20 | `martial-throw-requires-grapple-without-state` | Prereq blocked | AC5: manual resolution for aikido throw |
| 21 | `martial-choke-without-hold-state` | Prereq blocked | AC5: manual resolution for choke |
| 22 | `martial-escape-without-any-state` | Prereq blocked | AC5: manual resolution for escape |
| 23 | `martial-hold-requires-grapple-with-state` | Prereq confirmed | AC5: clean outcome for aikido hold |

**Coverage gaps identified:**
- **No sweep/trip fixture case.** Sweep/trip is a grapple-family action with no prerequisites. It should behave like grapple: clean opposed roll, empty hits, no manual resolution. Adding this case fills the gap.
- **All other ACs fully covered** by the 23 existing cases.

### What This Story Changes

**File: `tests/combat/fixtures/melee-baseline.json`** (optional — add sweep/trip case)

Add a new fixture case at the end of `singleShotCases`:

```json
{
  "name": "martial-sweep-trip-basic",
  "context": {
    "action": {
      "type": "martial",
      "meleeAction": "SweepTrip",
      "options": { "martialArt": "capoeira" }
    },
    "attacker": {
      "snapshot": {
        "stats": { "ref": { "total": 9 }, "bt": { "total": 6 } },
        "skills": {
          "brawling": { "level": 6 },
          "capoeira": { "level": 5 }
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
            "brawling": { "level": 3 }
          },
          "hitLocations": { "torso": { "label": "Torso" }, "head": { "label": "Head" } }
        }
      }
    ]
  },
  "rolls": [
    { "id": "attack", "total": 20, "die": { "natural": 6 } },
    { "id": "defend", "total": 13, "die": { "natural": 4 } }
  ],
  "expected": {
    "action": { "type": "martial", "meleeAction": "SweepTrip", "martialCategory": "grappleFamily" },
    "targets": [
      {
        "target": { "actorUuid": "Actor.defender" },
        "attack": {
          "hit": true,
          "roll": { "total": 21, "keyTechniqueBonus": 1, "martialCategory": "grappleFamily" },
          "opposedRoll": { "total": 13 }
        },
        "hits": [],
        "manualResolution": { "required": false }
      }
    ],
    "manualResolution": { "required": false },
    "pendingDecisions": [],
    "chat": { "status": "preview" }
  }
}
```

Note: Capoeira sweep/trip has key technique bonus +1. Sweep/trip is grappleFamily so hits is empty. No prerequisites for sweep/trip in any style — produces clean outcome.

**File: `docs/testing/foundry-manual-checks.md`** — append Epic 5 section

Add Section 8 after the existing Epic 4 Section 7:

```markdown
## 8. Epic 5 Melee & Martial Actions (Manual Checks)

Verify that melee attacks resolve as opposed rolls, martial actions use correct categories and key technique bonuses, grapple-family prerequisites are enforced, and chat evidence displays correct action labels.

### 8.1 Environment Setup
Create a clean Foundry test world with:
- **Attacker**: Create a character named **Fighter (Attacker)** with:
  - **REF**: `9`, **Brawling**: `6`, **Karate**: `5`, **Aikido**: `5`
  - **Melee Weapon**: Knife (damage `1d6`, attackSkill `melee`)
  - **Martial Weapon**: Fists (damage `1d3`, attackType `Martial`, attackSkill `null`)
  - **BODY**: `6` (BTM: `-2`)
- **Defender**: Create an NPC named **Guard (Defender)** with:
  - **REF**: `6`, **Brawling**: `3`, **Melee**: `4`
  - **BODY**: `8` (BTM: `-2`)
  - **Kevlar Vest**: SP `12` on Torso, equipped
- Place tokens for both actors on an active scene.

### 8.2 Basic Melee Attack
1. Select the **Fighter** token. Target the **Guard** token.
2. Open Fighter's sheet → **Combat** tab → click a **melee weapon roll** button (e.g., Knife).
3. A melee roll should fire — there is **no modifiers dialog** for melee (melee rolls begin resolution immediately).
4. ✅ A preview dialog appears showing:
   - **Attacker**: Fighter using Knife
   - **Opposed Roll**: Attacker REF `9` + Melee `5` + 1d10 vs Defender REF `6` + Melee `4` + 1d10
   - **Hit/Miss**: Hit when attacker total > defender total
   - **Damage**: Weapon damage (1d6) + strength bonus from attacker BODY (6 → +0) — armor/BTM applied
   - **Ammo**: No ammo change (melee)
5. Click **Confirm**:
   - ✅ Chat card updates to `[COMMITTED]` banner (green)
   - ✅ Chat card shows opposed roll values with attacker/defender totals
   - ✅ Damage displays raw damage, armor mitigation, BTM, final damage
   - ✅ Defender sheet damage is updated
6. Click **Cancel** on a subsequent roll:
   - ✅ Chat card updates to `[CANCELED]` banner
   - ✅ No sheet mutations applied

### 8.3 Melee — Defender Wins
1. Attack again. If defender roll > attacker roll:
   - ✅ Preview shows **miss** (`hit: false`)
   - ✅ No damage section displayed
   - ✅ Ammo unchanged
2. Confirm the miss:
   - ✅ Chat card shows `[COMMITTED]` with miss status
   - ✅ "Defender wins" information visible in roll evidence

### 8.4 Martial Action — Strike with Karate
1. Ensure Fighter has **Karate 5** skill and the martial weapon (fists). Target the Guard.
2. Open Fighter's sheet → find the martial action control (dropdown or selector).
3. Select **Strike** action → **Karate** style.
4. Click roll:
   - ✅ Preview dialog shows **martialCategory: "damageOnly"**
   - ✅ Attack total includes **key technique bonus +2** (Karate strike)
   - ✅ Opposed roll uses attacker Karate vs defender Brawling
   - ✅ Damage resolves (1d3 + strength bonus — armor — BTM)
5. Confirm:
   - ✅ Chat card shows `[COMMITTED]`, action label "Strike", style "Karate", bonus "+2"
   - ✅ Sheet mutations applied

### 8.5 Martial Action — Block/Parry (Non-Damage)
1. Select **Block/Parry** action → **Karate** style.
2. Click roll:
   - ✅ Preview shows martialCategory: **"nonDamage"**
   - ✅ Attack total includes key technique bonus **+1** (Karate block/parry)
   - ✅ **hits is empty** — no damage section
   - ✅ No ammo, no damage planning
3. Confirm:
   - ✅ Chat card shows `[COMMITTED]` with Block/Parry result
   - ✅ No sheet mutations (no damage, no ammo)

### 8.6 Martial Action — Grapple (No Prerequisites)
1. Select **Grapple** action → **Karate** style.
2. Click roll:
   - ✅ Preview shows martialCategory: **"grappleFamily"**
   - ✅ Attack total includes key technique bonus **+0** (Karate grapple not a key technique)
   - ✅ **hits is empty**
   - ✅ No pending decisions, no manual resolution
3. Confirm: chat card shows Grapple outcome.

### 8.7 Martial Action — Hold with Prerequisite Confirmed
1. Switch to **Aikido** style. Select **Hold** → roll (Hold requires grapple — will be blocked).
   - ✅ Preview shows `[MANUAL]` banner with "prerequisite-unconfirmed" reason
   - ✅ Confirm button disabled or blocked
   - `[GM override or manual resolution flow]`
2. To test a clean path (if your Foundry adapter supports setting `combatState`):
   - Set `combatState: { grappled: true }` on the defender snapshot
   - Select **Hold** → **Aikido** → roll
   - ✅ Preview shows clean outcome, no manual resolution
   - ✅ Hit/miss based on opposed roll
   - ✅ hits is empty (grappleFamily)

### 8.8 Martial Action — Disarm (Prerequisite Warning, No Block)
1. Select **Disarm** action → **Aikido** style.
2. Click roll:
   - ✅ Preview shows martialCategory: **"nonDamage"**
   - ✅ Attack total includes key technique bonus **+1**
   - ✅ **hits is empty**
   - ✅ Chat card shows a **prerequisite warning** ("Disarm requires Block/Parry or Dodge")
   - ✅ **Confirm button IS available** — disarm is non-grappleFamily, so the warning is advisory
3. Confirm:
   - ✅ Chat card updates to `[COMMITTED]` with pending decision warning
   - ✅ No sheet mutations

### 8.9 Default Melee with Martial Art Not Matching Weapon Skill
1. Use the **Knife** (melee weapon, attackSkill: "melee") while having **Karate 5**.
2. Select a martial action → **Strike** → **Karate**:
   - ✅ Resolver uses Karate skill for opposed roll (not melee skill)
   - ✅ Key technique bonus applies
   - Damage resolves through martial damage pipeline.

### 8.10 Manual Resolution — Missing Defender Context
1. Place an actorless (unlinked) token on the scene.
2. Target the actorless token, initiate a melee attack:
   - ✅ Preview shows `[MANUAL]` banner with "missing-target-actor" reason
   - ✅ Confirm button is blocked
   - ✅ Chat card shows manual-resolution status
```

**File: `_bmad-output/implementation-artifacts/sprint-status.yaml`** — mark Story 5.7 as ready-for-dev

### Files to Modify

| File | Change | Risk |
|------|--------|------|
| `tests/combat/fixtures/melee-baseline.json` | Add `martial-sweep-trip-basic` fixture case (optional) | Low — additive |
| `docs/testing/foundry-manual-checks.md` | Add Section 8: Epic 5 melee/martial manual checks | Low — additive |
| `_bmad-output/implementation-artifacts/sprint-status.yaml` | Mark Story 5.7 status | None |

### Files NOT Touched (Verified)

| File | Reason |
|------|--------|
| `module/combat/attack-resolver.js` | Resolver code complete from Stories 5.1-5.6 |
| `module/combat/combat-resolver.js` | Routing unchanged |
| `module/combat/combat-outcome.js` | Outcome shape stable |
| `module/combat/martial-arts-data.js` | Data module complete |
| `module/combat/state-planner.js` | No planning changes |
| `module/combat/combat-chat.js` | Chat rendering unchanged |
| `module/combat/armor-resolver.js` | No armor changes for martial |
| `module/combat/damage-resolver.js` | Damage pipeline unchanged |
| `module/combat/save-resolver.js` | No save changes |
| `module/combat/hit-location-resolver.js` | No changes needed |
| `module/item/item.js` | No changes needed |
| `module/actor/actor.js` | No changes needed |
| `module/settings.js` | No settings needed |
| `template.json` | No template additions |
| `tests/combat/combat-fixtures.test.js` | No changes needed — existing runner handles fixture |
| `tests/combat/martial-arts-data.test.js` | Already covers all martial data |
| `tests/combat/combat-commit.test.js` | No changes needed |
| All other fixture files | Must pass unchanged |

### Impact on Existing Fixtures

The new `martial-sweep-trip-basic` fixture case is purely additive. All existing 23 cases must continue to pass with zero changes.

### Verification Steps

```sh
# Run all combat fixtures — must pass with 0 regressions
node tests/run-combat-fixtures.mjs

# Expected output includes:
#   ok melee-baseline    (with 24 singleShotCases after addition)
#   ok martial-arts-data
#   9 combat fixture(s) passed
```

---

## Testing Requirements

### Existing Fixture Coverage Verification

All acceptance criteria are already satisfied by the existing 23 fixture cases. Below is the verification mapping:

- **AC1 (opposed melee hit/miss):** Cases 1-5 cover attacker wins, defender wins, tie, fumble, actorless target.
- **AC2 (Body Type modifier):** Cases 16-19 cover BT 10, 11, 13, 14, 15. The `resolveBodyTypeDamage()` call in `combat-fixtures.test.js` also provides 12 explicit unit assertions.
- **AC3 (martial key technique bonus):** Cases 7-11 cover Karate +2, Savate +2, Boxing +1, Capoeira +1, Aikido +1. Brawling returns +0 for all actions (verified in `martial-arts-data.test.js`).
- **AC4 (strike/kick damage):** Cases 6-8 cover martial damage with weapon+strength+armor+BTM. Non-damage cases 9-12 produce empty hits arrays.
- **AC5 (grapple-family prerequisites):** Cases 13-14 (confirmed clean), 20-23 (blocked or clean). Disarm case 11 fires pendingDecisions without blocking.
- **AC6 (Foundry manual checks):** New Section 8 in the manual checks document.

### New Fixture Case

#### `martial-sweep-trip-basic`

Action: SweepTrip with Capoeira. No prerequisites. No `combatState`.

Expected:
- `martialCategory: "grappleFamily"`
- `hit: true` (attack wins)
- `keyTechniqueBonus: 1` (Capoeira sweep/trip gives +1 key technique bonus)
- `hits: []` (grappleFamily — no damage)
- `manualResolution: { required: false }`
- `pendingDecisions: []` (no prerequisites)

### Mandatory Verifications

```sh
# Run all combat fixtures — must pass with zero regressions
node tests/run-combat-fixtures.mjs

# Run martial arts data tests
node tests/combat/martial-arts-data.test.js
```

---

## Architecture Compliance

- **AD-1 (module/combat/)**: No resolver module changes needed.
- **AD-2 (CombatOutcome)**: Existing outcome shape is stable.
- **AD-3 (Pure Mechanics)**: No Foundry globals introduced.
- **AD-4 (Target Selection)**: Unchanged.
- **AD-6 (Planned Updates)**: No planning changes.
- **AD-9 (Fixtures)**: 23 existing + 1 new fixture cases covering all Epic 5 behavior.
- **No template.json changes.**
- **No resolver code changes beyond optional fixture addition.**

---

## Project Context Reference

- **Fixture runner:** `tests/run-combat-fixtures.mjs`
- **Fixture test logic:** `tests/combat/combat-fixtures.test.js`
- **Fixture data:** `tests/combat/fixtures/melee-baseline.json`
- **Martial arts data tests:** `tests/combat/martial-arts-data.test.js`
- **Manual checks doc:** `docs/testing/foundry-manual-checks.md`
- **Resolver:** `module/combat/attack-resolver.js`
- **Martial data:** `module/combat/martial-arts-data.js`
- **Commit tests:** `tests/combat/combat-commit.test.js`

---

## Previous Story Intelligence

### Story 5.6 — Grapple-Family Prerequisites (key learnings)

- `checkGrapplePrerequisites(targetSnapshot, prereqs)` uses `combatState` flags: `grappled`, `held`, `blockedParried`, `dodgeActive`.
- Grapple-family actions without prerequisites (grapple, sweep/trip) produce clean outcomes with no enforcement.
- Non-grappleFamily actions with prerequisites (disarm) produce pendingDecisions warnings but are NOT blocked.
- `MARTIAL_ACTION_CLASSIFICATIONS` uses lowercase keys: `sweeptrip`, `blockparry`, `escape`.
- `hit` and `margin` are `let` (overridable) in `resolveMeleeTargetOutcome` since Story 5.6.
- Existing prune state is resolver-level convention on snapshots, not `template.json`.

### Story 5.5 — Martial and Brawling Actions (key learnings)

- All 11 martial actions are classified: damageOnly, nonDamage, grappleFamily.
- Brawling has +0 for all actions and `isTrainedMartial("brawling")` returns `false`.
- Unknown martial actions fall back to `damageOnly` with +0 key technique bonus.
- Non-damage actions produce empty hits arrays; damage-only actions produce damage.
- Opposed roll uses attacker martial art skill vs defender Brawling.

### Story 5.4 — Martial Arts Data Module

- 12 corebook styles defined in `martial-arts-data.js`.
- `getKeyTechniqueBonus(style, action)` — 0 for missing/invalid.
- `getRequiresPrerequisite(style, action)` — null for no prerequisite (e.g., sweep/trip).
- All data keys are lowercase, getters normalize to lowercase+trim.

### Story 5.3 — Body Type Damage Modifiers

- BT 13-14 correction: both map to modifier 6 (not 5 as in original data).
- BT 15 maps to modifier 8.
- `resolveBodyTypeDamage(penetratingDamage, bodyType)` — tested via 12 explicit unit assertions in `combat-fixtures.test.js`.

### Story 5.2 — Baseline Opposed Melee

- Opposed roll: attacker REF + skill + 1d10 vs defender REF + skill + 1d10.
- Defender skill lookup: matching skill → brawling → melee → Brawling (fallback).
- Martial defender always uses Brawling.
- Manual-resolution targets early-exit with `meleeManualTarget()`.

---

## Dev Agent Record

### Key Design Decisions

1. **No resolver code changes needed.** All Epic 5 mechanics are implemented. This story is about documenting existing coverage and adding Foundry verification guidance.
2. **One optional fixture addition** (`martial-sweep-trip-basic`) to close the gap in sweep/trip coverage. Sweep/trip is grappleFamily with no prerequisites. Uses Capoeira style with a non-bonus roll to test grappleFamily empty-hits path.
3. **Manual checks are documented**, not automated. Foundry verification requires a running world with properly configured actors and tokens. The checklist ensures maintainers can verify UI/interaction behavior that fixtures cannot cover.
4. **Fixture coverage is comprehensive** — 23 cases (24 with the addition) covering all ACs. The martial-arts-data.test.js adds another layer of unit-test coverage for style definitions.

### Completion Notes

✅ All 5 tasks completed:
1. **Coverage map documented** — all ACs 1-6 verified against 23 existing + 1 new fixture cases
2. **Optional sweep/trip fixture added** — `martial-sweep-trip-basic` with Capoeira, no prerequisites, grappleFamily, empty hits
3. **Foundry manual checks added** — Section 8 (8.1-8.12) appended to `docs/testing/foundry-manual-checks.md`
4. **All 9 fixture suites pass** — zero regressions, melee-baseline now has 24 cases
5. **Sprint status updated** to "review"

---

## Change Log

| Date | Change |
|------|--------|
| 2026-05-29 | Initial story specification created |
| 2026-05-30 | Implemented: added sweep/trip fixture, Epic 5 manual checks section, updated fixture count in Section 5, verified all 9 suites pass |
| 2026-05-30 | Addressed code review findings: added Melee:5 skill to attacker setup, lowered defender SP to 4 for testable damage, added Kick + Choke sections, added explicit console commands for combatState, added martialCategory checks in chat evidence, renumbered sections 8.1-8.12 |

---

## Git Intelligence

### Recent commits affecting melee/martial resolver

```
b944776 feat(combat): implement Story 5.6 - enforce grapple-family prerequisites and pending state
ab1af28 feat(combat): implement Story 5.4 - add martial arts data module and tests
27bc3e2 feat(combat): implement melee body type damage modifiers and address review findings (Story 5.3)
b42b84c feat(combat): resolve baseline opposed melee attacks (Story 5.2)
293e465 feat(combat): implement Story 5.1 - Normalize Defender Context for Melee Resolution
```

6abf642 (docs only) added Story 5.5 spec and Epic 1 retrospective artifacts.

---

## Post-Validation Checklist Pass

- ✅ Story recommended output path matches epic structure
- ✅ All FR references (FR-15, FR-16, FR-17, FR-18, FR-21, FR-22) are cited in metadata
- ✅ Acceptance criteria cover all melee/martial behavior paths
- ✅ Fixture coverage map verified against all ACs
- ✅ Dev guardrails: no resolver code changes, no template.json changes, no Foundry globals
- ✅ Previous story intelligence from Stories 5.1-5.6 referenced
- ✅ Architecture compliance section completed
- ✅ Manual check documentation template provided
- ✅ Impact analysis covers all files read

## File List

| Action | File |
|--------|------|
| MODIFY | `tests/combat/fixtures/melee-baseline.json` (added `martial-sweep-trip-basic` case) |
| MODIFY | `docs/testing/foundry-manual-checks.md` (added Epic 5 Section 8, updated Section 5 fixture count) |
| MODIFY | `_bmad-output/implementation-artifacts/5-7-add-melee-and-martial-fixtures-and-foundry-checks.md` |
| MODIFY | `_bmad-output/implementation-artifacts/sprint-status.yaml` |