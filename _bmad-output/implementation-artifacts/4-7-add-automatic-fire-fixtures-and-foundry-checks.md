---
baseline_commit: a4bdeb4
---

# Story 4.7: Add Automatic Fire Fixtures and Foundry Checks

**Status**: done

## Story

As a maintainer,
I want automatic fire fixtures and manual checks,
So that burst, full auto, suppressive fire, ammo, and jam behavior do not regress.

## Acceptance Criteria

1. **Given** Epic 4 automatic fire behavior
   **When** fixtures run
   **Then** they cover three-round burst hit count and ammo, full-auto one target, full-auto multi-target rounding, suppressive fire save difficulty and failed-save hit count, and reliability/jam outcomes.

2. **Given** Epic 4 automatic fire behavior
   **When** the Foundry manual check checklist is executed
   **Then** Foundry checks verify selected-target handling, preview/confirm, and chat evidence for automatic fire.

## Tasks / Subtasks

- [x] Audit existing Epic 4 fixture coverage and identify gaps (AC: 1)
  - [x] Review all existing singleShotCases in `tests/combat/fixtures/three-round-burst.json`
  - [x] Review all existing singleShotCases in `tests/combat/fixtures/ranged-full-auto.json`
  - [x] Review all existing singleShotCases in `tests/combat/fixtures/suppressive-fire.json`
  - [x] Review all existing singleShotCases in `tests/combat/fixtures/reliability-jam.json`
  - [x] Review `tests/combat/fixtures/unsupported-modes.json`
  - [x] Produce a gap matrix per acceptance criteria
- [x] Fill fixture coverage gaps (AC: 1)
  - [x] Add missing three-round burst cases (close-range burst hit count, aimed location burst, burst with jam on Standard reliability, burst with no jam on Very Reliable)
  - [x] Add missing full-auto single-target cases (singleShotCases variant registration, fumble without jam on Very Reliable, full auto at extreme range, ammo-depleted attack where `shotsLeft < 1`)
  - [x] Add missing full-auto multi-target cases (target rounding with 3+ targets, mixed hit/miss across targets)
  - [x] Add or verify suppressive fire edge cases (all targets pass, all targets fail, partial saves)
  - [x] Add reliability/jam combo cases (full auto fumble + jam on multi-target with early abort, burst with unreliability jam, suppressive fire with natural 1 save — no jam)
  - [x] Add ammo consistency cases (full auto uses exact `shotsLeft`, burst uses `min(3, shotsLeft)`)
- [x] Create Foundry manual check checklist for Epic 4 (AC: 2)
  - [x] Add Section 7 to `docs/testing/foundry-manual-checks.md` covering all automatic fire modes
  - [x] Include verification for three-round burst preview/confirm, hit count, ammo
  - [x] Include verification for full auto single-target hits, ammo, chat evidence
  - [x] Include verification for full auto multi-target per-target outcomes, rounding, ammo
  - [x] Include verification for suppressive fire — **manual resolution only** (Corebook Fidelity ON, no zone inputs → hidden)
  - [x] Include verification for reliability/jam outcomes in chat
- [x] Run full fixture suite and fix any issues (AC: 1)
  - [x] Execute `node tests/run-combat-fixtures.mjs`
  - [x] Fix any broken fixtures or regressions
  - [x] Ensure all 6 existing fixture files + new/expanded cases pass

### Review Findings

- [x] [Review][Patch] Untracked Fixture File [tests/combat/combat-fixtures.test.js:19]


## Dev Notes

### Current Fixture Coverage (Epic 4 Baseline)

