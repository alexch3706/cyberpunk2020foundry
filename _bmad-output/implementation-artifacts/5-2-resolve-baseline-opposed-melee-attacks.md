---
baseline_commit: 293e46536845a511ce06874731dbaec9f1dd63c1
---

# Story 5.2: Resolve Baseline Opposed Melee Attacks

**Status**: done

## Story

As a referee,
I want melee attacks to resolve as opposed rolls,
So that melee success and failure are not based only on the attacker roll.

## Acceptance Criteria

1. **Given** an attacker, defender, melee weapon, and defender response skill
   **When** melee resolution runs
   **Then** the outcome includes attacker roll, defender roll, opposed result, success/failure, hit location on success, and damage only when the opposed result permits it.

2. **Given** an attacker roll total exceeds the defender roll total
   **When** opposed resolution completes
   **Then** the outcome reports `hit: true`, the attack margin, hit location, and a `hits[]` entry with full damage pipeline: rawDamage (weapon damage + `strengthDamageBonus`), armor mitigation, BTM mitigation, and final damage.

3. **Given** an attacker roll total is less than or equal to the defender roll total
   **When** opposed resolution completes
   **Then** the outcome reports `hit: false`, `margin: 0` or negative, and an empty `hits[]` — no damage is resolved.

4. **Given** a defender response skill is derived from the attacker's skill (or `"brawling"` for martial attacks)
   **When** the defender snapshot contains a matching skill (case-insensitive)
   **Then** the resolver uses that skill for the defender's opposed roll.
   **And** when the defender does NOT have that skill, the resolver falls back through: `brawling` → `melee` → skill level 0.
   **And** all skill lookups use case-insensitive matching (`getSkillValueCaseInsensitive`, `hasSkillCaseInsensitive`).

5. **Given** melee damage resolves against an armored target
   **When** the hit lands
   **Then** the damage pipeline (armor → AP → BTM → minimum damage → wound transition) follows the same sequence as ranged combat (`resolveArmor` + `resolveBodyTypeDamage`), with the raw damage already inflated by `strengthDamageBonus(attackerBT)`.

6. **Given** the `resolveMeleeAction` outcome is produced
   **When** `planCombatUpdates` processes it
   **Then** wound state updates, damage planning, and save prompts are consistent with the existing ranged damage pipeline.

8. **Given** an attacker rolls a natural 1 (fumble)
   **When** opposed resolution completes
   **Then** `hit: false` even if the attacker total exceeds the defender total — fumble is an automatic miss.

7. **Given** a deterministic melee fixture
   **When** the fixture runs
   **Then** it covers attacker-win (hit + damage + location), defender-win (miss), tie (miss), and actorless-target manual resolution.

## Tasks / Subtasks