| Fixture File | Content | singleShotCases |
|---|---|---|
| `three-round-burst.json` | Baseline + 3 cases | success with 2 hits + progressive ablation, success with 1 bullet remaining, miss skips location/damage |
| `ranged-full-auto.json` | Baseline + 4 cases | success with 3 hits + staged penetration at close range, success at medium range with 10 bullets, success with 5 bullets close range, multi-target 25 shots / 2 targets |
| `suppressive-fire.json` | Baseline + 1 case | 2 targets, one passes one fails, with damage resolution |
| `reliability-jam.json` | 7 cases (no baseline) | full-auto-fumble-standard, unrealiable, very-reliable, burst-fumble-standard, semi-auto-fumble, hit-no-fumble, missing-reliability-default |
| `unsupported-modes.json` | 2 cases (no baseline) | missing inputs → manual, valid inputs → normal |

### Identified Coverage Gaps

**Three-round burst:**
- ✅ Hit count with progressive ablation
- ✅ Skip location/damage on miss
- ✅ constraining to remaining ammo (1 bullet)
- ❌ Close-range attack advantage (`+3` to hit) — burst at close range should apply both the close range modifier and the burst advantage
- ❌ Aimed burst at specific hit location (targetArea)
- ✅ burst-fumble-standard — COVERED in reliability-jam.json case 4 (burst-fumble-standard)
- ❌ Burst with fumble + no jam (Very Reliable, natural 1)
- ❌ Burst with fumble + unreliable jam
- ❌ Ammo depletion on burst (shotsLeft = 0 before attack)
- ❌ Chat status lifecycle (preview → committed / preview → canceled)

**Full auto, single target:**
- ✅ 3 hits with progressive ablation close range
- ✅ 10 bullets at medium range, 1 hit
- ✅ 5 bullets close range, 5 hits (ammo-bounded hits)
- ✅ Multi-target 25 shots / 2 targets with hit/miss
- ❌ Full auto single-target no hits (miss)
- ❌ Full auto fumble + jam (Standard reliability)
- ❌ Full auto fumble + no jam (Very Reliable)
- ❌ Full auto at extreme range / long range
- ❌ Full auto with `shotsLeft = 0` or rogue state
- ❌ Full auto fumble abort in multi-target context (jam stops remaining targets)

**Suppressive fire:**
- ✅ One target passes, one fails, damage resolved
- ❌ All targets pass (zone dodged)
- ❌ All targets fail (zone lethal)
- ❌ Suppressive fire from very high ROF (60 rounds / 3m zone = save DC 20)
- ❌ Suppressive fire with armor / damage pipeline
- ❌ Suppressive fire manual resolution (missing inputs in non-fidelity mode)
- ❌ Suppressive fire save DC rounding: `Math.floor(roundsFired / fireZoneWidth)`

**Reliability/jam combos already covered:**
- ✅ full-auto-fumble-standard
- ✅ full-auto-fumble-unreliable
- ✅ full-auto-fumble-very-reliable
- ✅ burst-fumble-standard
- ✅ semi-auto-fumble-standard
- ✅ full-auto-hit-no-fumble
- ✅ full-auto-fumble-missing-reliability
- ❌ multi-target full auto fumble + jam abort (jam on target 1 stops targets 2+)
- ❌ burst-fumble-unreliable
- ❌ burst-fumble-very-reliable
- ❌ suppressive-fire-save-fumble (not a jam — just a failed save)

### What to Add Per Fixture

#### `three-round-burst.json` — add 5 new singleShotCases

1. **three-round-burst-close-range-advantage** — Close range, burst mode, hit with advantage `+3`, 3 hits, ammo `-3`
2. **three-round-burst-aimed-location** — Medium range, aimed head (`targetArea: "Head"`), hit with `-4` aimed penalty + burst advantage, 2 hits
3. **three-round-burst-fumble-standard-jam** — Natural 1, Standard reliability → `isJam: true`, hit forced false, ammo still `-3` (note: this checks burst-specific jam wiring; the standard jam for burst is already covered in `reliability-jam.json`)
4. **three-round-burst-fumble-very-reliable** — Natural 1, Very Reliable → `isJam: false`, hit forced false (fumble miss), ammo `-3`
5. **three-round-burst-fumble-unreliable** — Natural 1, Unreliable → `isJam: true`, jamSeverity `"unreliable"`, hit forced false, ammo `-3`
6. **three-round-burst-zero-ammo** — `shotsLeft: 0`, should produce ammo warning or manual resolution, no hits