- [x] **#1: Replace `resolveMeleeAction` shell with opposed roll logic in `attack-resolver.js`**
  - Import `strengthDamageBonus` from `../lookups.js`
  - `resolveMeleeAction` iterates targets; each calls `resolveMeleeTargetOutcome(target, context, options, roller)`
  - For each target (not `manualResolution.required`):
    - Resolve **attacker skill** — for `action.type === "martial"` use `context.action.options?.martialArt`, fallback `"brawling"`; for `"melee"` use `weapon.snapshot.attackSkill`, fallback `"melee"`
    - Build **attacker roll request**: `1d10x10 + @stats.ref.total + @skill.<attackSkill>`
      - `id: "attack"`, terms, rollData with attcker REF and skill from snapshot
      - Skill level via `getSkillValueCaseInsensitive(attackerSnapshot.skills, attackSkill)`
    - Roll with `roll(roller, request)`
    - Normalize metadata (isCritical from natural 10, isFumble from natural 1)
    - Derive **defender response skill** via `resolveDefenderMeleeSkill(target, context, attackerAttackSkill)`:
      - Case-insensitive match against defender's skills
      - If matching skill found → use it
      - If martial art → defender uses `brawling` by default (not required to match martial art skill)
      - Fallback: `brawling` → `melee` → level 0
    - Build **defender roll request**: `1d10x10 + @stats.ref.total + @skill.<defenderSkill>`
      - `id: "defend"`, terms, rollData with defender REF and skill from target snapshot
      - Skill level via `getSkillValueCaseInsensitive(defenderSnapshot.skills, defenderSkill)`
    - Roll with `roll(roller, request)`
    - Opposed result: `hit = !attackRoll.isFumble && attackRoll.total > defendRoll.total`, `margin = hit ? attackRoll.total - defendRoll.total : 0`
      - Attacker fumble (natural 1) → automatic miss regardless of totals
    - On hit:
      - Resolve hit location via `resolveHitLocation(target, action, roller)` (same as ranged)
      - Roll damage: `roller({ id: "damage", formula: weapon.snapshot.damage })`, then `rawDamage = damageRoll.total + strengthDamageBonus(attackerBT)`
      - Apply armor via `resolveArmor(weaponAP, targetSnapshot, hitLocation, { cover })`
      - Apply BTM via `resolveBodyTypeDamage(penetratingDamage, targetBT)`
      - Collect staged penetration updates (same pattern as `buildTargetOutcome`)
      - Build hit record with all evidence fields (same shape as ranged `buildTargetOutcome`)
    - On miss: `hit: false`, empty `hits: []`, no damage resolution
  - Outcome structure returned from `resolveMeleeAction`:
    ```js
    {
      action: { type, meleeAction, ... },
      attacker: { actorUuid, name, snapshot },
      weapon: { itemUuid, name, snapshot },
      targets: [{
        target: { actorUuid, name, snapshot },
        attack: {
          roll: { total, formula, die, isCritical, isFumble },
          opposedRoll: { total, formula, die, isCritical, isFumble },
          hit: bool,
          margin: number
        },
        hits: [{ location, rawDamage, effectiveStoppingPower, armorPiercing, armorMitigation, penetratingDamage, bodyTypeModifier, bodyTypeMitigation, minimumDamageApplied, finalDamage, strengthDamageBonus, armor, stagedPenetration, damageRoll, locationRoll, warnings }],
        saves: [],
        plannedUpdates: { embeddedItemUpdates: [], chatStatus: "preview" },
        manualResolution: { required: bool },
        warnings: []
      }],
      manualResolution: { required: bool },
      ammo: {},
      plannedUpdates: { itemUpdates: [], chatStatus: "preview" },
      chat: { status: "preview" },
      warnings: []
    }
    ```

- [x] **#2: Update fixture file `tests/combat/fixtures/melee-baseline.json`**
  - Replace existing singleShotCases with:
    - **melee-attacker-wins**: 4 rolls (attack, defend, location, damage) → expects `hit: true`, damage pipeline populated
    - **melee-defender-wins**: 2 rolls (attack, defend) → `attack: { hit: false, roll, opposedRoll }`, `hits: []`
    - **melee-tie**: 2 rolls (attack, defend with equal total) → `hit: false`
    - **melee-actorless-target**: 0 rolls → `manualResolution.required: true`
    - **martial-action-shell**: 2 rolls (attack, defend) → `action.type: "martial"`, defender uses `brawling`
  - Remove legacy `melee-no-targets` case (already covered by guard → legacy fallback; `canResolveMeleeContext` still handles this)
  - Baseline `rolls: []` → keep as empty (the singleShotCases supply their own `rolls[]`)
  - Each case in singleShotCases must use `rolls: [...]` with sequential roll consumption matching call order in `resolveMeleeTargetOutcome`

- [x] **#3: Verify existing tests still pass**
  - Run `node tests/run-combat-fixtures.mjs` — all 6 existing ranged/automatic/fixture files + updated melee-baseline must pass
  - `assertTargetNormalization` must continue passing unchanged
  - `assertBodyTypeDamageResolver` — no changes to BTM logic
  - `assertWoundPlanning` — melee damage must produce valid wound state plans
  - `combat-commit.test.js` — must continue passing (no commit changes for melee yet)

- [x] **#4: Update sprint status**
  - Mark `5-2-resolve-baseline-opposed-melee-attacks: ready-for-dev` in `sprint-status.yaml`

### Review Findings

- [x] [Review][Patch] Defensive Safety Guards for Target and Skills [module/combat/attack-resolver.js:648] (Dismissed per dev feedback)
- [x] [Review][Patch] Add Missing ammo: {} Field to Outcome Root [module/combat/attack-resolver.js:616] (Already present in code)
- [x] [Review][Patch] Fix armorPiercingEvidence and AP Damage Fields [module/combat/attack-resolver.js:829] (Applied)
- [x] [Review][Patch] Ensure Raw Melee Damage Cannot Be Negative [module/combat/attack-resolver.js:751] (Applied)
- [x] [Review][Patch] Align Melee Defense Fallback Sequence to AC 4 [module/combat/attack-resolver.js:870] (Applied)
- [x] [Review][Patch] Remove Unused hasSkillCaseInsensitive Helper [module/combat/attack-resolver.js:933] (Applied)
- [x] [Review][Patch] Remove Unused keyTechniqueBonus and targetSnapshotCopy Variables [module/combat/attack-resolver.js:674] (Applied keyTechniqueBonus, targetSnapshotCopy retained per dev feedback)

## Dev Notes

### Core Opposed Melee Rule (CP2020 pg. 99)

> "Both characters roll 1D10 + their REF + their Melee, Brawling, or Martial Arts skill mod. The person who gets the highest total wins the round."

- Ties: defender wins (attack is parried/blocked) → `hit: false`
- There is no DC or target number — the opposed roll is the resolution
- The `margin` is informational (used by some martial arts effects but not baseline melee)

### Attack Formula

**Attacker**: `1d10x10 + @stats.ref.total + @skill.{attackSkill} + @keyTechniqueBonus`
- `attackSkill` comes from `weapon.snapshot.attackSkill` (e.g. `"melee"`, `"fencing"`, `"brawling"`)
- Attacker snapshot skills are built by `__buildCombatSkillSnapshot` in `item.js`

**Defender**: `1d10x10 + @stats.ref.total + @skill.{defenderSkill}`
- Defender skill derived by `resolveDefenderMeleeSkill`

### Defender Skill Resolution

```js
/**
 * Resolve defender's response skill for opposed melee.
 * Uses case-insensitive matching against defender snapshot skills.
 */
function resolveDefenderMeleeSkill(target, context, attackerAttackSkill) {
  const targetSkills = target.snapshot?.skills || {};
  const actionType = context?.action?.type || "melee";

  if (actionType === "martial") {
    // Martial arts: defender always uses Brawling (not required to match martial art skill)
    const brawlingKey = Object.keys(targetSkills).find(k => k.toLowerCase() === "brawling");
    return brawlingKey || "Brawling";
  }

  // Melee: try matching skill, then brawling, then melee
  const matchingKey = Object.keys(targetSkills).find(
    k => k.toLowerCase() === String(attackerAttackSkill || "").toLowerCase()
  );
  if (matchingKey) return matchingKey;

  const brawlingKey = Object.keys(targetSkills).find(k => k.toLowerCase() === "brawling");
  if (brawlingKey) return brawlingKey;

  const meleeKey = Object.keys(targetSkills).find(k => k.toLowerCase() === "melee");
  if (meleeKey) return meleeKey;

  const fencingKey = Object.keys(targetSkills).find(k => k.toLowerCase() === "fencing");
  if (fencingKey) return fencingKey;

  return "Brawling"; // final fallback — resolves to level 0 if missing
}
```

### Case-Insensitive Skill Helpers

```js
function getSkillValueCaseInsensitive(skills = {}, skillName) {
  const lowerName = String(skillName || "").toLowerCase();
  for (const [key, value] of Object.entries(skills)) {
    if (key.toLowerCase() === lowerName) {
      return getSkillValue(value);
    }
  }
  return 0;
}

function hasSkillCaseInsensitive(skills = {}, skillName) {
  const lowerName = String(skillName || "").toLowerCase();
  return Object.keys(skills).some(key => key.toLowerCase() === lowerName);
}
```

### Damage Pipeline for Melee Hits

Melee damage differs from ranged in **one way**: raw damage includes `strengthDamageBonus(attackerBT)` added to the weapon damage die roll.

```
rawDamage = damageDieResult + strengthDamageBonus(attackerBT)
armorMitigation = Math.min(rawDamage, effectiveStoppingPower)
penetratingDamage = rawDamage - armorMitigation
[ AP halving if applicable ]
finalDamage = resolveBodyTypeDamage(penetratingDamage, targetBT).finalDamage
```