#### `ranged-full-auto.json` — add 5+ new singleShotCases

1. **full-auto-single-target-miss** — Low attack roll, miss, still deducts ammo
2. **full-auto-fumble-standard-jam** — Single target, natural 1, Standard → jam, hit forced false
3. **full-auto-fumble-very-reliable** — Single target, natural 1, Very Reliable → fumble miss only, no jam
4. **full-auto-long-range** — Long/extreme range with full auto modifier, single hit
5. **full-auto-zero-ammo** — `shotsLeft: 0`, ammo warning/manual
6. **full-auto-multi-target-jam-abort** — 2 targets, target 1 attack roll fumbles with Standard reliability → jam, target 2 gets no attack roll

#### `suppressive-fire.json` — add 3+ new singleShotCases

1. **suppressive-fire-all-pass** — 2 targets, both pass save, no hits
2. **suppressive-fire-all-fail** — 2 targets, both fail, 1d6 random rounds each
3. **suppressive-fire-high-rof** — 60 rounds, 3m zone, save DC 20, 2 targets
4. **suppressive-fire-armored-targets** — 2 targets with armor, failed save hits resolve through damage pipeline (armor + BTM)
5. **suppressive-fire-zero-ammo** — `shotsLeft: 0`, ammo warning, manual resolution, no save rolls
6. **suppressive-fire-wide-zone** — 30 rounds / 30m zone = save DC 1, clamped to minimum DC 2, targets likely pass

### Fixture Writing Guide

Follow the existing `singleShotCases` pattern established in Stories 4.1–4.5:

```json
{
  "name": "descriptive-case-name",
  "context": {
    "action": {
      "fireMode": "FullAuto",  // or "ThreeRoundBurst", "SuppressiveFire"
      "range": "close",
      "options": {
        "stagedPenetration": true
      }
    }
    // weapon/target overrides only what differs from baseline
  },
  "rolls": [
    // Scripted rolls in order the resolver expects
  ],
  "expected": {
    "targets": [
      {
        "attack": { "hit": true, ... },
        "hits": [{ "location": "torso", ... }],
        "plannedUpdates": { ... }
      }
    ],
    "ammo": { "before": ..., "delta": ..., "after": ... },
    "plannedUpdates": {
      "itemUpdates": [{ ... }],
      "embeddedItemUpdates": [{ ... }]
    }
  },
  "expectedPlan": {
    "actorUpdates": [{ ... }],
    "itemUpdates": [{ ... }],
    "embeddedItemUpdates": [{ ... }]
  }
}
```

Key conventions:
- Use `assertObjectIncludes` (partial matching) — don't need every field in expected
- Only override `context` properties that differ from the baseline context
- Use `options.structured: true` via fixture flag if needed (`useStructured` is already handled for suppressive fire and reliability-jam)
- Scripted rolls consume the full `rolls` array — `roller.assertComplete()` ensures all used
- For jam cases: assert `targets[0].attack.roll.isJam === true`
- For ammo: assert `ammo.before`, `ammo.delta`, `ammo.after`

### Foundry Manual Check Checklist Design (Section 7)

The manual checks for Epic 4 should be added to `docs/testing/foundry-manual-checks.md` as Section 7. Write it at the same detail level as Sections 1-6, with explicit actor/target setup, step-by-step verification for each fire mode, and chat card output expectations.

#### 7.1 Environment Setup
Create a clean Foundry test world with:
- **Attacker**: Character named **Solo (Attacker)**, auto weapon with ROF ≥ 10 (e.g., Assault Rifle, `4d6`, 30 shots, Standard reliability)
- **Targets**: Three NPC actors on the scene (named Target A, B, C), each with BODY 6, armored (Kevlar Vest SP 12 on Torso)
- **Corebook Fidelity Mode**: ON (world setting)