Note: `resolveBodyTypeDamage` already handles BTM reduction + minimum damage enforcement.

The `strengthDamageBonus` function is in `lookups.js`:
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

BT 2 → 0, BT 3-4 → -1, BT 5-7 → 0, BT 8-9 → 1, BT 10 → 2, BT 11-12 → 4, BT 13-14 → 5, BT 15+ → 8

### Roll Order per Target

Each target in `resolveMeleeTargetOutcome` consumes rolls in this order:

1. `{ id: "attack" }` — attacker opposed roll (1d10x10)
2. `{ id: "defend" }` — defender opposed roll (1d10x10)
3. `{ id: "location" }` — hit location (only if attacker wins)
4. `{ id: "damage" }` — weapon damage die (only if attacker wins)

Total: 2–4 rolls consumed per target depending on hit/miss.

### What This Story Changes

- **`module/combat/attack-resolver.js`** — replaces `resolveMeleeAction` shell with full opposed roll logic; adds `resolveMeleeTargetOutcome` and `resolveDefenderMeleeSkill` helper; imports `strengthDamageBonus` from `lookups.js`
- **`tests/combat/fixtures/melee-baseline.json`** — updated singleShotCases with proper rolls, attacker-win, defender-win, tie, actorless-target

### What This Story Does NOT Change

- `combat-resolver.js` — routing unchanged, `canResolveMeleeContext` guard unchanged
- `combat-chat.js` — melee chat rendering deferred to later stories
- `combat-commit.js` — melee commit deferred
- `state-planner.js` — unchanged (wound/save planning works on melee outcomes via existing code)
- `target-normalizer.js` — unchanged (skills enrichment done in 5.1)
- `item.js` — legacy `__meleeBonk` / `__martialBonk` unchanged
- save-resolver.js — unchanged (but wound planning may trigger save prompts during `planCombatUpdates`)
- Key technique bonuses for martial arts — deferred to Stories 5.4/5.5
- BT damage modifier correction (BT 13-14 mismatch) — deferred to Story 5.3
- Preview/confirm dialog for melee — deferred to later stories
- No changes to martial-arts-data.js (Story 5.4)

### Regression Risks

- The `roll(roller, request)` function requires `request.id` to match the scripted roll. The defender roll uses `id: "defend"` which is a new roll ID — existing fixtures don't use it, so no conflict.
- Melee damage pipeline reuses `resolveArmor`, `resolveBodyTypeDamage`, `buildStagedPenetrationEvidence` — shared code that must not regress.
- The `strengthDamageBonus` addition is melee-specific. Ranged does NOT add this bonus.
- `resolveHitLocation` is reused — hit location logic must not change for ranged.

### New Helper: `resolveMeleeTargetOutcome`

```js
/**
 * Resolve opposed melee for one target.
 *
 * @param {Object} target Pre-normalized target with snapshot.
 * @param {Object} context CombatActionContext with type "melee" or "martial".
 * @param {Object} options Resolver options (reserved for future).
 * @param {Function} roller Deterministic roller.
 * @returns {Object} CombatTargetOutcome with opposed roll and optional damage.
 */
function resolveMeleeTargetOutcome(target, context, options, roller) {
  // 1. Early exit for manual-resolution targets
  if (target.manualResolution?.required) {
    return meleeManualTarget(target);
  }

  // 2. Resolve attacker skill
  //    - Martial arts: skill comes from martial art choice in action options
  //    - Melee: skill from weapon item data
  let attackSkill = context.weapon?.snapshot?.attackSkill;
  if (context.action?.type === "martial") {
    attackSkill = context.action.options?.martialArt || "brawling";
  }
  if (!attackSkill) attackSkill = "melee";

  const attacker = context.attacker;
  const attackerRef = attacker?.snapshot?.stats?.ref?.total || 0;
  const attackerSkillLevel = getSkillValueCaseInsensitive(attacker?.snapshot?.skills, attackSkill);
  const keyTechniqueBonus = 0; // Story 5.5

  const attackRequest = {
    id: "attack",
    formula: "1d10x10 + @stats.ref.total + @skill." + attackSkill,
    terms: ["1d10x10", "@stats.ref.total", "@skill." + attackSkill],
    rollData: {
      stats: { ref: { total: attackerRef } },
      skill: { [attackSkill]: attackerSkillLevel }
    }
  };
  const attackRoll = normalizeMeleeRoll(roll(roller, attackRequest));

  // 3. Defender opposed roll (case-insensitive skill lookup)
  const defenderSkill = resolveDefenderMeleeSkill(target, context, attackSkill);
  const defenderRef = target.snapshot?.stats?.ref?.total || 0;
  const defenderSkillLevel = getSkillValueCaseInsensitive(target.snapshot?.skills, defenderSkill);

  const defendRequest = {
    id: "defend",
    formula: "1d10x10 + @stats.ref.total + @skill." + defenderSkill,
    terms: ["1d10x10", "@stats.ref.total", "@skill." + defenderSkill],
    rollData: {
      stats: { ref: { total: defenderRef } },
      skill: { [defenderSkill]: defenderSkillLevel }
    }
  };
  const defendRoll = normalizeMeleeRoll(roll(roller, defendRequest));

  // 4. Opposed result — fumble is automatic miss
  const hit = !attackRoll.isFumble && attackRoll.total > defendRoll.total;
  const margin = hit ? attackRoll.total - defendRoll.total : 0;

  // 5. Damage resolution on hit
  let hits = [];
  const plannedUpdates = { embeddedItemUpdates: [], chatStatus: COMBAT_CHAT_STATUS.preview };
  let targetManualResolution = { required: false };
  const targetWarnings = cloneArray(target.warnings);

  if (hit) {
    const locationResult = resolveHitLocation(target, context.action, roller);
    if (locationResult.manualResolution) {
      targetManualResolution = clonePlainData(locationResult.manualResolution);
    }
    targetWarnings.push(...locationResult.warnings);

    if (locationResult.hit) {
      const hitDetail = resolveMeleeHitDamage(
        locationResult.hit,
        context,
        target,
        options,
        roller,
        plannedUpdates
      );
      hits.push(hitDetail);
    }
  }

  return {
    target: clonePlainData(target),
    attack: {
      roll: attackRoll,
      opposedRoll: defendRoll,
      hit,
      margin,
      warnings: []
    },
    hits,
    saves: [],
    plannedUpdates,
    manualResolution: targetManualResolution,
    warnings: targetWarnings
  };
}
```

### New Helper: `resolveMeleeHitDamage`

Builds a `CombatHitRecord` for one melee hit (mirrors the damage section of `buildTargetOutcome`):