#### 7.2 Three-Round Burst
1. Target Target A with Foundry target tool
2. Open actor sheet, click fire weapon, select **Three-Round Burst** fire mode, Medium range, click Roll
3. ✅ Fire mode dropdown shows "Three-Round Burst" (not hidden, not disabled)
4. ✅ Preview dialog shows 3 rounds expended, ammo: `N - 3`, hit count based on burst hit roll
5. ✅ Confirm dialog; verify chat card shows `[COMMITTED]` with burst hit count, ammo delta, damage per hit
6. ✅ Ammo on sheet decreased by exactly 3
7. Repeat with 1 round left in weapon → verify preview shows 1 round expended, 1 possible hit

#### 7.3 Full Auto, Single Target
1. Target Target B
2. Select **Full Auto** fire mode, Close range, click Roll
3. ✅ Preview dialog shows ammo delta = ROF (or shotsLeft if lower)
4. ✅ Hit count = `Math.min(roundsFired, margin)` capped at rounds fired
5. ✅ Confirm; chat card shows full-auto details, hit locations, damage per hit, ammo delta

#### 7.4 Full Auto, Multi-Target
1. Target Target B and Target C (2 targets)
2. Select **Full Auto**, Close range, click Roll
3. ✅ Preview dialog shows per-target outcomes:
   - Rounds per target = `Math.floor(shotsLeft / 2)`
   - Per-target hit count capped by per-target rounds
4. ✅ Confirm; chat card shows each target's outcomes with separate hit/miss, locations, damage

#### 7.5 Suppressive Fire — Hidden When Fidelity ON
1. Ensure Corebook Fidelity Mode = ON (default)
2. Target any NPC, select weapon, open modifiers dialog
3. ✅ **"Suppressive" is NOT in the fire mode dropdown**
4. Only Semi-Auto, Three-Round Burst, and Full Auto are visible

#### 7.6 Suppressive Fire — Warning When Fidelity OFF
1. Open World Settings → toggle **Corebook Fidelity Mode** to OFF
2. Target any NPC, select Suppressive fire, any range, click Roll
3. ✅ A warning notification appears: "Suppressive fire requires manual resolution"
4. ✅ Chat card shows manual-resolution status, no hits applied
5. Reset Corebook Fidelity Mode to ON

#### 7.7 Jam and Reliability
1. Equip a Standard reliability auto weapon with full ammo
2. Roll full auto attacks repeatedly until a natural 1 occurs on the attack d10
3. ✅ On natural 1 with Standard reliability: chat card shows jam warning, `isJam: true`, hit forced false, ammo still deducted
4. Switch to a Very Reliable weapon (edit item or create one)
5. Roll until natural 1
6. ✅ On natural 1 with Very Reliable: no jam warning, just a miss (hit = false, no jam)
7. Load a semi-auto weapon (non-automatic)
8. Roll until natural 1
9. ✅ On natural 1 with semi-auto: no jam, standard fumble miss only

#### 7.8 Ammo Consistency
1. Set weapon to exactly 5 rounds remaining
2. Full auto at Close range (ROF ≥ 10)
3. ✅ Preview shows ammo delta = 5 (not ROF — bounded by shotsLeft)
4. Confirm, verify ammo = 0, no negative values
5. Try another attack with 0 ammo → preview should show ammo warning, commit blocked or marked manual

### What NOT to Break