```js
function resolveMeleeHitDamage(hitLocationResult, context, target, options, roller, plannedUpdates) {
  const weapon = context.weapon?.snapshot || {};
  const targetSnapshot = target.snapshot || {};

  // Raw damage = weapon die + strengthDamageBonus(attacker BT)
  const attackerBT = context.attacker?.snapshot?.stats?.bt?.total || 0;
  const strengthBonus = strengthDamageBonus(attackerBT);
  const damageRequest = { id: "damage", formula: weapon.damage || "1d6" };
  const damageRoll = roll(roller, damageRequest);
  const rawDamage = damageRoll.total + strengthBonus;

  // Armor (same as ranged)
  const weaponAP = !!weapon.ap;
  const armor = resolveArmor(weaponAP, targetSnapshot, hitLocationResult.location, {
    cover: context.action?.cover || context.action?.options?.cover
  });
  const effectiveStoppingPower = armor.effectiveStoppingPower;
  const armorMitigation = Math.min(rawDamage, effectiveStoppingPower);
  const penetratingDamageBeforeAP = rawDamage - armorMitigation;
  let penetratingDamage = penetratingDamageBeforeAP;
  if (armor.armorPiercing && penetratingDamage > 0) {
    penetratingDamage = Math.floor(penetratingDamage / 2);
  }

  // BTM
  const bodyTypeDamage = resolveBodyTypeDamage(penetratingDamage, resolveTargetBodyType(target));

  // Staged penetration
  const stagedPenetration = buildStagedPenetrationEvidence({
    enabled: resolveStagedPenetrationEnabled(context.action, options),
    penetrated: rawDamage > effectiveStoppingPower,
    armor,
    target
  });

  // Collect staged penetration updates (same pattern as buildTargetOutcome — checks both armor and cyberware)
  if (stagedPenetration.plannedUpdate) {
    const update = stagedPenetration.plannedUpdate.updates[0];
    const armorId = update._id;
    const updatePath = Object.keys(update).find(k => k !== "_id");
    const targetSnapshotCopy = clonePlainData(targetSnapshot);
    const armorItem = targetSnapshotCopy.equippedArmor?.find(a => a.id === armorId);
    if (armorItem) {
      const armorSystem = armorItem.system || armorItem;
      const coverageKey = Object.keys(armorSystem.coverage || {}).find(
        k => k.toLowerCase() === hitLocationResult.location.toLowerCase()
      );
      if (coverageKey) {
        if (!armorSystem.coverage[coverageKey]) armorSystem.coverage[coverageKey] = {};
        armorSystem.coverage[coverageKey].ablation = stagedPenetration.evidence.after;
      }
    } else {
      // Cyberware armor (e.g. Skinweave) — same fallback as ranged buildTargetOutcome
      const cyberwareItem = targetSnapshotCopy.equippedCyberware?.find(c => c.id === armorId);
      if (cyberwareItem) {
        const cyberwareSystem = cyberwareItem.system || cyberwareItem;
        cyberwareSystem.ablation = stagedPenetration.evidence.after;
      }
    }
    plannedUpdates.embeddedItemUpdates.push({
      actorUuid: stagedPenetration.plannedUpdate.actorUuid,
      type: "Item",
      updates: [{
        _id: armorId,
        [updatePath]: update[updatePath]
      }]
    });
  }

  const hitDetail = {
    ...hitLocationResult,
    damageRoll: {
      id: damageRoll.id,
      formula: damageRoll.formula || damageRequest.formula,
      total: damageRoll.total,
      die: clonePlainData(damageRoll.die || {}),
      seed: damageRoll.seed
    },
    rawDamage,
    effectiveStoppingPower,
    armorPiercing: armor.armorPiercing,
    armorMitigation,
    penetratingDamage,
    armorPiercingEvidence: armor.armorPiercing
      ? {
          applied: true,
          rawStoppingPower: effectiveStoppingPower,
          effectiveStoppingPower,
          armorDivisor: 2,
          penetratingDamageDivisor: 2
        }
      : undefined,
    bodyTypeModifier: bodyTypeDamage.bodyTypeModifier,
    bodyTypeMitigation: bodyTypeDamage.bodyTypeMitigation,
    minimumDamageApplied: bodyTypeDamage.minimumDamageApplied,
    finalDamage: bodyTypeDamage.finalDamage,
    strengthDamageBonus: strengthBonus,
    armor: armor,
    stagedPenetration: stagedPenetration.evidence,
    warnings: cloneArray(armor.warnings || [])
  };

  if (stagedPenetration.warning) {
    hitDetail.warnings.push(stagedPenetration.warning);
  }

  return hitDetail;
}
```

### `normalizeMeleeRoll`

Simple normalization (same as `normalizeAttackRoll` but without ranged-specific fields):

```js
function normalizeMeleeRoll(rollResult) {
  return {
    id: rollResult.id,
    formula: rollResult.formula,
    total: rollResult.total,
    die: clonePlainData(rollResult.die || {}),
    seed: rollResult.seed,
    isCritical: !!rollResult.isCritical || rollResult.die?.natural === 10,
    isFumble: !!rollResult.isFumble || rollResult.die?.natural === 1
  };
}
```

### `meleeManualTarget`

```js
function meleeManualTarget(target) {
  return {
    target: clonePlainData(target),
    attack: {},
    hits: [],
    saves: [],
    plannedUpdates: { embeddedItemUpdates: [], chatStatus: COMBAT_CHAT_STATUS.preview },
    manualResolution: clonePlainData(target.manualResolution) || { required: false },
    warnings: cloneArray(target.warnings)
  };
}
```

### Fixture Shape

```json
{
  "name": "melee-baseline",
  "useStructured": true,
  "rolls": [],
  "expected": {
    "outcome": { "chatStatus": "preview" },
    "plannedUpdates": {
      "actorUpdates": [],
      "itemUpdates": [],
      "embeddedItemUpdates": [],
      "chatStatus": "preview",
      "warnings": []
    },
    "chatData": { "preview": {} }
  },
  "context": { /* same baseline as 5.1 — melee weapon + attacker + defender with skills */ },
  "singleShotCases": [
    {
      "name": "melee-attacker-wins",
      "rolls": [
        { "id": "attack", "total": 22, "die": { "natural": 8 } },
        { "id": "defend", "total": 14, "die": { "natural": 5 } },
        { "id": "location", "total": 4, "die": { "natural": 4 }, "location": "torso" },
        { "id": "damage", "total": 3, "die": { "natural": 3 } }
      ],
      "expected": {
        "targets": [
          {
            "attack": {
              "hit": true,
              "roll": { "total": 22, "isCritical": false, "isFumble": false },
              "opposedRoll": { "total": 14 }
            },
            "hits": [{ "location": "torso" }]
          }
        ]
      }
    },
    {
      "name": "melee-defender-wins",
      "rolls": [
        { "id": "attack", "total": 11, "die": { "natural": 3 } },
        { "id": "defend", "total": 18, "die": { "natural": 7 } }
      ],
      "expected": {
        "targets": [
          {
            "attack": {
              "hit": false,
              "margin": 0,
              "roll": { "total": 11 },
              "opposedRoll": { "total": 18 }
            },
            "hits": []
          }
        ]
      }
    },
    {
      "name": "melee-tie",
      "rolls": [
        { "id": "attack", "total": 15, "die": { "natural": 5 } },
        { "id": "defend", "total": 15, "die": { "natural": 4 } }
      ],
      "expected": {
        "targets": [
          {
            "attack": { "hit": false, "margin": 0 },
            "hits": []
          }
        ]
      }
    },
    {
      "name": "melee-actorless-target",
      "context": {
        "targets": [ /* actorless target with manualResolution */ ]
      },
      "rolls": [],
      "expected": {
        "targets": [ { "manualResolution": { "required": true } } ]
      }
    }
  ]
}
```

Note: The `expected` key uses `assertObjectIncludes` (partial deep match), so fields not asserted in the fixture are not validated. This means the fixture only needs to assert structural markers like `hit`, `margin`, `roll`, `opposedRoll`, `location` — the resolver fills in the rest.

### Key Technique Bonus

Set to `0` for this story. Martial arts key technique bonuses from Story 5.4/5.5 will add `@keyTechniqueBonus` to the attacker roll formula when applicable.

### Roll ID Convention

| Roll | ID | Formula | Consumed when |
|------|----|---------|---------------|
| Attacker opposed | `"attack"` | `1d10x10 + REF + skill` | Always |
| Defender opposed | `"defend"` | `1d10x10 + REF + skill` | Always |
| Hit location | `"location"` | `1d10 hit location` | Only on hit |
| Damage die | `"damage"` | `weapon.snapshot.damage` | Only on hit |

## Import Changes (attack-resolver.js)

Add to existing imports:
```js
import { strengthDamageBonus } from "../lookups.js";
```

No other import changes needed. `resolveArmor`, `resolveBodyTypeDamage`, `buildStagedPenetrationEvidence`, `resolveHitLocation`, `resolveTargetBodyType`, `resolveStagedPenetrationEnabled`, `COMBAT_CHAT_STATUS`, `MANUAL_RESOLUTION_REASON` — all already available.

The case-insensitive helpers (`getSkillValueCaseInsensitive`, `hasSkillCaseInsensitive`) are local to `attack-resolver.js` — no exports needed.

## File Structure

Files to **MODIFY**:
- `module/combat/attack-resolver.js` — replace `resolveMeleeAction` shell with full opposed resolution
- `tests/combat/fixtures/melee-baseline.json` — update singleShotCases with opposed roll fixtures

Files **NOT TOUCHED**:
- `module/combat/combat-resolver.js` — routing unchanged
- `module/combat/combat-chat.js` — chat rendering unchanged
- `module/combat/combat-commit.js` — commit flow unchanged
- `module/combat/state-planner.js` — works with existing wound planning
- `module/combat/target-normalizer.js` — unchanged
- `module/item/item.js` — legacy methods unchanged
- `module/lookups.js` — `strengthDamageBonus` already exists, no changes
- All other existing fixture files — must continue passing

## Architecture Compliance