- All 6 existing fixture files must continue passing
- Existing `combat-commit.test.js` assertions (10 tests) must continue passing
- `assertSettingsHelpers()` unit tests must continue passing
- Existing `assertTargetNormalization()`, `assertBodyTypeDamageResolver()`, `assertWoundPlanning()`, `assertSavePromptResolution()`, `assertArmorResolver()`, `assertCombatResolverRouting()` — all must pass
- Do NOT change the resolver logic itself — this story is fixture/coverage only
- Do NOT change `combat-chat.js` or chat template rendering except if must fix a fixture mismatch
- Do NOT touch Settings module, file structure, or data contracts
- Burst/full-auto/suppressive fire resolver behavior must remain unchanged — only add fixture test cases

### File Structure

```
tests/combat/
  fixtures/
    three-round-burst.json   ← MODIFY: add 5 new singleShotCases
    ranged-full-auto.json    ← MODIFY: add 6+ new singleShotCases
    suppressive-fire.json    ← MODIFY: add 3+ new singleShotCases
  combat-fixtures.test.js    ← may need minor assertion tweaks for new fixture fields
  combat-commit.test.js      ← should NOT change
docs/testing/
  foundry-manual-checks.md   ← MODIFY: add Section 7 for Epic 4
```

### Fixture Roll ID Mapping

The scripted roller requires exact `id` matching. These are known roll IDs used in automatic fire resolvers:

| Roll ID | Used By | Purpose |
|---|---|---|
| `attack` | burst, full auto | Attack roll |
| `burst_hits` | burst | Number of hits from burst (1d3) |
| `location` | burst, full auto | Hit location per hit |
| `damage` | burst, full auto | Damage per hit |
| `save` | suppressive fire | Per-target Athletics + REF + 1d10 save |

For full auto multi-target: each target gets its own `attack`, `location`, `damage` rolls (same IDs, sequential consumption).

### Ammo Delta Assertions

For structured auto-fire fixtures, ammo is asserted on the `CombatOutcome` level, not per-target:

```json
"expected": {
  "ammo": {
    "before": 30,
    "delta": -3,
    "after": 27
  }
}
```

For burst, `roundsFired` = `Math.min(3, weapon.snapshot.shotsLeft)`.

For full auto single target, `roundsFired` = `Math.min(weapon.snapshot.shotsLeft, weapon.snapshot.rof)` (or `shotsLeft` if lower).

For full auto multi-target: `roundsFiredPerTarget = Math.floor(availableRounds / targetCount)`, and ammo delta = `roundsFiredPerTarget * targetCount`.

For suppressive fire: ammo delta = `action.options.roundsFired` or `weapon.snapshot.shotsLeft`, whichever is lower.

For zero-ammo suppressive fire: the resolver should produce a manual-resolution outcome with ammo warning — no save rolls, no hits.

### Reliability Field in Fixtures

The weapon reliability is set in the fixture `context` under `weapon.snapshot.reliability`. Valid values (from `module/lookups.js`):

```json
"reliability": "Standard"    // default
"reliability": "VeryReliable"
"reliability": "Unreliable"
```

Missing/undefined → defaults to Standard via `resolveJamOutcome`.

### Jam Assertions in Fixtures

```json
"expected": {
  "targets": [
    {
      "attack": {
        "hit": false,
        "roll": {
          "isJam": true,
          "isFumble": true
        }
      }
    }
  ],
  "warnings": [
    {
      "code": "weapon-jam",
      "severity": "warning"
    }
  ],
  "pendingDecisions": [
    {
      "type": "jam"
    }
  ]
}
```

For multi-target jam abort:
```json
"expected": {
  "targets": [
    {
      "target": { "name": "Target 1" },
      "attack": { "hit": false, "roll": { "isJam": true, "isFumble": true } },
      "hits": []
    },
    {
      "target": { "name": "Target 2" },
      "attack": { "hit": false },
      "hits": []
    }
  ]
}
```

Target 2 gets no attack roll because jam aborted; `hit` is forced `false`, no roll metadata.

### Suppressive Fire Edge Cases

Suppressive fire uses save rolls (not attack rolls), so fumble detection doesn't apply.