- **AD-1 (module/combat/)**: Logic stays in `attack-resolver.js`
- **AD-2 (CombatOutcome)**: Melee outcomes follow the same `CombatTargetOutcome` shape with `attack`, `hits[]`, `plannedUpdates`
- **AD-3 (Pure Mechanics)**: No Foundry globals — all roll/build functions are pure
- **AD-4 (Target Selection)**: Defender context from 5.1 includes skills, stats, hit locations
- **AD-5 (Preview/Confirm)**: Not yet wired — deferred to later melee stories
- **AD-6 (Planned Updates)**: State planner processes melee outcomes identically to ranged
- **AD-7 (Armor at Resolution Time)**: Reuses `resolveArmor` from armor-resolver.js
- **AD-8 (Corebook Fidelity)**: No setting changes
- **AD-9 (Fixtures)**: Updated `melee-baseline.json` with full opposed roll cases

## Testing Requirements

Run:
```sh
node tests/run-combat-fixtures.mjs
```

All 6 existing fixture files + updated `melee-baseline.json` must pass. Assertion-based tests (`assertTargetNormalization`, `assertBodyTypeDamageResolver`, `assertWoundPlanning`, `assertSavePromptResolution`, `assertArmorResolver`, `assertCombatResolverRouting`, `assertSettingsHelpers`) must continue passing.

The `melee-attacker-wins` case produces a hit with damage — `planCombatUpdates` processes this through wound planning. Verify that `plannedUpdates.actorUpdates` contains a `system.damage` update when the target snapshot has a `damage` field.

## Dev Agent Record

### Implementation Order

1. Add `strengthDamageBonus` import to `attack-resolver.js`
2. Add case-insensitive helpers: `getSkillValueCaseInsensitive`, `hasSkillCaseInsensitive`
3. Add `resolveDefenderMeleeSkill(target, context, attackerAttackSkill)` with case-insensitive matching
4. Add `normalizeMeleeRoll(rollResult)` helper
5. Add `meleeManualTarget(target)` helper
6. Add `resolveMeleeHitDamage(hitLocationResult, context, target, options, roller, plannedUpdates)`
7. Replace `resolveMeleeAction` body: iterate targets → `resolveMeleeTargetOutcome` per target
8. In `resolveMeleeTargetOutcome`:
   - Resolve attacker skill (martial art check for martial, weapon.attackSkill for melee)
   - Early exit for manual targets
   - Attacker roll (case-insensitive skill lookup) + defender roll (case-insensitive)
   - Opposed comparison: `!attackRoll.isFumble && attacker.total > defender.total`
   - On hit: location + damage resolution via `resolveMeleeHitDamage` (with cyberware ablation fallback)
   - On miss: empty hits
9. Update fixture file with new singleShotCases
10. Run all tests — verify all pass
11. Update sprint-status.yaml

## Completion Criteria

- `resolveMeleeAction` produces opposed outcomes with hit/miss, opposedRoll metadata
- Attacker-win case resolves location + full damage pipeline (armor, BTM, staged penetration)
- Defender-win and tie cases produce `hit: false` with empty hits
- Actorless targets produce `manualResolution.required: true`
- All existing ranged/automatic fixtures continue passing
- `planCombatUpdates` processes melee damage into wound state updates when snapshot has damage state

## File List

- `module/combat/attack-resolver.js` — replaces `resolveMeleeAction` shell with full opposed resolution; adds `resolveMeleeTargetOutcome`, `resolveDefenderMeleeSkill`, `normalizeMeleeRoll`, `meleeManualTarget`, `getSkillValueCaseInsensitive`, `hasSkillCaseInsensitive`, `resolveMeleeHitDamage`; imports `strengthDamageBonus` from `lookups.js`
- `tests/combat/fixtures/melee-baseline.json` — updated singleShotCases with opposed roll fixtures (attacker-wins, defender-wins, tie, fumble, actorless-target, martial-action)

## Change Log

| Date | Change |
|------|--------|
| 2026-05-29 | Initial story specification created |
| 2026-05-29 | Implemented opposed melee resolution with attacker-win, defender-win, tie, fumble, actorless, and martial cases — all 8 fixture tests passing |

## Status

**Status**: done
**Modified by**: Vesper
**Date**: 2026-05-29