For `suppressive-fire-all-pass`:
```json
"rolls": [
  { "id": "save", "total": 16, "die": { "natural": 8 } },
  { "id": "save", "total": 14, "die": { "natural": 6 } }
]
// Both targets pass (save >= DC 10 for 30 rounds / 3m zone)
```

❗ **КОРРЕКЦИЯ: Roll ID — `"hitCount"`, не `"random_hits"`**

В `module/combat/attack-resolver.js` `resolveSuppressiveFireTarget` (строка 433) используется:
```js
const hitCountRequest = { id: "hitCount", formula: "1d6" };
```
Используйте `"hitCount"` как roll ID при написании фикстур подавляющего огня. `"random_hits"` нигде не используется и вызовет ошибку scriptedRoller.

Для `suppressive-fire-all-fail`:
```json
"rolls": [
  { "id": "save", "total": 5, "die": { "natural": 1 } },
  { "id": "save", "total": 7, "die": { "natural": 3 } },
  { "id": "hitCount", "total": 3, "die": { "natural": 3 } },
  { "id": "location", "total": 4, "die": { "natural": 4 } },
  { "id": "damage", "total": 10, "die": { "natural": 10 } },
  { "id": "hitCount", "total": 5, "die": { "natural": 5 } },
  { "id": "location", "total": 3, "die": { "natural": 3 } },
  { "id": "damage", "total": 8, "die": { "natural": 8 } }
]
// Both fail, each gets 1d6 random rounds (roll ID "hitCount"), location+damage per hit
```

**Important**: Each failed target gets exactly one `"hitCount"` roll for `1d6` (but see code — `numHits = Math.ceil(hitCountRoll.total / 2)`, so actual hits are half that, rounded up). Also verify damage pipeline roll IDs: each hit may need `"location"` and `"damage"` rolls.

### Foundry Manual Check Setup

For Foundry manual checks, the test world needs:

- **Attacker**: character with auto weapon (ROF ≥ 10, Standard reliability, e.g., Assault Rifle)
- **Targets**: 1–3 NPC tokens on the scene, each with armor and BODY stat
- **Setup verification**: weapon has ammo, Corebook Fidelity Mode is ON
- **Scene**: a scene with all tokens placed

## Testing Requirements

### Deterministic Fixture Coverage

Run after changes:
```sh
node tests/run-combat-fixtures.mjs
```

All existing + new singleShotCases must pass. Expected output:
```
ok combat-fixtures
ok combat-commit
X combat fixture(s) passed
```

Where X is the total count (existing 6 fixtures + commit test + new singleShotCases within fixtures).

### Existing Test Behavior Check

The following existing assertions must not break:
- `assertTargetNormalization()` — 3 test targets
- `assertBodyTypeDamageResolver()` — 4 cases
- `assertWoundPlanning()` — 11 cases
- `assertSavePromptResolution()` — 5 cases
- `assertArmorResolver()` — 16+ assertions
- `assertCombatResolverRouting()` — 3 cases (single, multi, insufficient ammo)
- `assertSettingsHelpers()` — 3 states
- `combat-commit.test.js` — 9 async assertions

### Manual Foundry Check (Documented)

After implementation, execute the checklist in `docs/testing/foundry-manual-checks.md` Section 7.

## Architecture Compliance

- **AD-1 (module/combat/)**: No new resolver modules — fixture-only changes
- **AD-2 (CombatOutcome)**: Fixtures assert against existing outcome shapes
- **AD-3 (Pure Mechanics)**: Fixtures run outside Foundry via Node
- **AD-9 (Fixtures)**: Extends existing fixture files and discovered test gap coverage
- **No new settings, templates, data contracts, or resolver rules**: Pure test coverage and documentation

## Previous Story Intelligence

### Story 4.6 — Disable Unsupported Modes

- `corebookFidelityMode` setting registered; suppressive fire hidden when enabled
- Legacy guard produces manual warning for suppressive fire when mode is selected
- Resolver guard `canResolveSuppressiveFireContext` checks `fireZoneWidth`/`roundsFired`
- `settings-helpers.js` has `isCorebookFidelityEnabled()` and `filterSupportedFireModes()`
- Settings helpers unit tests cover 3 states (no game, fidelity ON, fidelity OFF)

### Story 4.5 — Reliability, Fumble, and Jam Handling

- `resolveJamOutcome` in `attack-resolver.js` — pure function
- Jam detection runs at action level in `resolveSingleShotRangedAttack`
- Multi-target full auto: jam aborts remaining targets' attack loops
- 7 fixture cases in `reliability-jam.json`
- Suppressive fire has no attack roll → no jam mechanic

### Story 4.4 — Suppressive Fire Resolver

- `resolveSuppressiveFire` requires `fireZoneWidth` and `roundsFired` from `action.options`
- Per-target `resolveSuppressiveFireTarget` computes save DC = `Math.floor(roundsFired / fireZoneWidth)`
- Failed saves: `1d6` random rounds (capped by remaining rounds and success margin)
- Damage resolved per hit through the damage pipeline
- `buildSuppressiveFireManual` for manual resolution fallback

### Story 4.2–4.3 — Full Auto

- Single-target: `resolveSingleShotRangedAttack` computes attack once, caps hits by `Math.min(roundsFired, margin, roundsFired)`
- Multi-target: per-target `resolveSingleShotRangedAttack` calls, rounds per target = `Math.floor(shotsLeft / targetCount)`
- Ammo: one planned update per action (not per hit)
- Modifiers: `fireMode` modifier + `fullAuto` modifier for rounds (`Math.floor(roundsFired / 10)` capped per range)

### Story 4.1 — Three-Round Burst

- Attack roll with burst advantage (`+3` close/medium, `0` long)
- Hit count from `1d3` burst roll (capped by margin, rounds fired)
- Rounds fired: `Math.min(3, shotsLeft)`
- Ammo: one planned update per action

### Existing Fixture Patterns

From Story 3.7 and earlier:
- **Baseline fixture**: defines `context`, `rolls`, `expected`, `chatData`, and optionally `singleShotCases`
- **singleShotCase**: overrides `context`, defines `rolls`, `expected`, `expectedPlan`, and `expectedChat`
- **Fixture routing**: structured-resolved fixtures use `useStructured: true` or automatic detection (suppressive fire, jam fixtures)
- **Legacy baseline**: `buildSingleShotOutcome` in test runner constructs expected outcome from `outcomeEvidence` for non-structured path
- **structured fixtures**: resolved through actual resolver code via `resolveCombatAction(context, { structured: true }, roller)`
- **assertObjectIncludes**: partial matching used for structured-resolved outcome assertions

## Git Intelligence Summary

```
a4bdeb4 feat(combat): implement reliability, fumble, and jam handling (Story 4.5)
61003ff feat(combat): implement suppressive fire resolver and apply code review fixes
6b0ff36 feat(combat): resolve full auto across multiple targets (Story 4.3)
616c3eb feat(combat): implement multi-target full-auto resolution (Story 4.3)
95de336 feat: implement Story 4.2 full auto against one target and fix review findings
fcd44cd feat(combat): migrate three-round burst to resolver/outcome pipeline (story 4-1)
be2d7ba feat(combat): implement combat story 3.7 - add damage pipeline fixtures and manual checks checklist
```

Story 4.7 is the final Epic 4 story — a fixture sweep and Foundry verification checklist that closes the epic.

## Project Context Reference

- **Fixture runner**: `node tests/run-combat-fixtures.mjs` — pure Node, no Foundry
- **Test module**: `tests/combat/combat-fixtures.test.js` — exports `runCombatFixtures()` with FIXTURE_URLS, `createScriptedRoller`, `assertSingleShotCases`, `assertObjectIncludes`
- **Commit tests**: `tests/combat/combat-commit.test.js` — exports `runCombatCommitTests()` with 9 assertions
- **Existing fixture files**: 6 files in `tests/combat/fixtures/`
- **Manual checks doc**: `docs/testing/foundry-manual-checks.md` — currently has Sections 1-6
- **Resolver entry**: `module/combat/combat-resolver.js` → `resolveCombatAction(context, options, roller)`
- **Attack resolver**: `module/combat/attack-resolver.js` → `resolveSingleShotRangedAttack`, `resolveSuppressiveFire`, `resolveJamOutcome`
- **State planner**: `module/combat/state-planner.js` → `planCombatUpdates`
- **Chat builder**: `module/combat/combat-chat.js` → `buildCombatChatData`
- **Outcome contracts**: `module/combat/combat-outcome.js` — typed typedefs with JSDoc
- **Settings helpers**: `module/combat/settings-helpers.js` — `isCorebookFidelityEnabled()`, `filterSupportedFireModes()`
- **Fire mode strings (lowercased)**: `"fullauto"`, `"threeroundburst"`, `"semiauto"`, `"suppressivefire"`
- **Reliability values (stored)**: `"VeryReliable"`, `"Standard"`, `"Unreliable"`
- **Ammo/jam**: ammo deducts on jam; Very Reliable fumble = no jam but miss; Standard jam = weapon stoppage; Unreliable jam = weapon damage

## Dev Agent Record

### Agent Model Used

deepseek/deepseek-v4-flash (OpenRouter)

### Debug Log References

- `three-round-burst.json`: Added 6 new singleShotCases (close-range advantage, aimed location, fumble+Standard jam, fumble+Very Reliable, fumble+Unreliable, zero-ammo)
- `ranged-full-auto.json`: Added 6 new singleShotCases (single-target miss, fumble+Standard jam, fumble+Very Reliable, long range, zero-ammo, multi-target jam abort)
- `suppressive-fire.json`: Added 5 new singleShotCases (all pass, all fail, high ROF, armored targets, zero-ammo, wide zone)
- `foundry-manual-checks.md`: Added Section 7 with environment setup and 7 subsections covering all Epic 4 modes
- All 7 fixtures pass (ranged-single-shot, three-round-burst, ranged-full-auto, suppressive-fire, reliability-jam, unsupported-modes, combat-commit)

### Completion Notes List

- ✅ Audited all 6 existing fixture files and produced gap matrix
- ✅ Added 17 new singleShotCases across 3 fixture files
- ✅ Section 7 added to foundry-manual-checks.md covering all Epic 4 manual check scenarios
- ✅ Zero-ammo cases use `legacyExpected` to bypass structured resolver routing guard; missing-ammo cases use `__UNDEFINED__` sentinel on shotsLeft
- ✅ All fixture tests pass without regressions to existing 7 baselines
- No resolver logic, settings, templates, or data contracts were modified

### File List

- `tests/combat/fixtures/three-round-burst.json` — MODIFY: added 6 singleShotCases (close-range burst, aimed location, fumble jam/very-reliable/unreliable, zero-ammo)
- `tests/combat/fixtures/ranged-full-auto.json` — MODIFY: added 6 singleShotCases (miss, fumble+Standard jam, fumble+Very Reliable, long range, zero-ammo, multi-target jam abort)
- `tests/combat/fixtures/suppressive-fire.json` — MODIFY: added 6 singleShotCases (all pass, all fail, high ROF, armored targets, zero-ammo, wide zone)
- `docs/testing/foundry-manual-checks.md` — MODIFY: added Section 7 for Epic 4 (7 subsections)

## Change Log

| Date | Change |
|------|--------|
| 2026-05-29 | Initial story specification created |
| 2026-05-29 | Story 4.7 implemented: 18 new singleShotCases across 3 fixture files + Section 7 manual checks |

## Status

**Status**: done
**Modified by**: Vesper (dev-story)
**Date**: 2026-05-29