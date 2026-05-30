import { defaultAreaLookup, rangeDCs, ranges, btmFromBT, strengthDamageBonus } from "../lookups.js";
import { COMBAT_CHAT_STATUS, COMBAT_WARNING_SEVERITY, MANUAL_RESOLUTION_REASON } from "./combat-outcome.js";
import { resolveArmor } from "./armor-resolver.js";
import { getKeyTechniqueBonus, getRequiresPrerequisite } from "./martial-arts-data.js";

const RANGED_MODIFIERS = Object.freeze([
  { code: "aimRounds", label: "Aiming", term: "@modifier.aimRounds", value: options => Number(options.aimRounds || 0), include: value => value !== 0 },
  { code: "targetArea", label: "Aimed Location", term: "@modifier.targetArea", value: options => options.targetArea ? -4 : 0, include: value => value !== 0 },
  { code: "targetsCount", label: "Targets Count", term: "@modifier.targetsCount", value: options => Number(options.targetsCount || 0), include: value => value !== 0 },
  { code: "ambush", label: "Ambush", term: "@modifier.ambush", value: options => options.ambush ? 5 : 0, include: value => value !== 0 },
  { code: "blinded", label: "Blinded", term: "@modifier.blinded", value: options => options.blinded ? -3 : 0, include: value => value !== 0 },
  { code: "dualWield", label: "Dual Wield", term: "@modifier.dualWield", value: options => options.dualWield ? -3 : 0, include: value => value !== 0 },
  { code: "fastDraw", label: "Fast Draw", term: "@modifier.fastDraw", value: options => options.fastDraw ? -3 : 0, include: value => value !== 0 },
  { code: "hipfire", label: "Hipfire", term: "@modifier.hipfire", value: options => options.hipfire ? -2 : 0, include: value => value !== 0 },
  { code: "ricochet", label: "Ricochet", term: "@modifier.ricochet", value: options => options.ricochet ? -5 : 0, include: value => value !== 0 },
  { code: "running", label: "Running", term: "@modifier.running", value: options => options.running ? -3 : 0, include: value => value !== 0 },
  { code: "turningToFace", label: "Turning To Face", term: "@modifier.turningToFace", value: options => options.turningToFace ? -2 : 0, include: value => value !== 0 },
  { code: "extraMod", label: "Extra Modifier", term: "@modifier.extraMod", value: options => Number(options.extraMod || 0), include: value => value !== 0 }
]);

const MISSING_LOCATION_BLOCKS = Object.freeze(["hit-location", "target-damage", "target-armor", "target-saves"]);
const AMMO_BLOCKS = Object.freeze(["attacker-ammo"]);

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

/**
 * Human-readable labels for martial prerequisite action keys.
 * Used in user-facing manual-resolution messages.
 * Keys are lowercased for case-insensitive lookup.
 * @type {Object<string, string>}
 */
const MARTIAL_PREREQ_LABELS = Object.freeze({
  grapple: "Grapple",
  hold: "Hold",
  blockparry: "Block/Parry",
  dodge: "Dodge"
});

/**
 * Check whether a grapple-family martial action\'s prerequisites are confirmed
 * by the target\'s combat state.
 *
 * @param {Object} targetSnapshot - Target actor snapshot (may include combatState).
 * @param {string[]} prereqs - Array of prerequisite action keys (OR relationship).
 * @returns {{ confirmed: boolean, missing: string[] }}
 *   confirmed: true if ANY prerequisite is confirmed by combatState.
 *   missing: array of prerequisite keys not confirmed.
 */
export function checkGrapplePrerequisites(targetSnapshot, prereqs) {
  if (!Array.isArray(prereqs) || prereqs.length === 0) {
    return { confirmed: true, missing: [] };
  }
  if (!targetSnapshot) {
    return { confirmed: false, missing: [...prereqs] };
  }

  const combatState = targetSnapshot.combatState || {};

  const PREREQ_TO_STATE_FLAG = {
    grapple: "grappled",
    hold: "held",
    blockparry: "blockedParried",
    dodge: "dodgeActive"
  };

  const confirmed = prereqs.some(prereq => {
    const normalizedPrereq = String(prereq || "").toLowerCase().trim();
    if (!normalizedPrereq) return false;
    const stateFlag = PREREQ_TO_STATE_FLAG[normalizedPrereq];
    return stateFlag && combatState[stateFlag] === true;
  });

  if (confirmed) {
    return { confirmed: true, missing: [] };
  }

  return { confirmed: false, missing: [...prereqs] };
}

export function resolveJamOutcome(isFumble, fireMode, reliability, weaponName = "Weapon") {
  if (!isFumble) {
    return { isJam: false };
  }

  const lowerFireMode = String(fireMode || "").toLowerCase();
  if (lowerFireMode !== "fullauto" && lowerFireMode !== "threeroundburst") {
    return { isJam: false };
  }

  const rel = String(reliability || "").toLowerCase();
  if (rel === "veryreliable") {
    return { isJam: false };
  }

  if (rel === "unreliable") {
    return {
      isJam: true,
      jamSeverity: "unreliable",
      warnings: [{
        code: "weapon-jam",
        severity: COMBAT_WARNING_SEVERITY.warning,
        message: `"${weaponName}" jammed and damaged; repair required before next shot.`
      }],
      pendingDecisions: [{
        type: "jam",
        severity: "unreliable",
        message: `"${weaponName}" damaged and requires repair (repair skill or gunsmith).`
      }]
    };
  }

  // Default to Standard (also handles missing/unknown reliability)
  return {
    isJam: true,
    jamSeverity: "standard",
    warnings: [{
      code: "weapon-jam",
      severity: COMBAT_WARNING_SEVERITY.warning,
      message: `"${weaponName}" jammed; clear stoppage before next shot.`
    }],
    pendingDecisions: [{
      type: "jam",
      severity: "standard",
      message: `Clear "${weaponName}" stoppage (weapon skill check or referee action).`
    }]
  };
}

export function resolveSingleShotRangedAttack(context, options = {}, roller = undefined) {
  const action = clonePlainData(context.action || {});
  action.targetArea = action.targetArea || action.options?.targetArea;
  const range = normalizeRange(action.range);
  const targetNumber = rangeDCs[range] || action.targetNumber;

  const fireMode = String(action.fireMode || "").toLowerCase();
  const targetCount = Array.isArray(context.targets) ? context.targets.length : 0;

  let roundsFired = 1;
  let roundsFiredPerTarget = undefined;

  if (fireMode === "threeroundburst") {
    const rawShotsLeft = normalizeAmmoState(context.weapon?.snapshot?.shotsLeft);
    roundsFired = rawShotsLeft.valid ? Math.min(rawShotsLeft.value, 3) : 3;
    if (roundsFired <= 0 && rawShotsLeft.valid) {
      roundsFired = 0;
    }
  } else if (fireMode === "fullauto") {
    const rawShotsLeft = normalizeAmmoState(context.weapon?.snapshot?.shotsLeft);
    const rof = Math.max(0, Number(context.weapon?.snapshot?.rof) || 0);
    const maxRoundsFired = rawShotsLeft.valid ? Math.min(rawShotsLeft.value, rof) : rof;
    const finalMaxRoundsFired = (maxRoundsFired <= 0 && rawShotsLeft.valid) ? 0 : maxRoundsFired;

    if (targetCount > 1) {
      roundsFiredPerTarget = Math.floor(finalMaxRoundsFired / targetCount);
      roundsFired = roundsFiredPerTarget * targetCount;
    } else {
      roundsFired = finalMaxRoundsFired;
    }
  }

  let targets = [];
  let modifierEvidence;
  let attackRoll;
  let actionWarnings = [];
  let actionPendingDecisions = [];

  if (fireMode === "fullauto" && targetCount > 1) {
    let jamAborted = false;
    targets = (context.targets || []).map((target, idx) => {
      if (jamAborted) {
        return {
          target: clonePlainData(target),
          attack: {
            hit: false,
            warnings: []
          },
          hits: [],
          saves: [],
          plannedUpdates: { embeddedItemUpdates: [], chatStatus: COMBAT_CHAT_STATUS.preview },
          manualResolution: { required: false },
          warnings: cloneArray(target.warnings)
        };
      }

      const targetAction = {
        ...action,
        roundsFiredPerTarget
      };
      if (idx > 0) {
        targetAction.targetArea = undefined;
        if (targetAction.options) {
          targetAction.options = {
            ...targetAction.options,
            targetArea: undefined
          };
        }
      }
      const targetModifierEvidence = buildModifierEvidence(targetAction, context.weapon);
      const targetAttackRequest = buildAttackRollRequest(
        { ...context, action: targetAction },
        targetModifierEvidence
      );
      const targetAttackRoll = normalizeAttackRoll(
        roll(roller, targetAttackRequest),
        targetAttackRequest
      );

      if (idx === 0) {
        modifierEvidence = targetModifierEvidence;
        attackRoll = targetAttackRoll;
      }

      // Jam check after each attack roll in multi-target full auto
      const isFumble = !!targetAttackRoll.isFumble;
      const jamResult = resolveJamOutcome(
        isFumble,
        fireMode,
        context.weapon?.snapshot?.reliability,
        context.weapon?.name || "Weapon"
      );

      let forceMiss = false;

      if (jamResult.isJam) {
        targetAttackRoll.isJam = true;
        actionWarnings = [...actionWarnings, ...jamResult.warnings];
        actionPendingDecisions = [...actionPendingDecisions, ...jamResult.pendingDecisions];
        jamAborted = true;
        forceMiss = true;
      } else if (isFumble) {
        // Natural 1 is an automatic miss regardless of modifiers
        forceMiss = true;
      }

      if (forceMiss || jamAborted) {
        return {
          target: clonePlainData(target),
          attack: {
            roll: clonePlainData(targetAttackRoll),
            targetNumber,
            hit: false,
            margin: 0,
            warnings: []
          },
          hits: [],
          saves: [],
          plannedUpdates: { embeddedItemUpdates: [], chatStatus: COMBAT_CHAT_STATUS.preview },
          manualResolution: { required: false },
          warnings: cloneArray(target.warnings)
        };
      }

      return buildTargetOutcome(
        target,
        targetAttackRoll,
        targetNumber,
        targetAction,
        context.weapon,
        roller,
        options,
        roundsFiredPerTarget
      );
    });
  } else {
    modifierEvidence = buildModifierEvidence(action, context.weapon);
    const attackRequest = buildAttackRollRequest(context, modifierEvidence);
    attackRoll = normalizeAttackRoll(roll(roller, attackRequest), attackRequest);

    // Jam check after attack roll (single-target or shared-roll modes)
    const isFumble = !!attackRoll.isFumble;
    const jamResult = resolveJamOutcome(
      isFumble,
      fireMode,
      context.weapon?.snapshot?.reliability,
      context.weapon?.name || "Weapon"
    );

    let forceMiss = false;

    if (jamResult.isJam) {
      attackRoll.isJam = true;
      actionWarnings = [...actionWarnings, ...jamResult.warnings];
      actionPendingDecisions = [...actionPendingDecisions, ...jamResult.pendingDecisions];
      forceMiss = true;
    } else if (isFumble) {
      // Natural 1 is an automatic miss regardless of modifiers
      forceMiss = true;
    }

    targets = (context.targets || []).map(target => {
      if (forceMiss) {
        return {
          target: clonePlainData(target),
          attack: {
            roll: clonePlainData(attackRoll),
            targetNumber,
            hit: false,
            margin: 0,
            warnings: []
          },
          hits: [],
          saves: [],
          plannedUpdates: { embeddedItemUpdates: [], chatStatus: COMBAT_CHAT_STATUS.preview },
          manualResolution: { required: false },
          warnings: cloneArray(target.warnings)
        };
      }
      return buildTargetOutcome(
        target,
        attackRoll,
        targetNumber,
        action,
        context.weapon,
        roller,
        options,
        roundsFired
      );
    });
  }

  const manualTargets = targets.filter(target => target.manualResolution?.required);

  const ammoPlanning = buildAmmoPlanning(context.weapon, roundsFired);

  return {
    action: {
      ...action,
      range,
      modifiers: modifierEvidence
    },
    attacker: clonePlainData(context.attacker || {}),
    weapon: clonePlainData(context.weapon || {}),
    targets,
    pendingDecisions: actionPendingDecisions,
    manualResolution: buildOutcomeManualResolution([
      ...manualTargets.map(target => target.manualResolution),
      ammoPlanning.manualResolution
    ].filter(Boolean)),
    ammo: ammoPlanning.ammo,
    plannedUpdates: ammoPlanning.plannedUpdates,
    chat: {
      status: COMBAT_CHAT_STATUS.preview
    },
    warnings: [...ammoPlanning.warnings, ...actionWarnings]
  };
}

export function resolveSuppressiveFire(context, options = {}, roller = undefined) {
  const action = clonePlainData(context.action || {});
  const fireZoneWidth = action.fireZoneWidth ?? action.options?.fireZoneWidth;
  const roundsFired = action.roundsFired ?? action.options?.roundsFired;

  // Validate required inputs
  if(fireZoneWidth === undefined || fireZoneWidth === null || roundsFired === undefined || roundsFired === null) {
    return buildSuppressiveFireManual("Suppressive fire requires fireZoneWidth and roundsFired; resolve manually.");
  }

  const zoneWidth = Number(fireZoneWidth);
  const totalRounds = Number(roundsFired);

  if(!Number.isFinite(zoneWidth) || zoneWidth <= 0 || !Number.isFinite(totalRounds) || totalRounds <= 0) {
    return buildSuppressiveFireManual("Suppressive fire requires positive numeric fireZoneWidth and roundsFired; resolve manually.");
  }

  // Cap rounds fired by Rate of Fire (rof) and remaining ammo
  const rawShotsLeft = normalizeAmmoState(context.weapon?.snapshot?.shotsLeft);
  const rof = Math.max(0, Number(context.weapon?.snapshot?.rof) || 0);
  let finalRoundsFired = totalRounds;
  if (rof > 0) {
    finalRoundsFired = Math.min(finalRoundsFired, rof);
  }
  if (rawShotsLeft.valid) {
    finalRoundsFired = Math.min(finalRoundsFired, rawShotsLeft.value);
  }
  finalRoundsFired = Math.max(0, finalRoundsFired);

  // Save DC: Math.max(2, Math.floor(finalRoundsFired / fireZoneWidth))
  const saveDC = Math.max(2, Math.floor(finalRoundsFired / zoneWidth));

  const targets = (context.targets || []).map(target =>
    resolveSuppressiveFireTarget(target, saveDC, roller, context.weapon, action, options)
  );

  const manualTargets = targets.filter(t => t.manualResolution?.required);

  const ammoPlanning = buildAmmoPlanning(context.weapon, finalRoundsFired);

  return {
    action: {
      ...action,
      fireMode: action.fireMode || "suppressivefire",
      fireZoneWidth: zoneWidth,
      roundsFired: finalRoundsFired
    },
    attacker: clonePlainData(context.attacker || {}),
    weapon: clonePlainData(context.weapon || {}),
    targets,
    pendingDecisions: [],
    manualResolution: buildOutcomeManualResolution([
      ...manualTargets.map(t => t.manualResolution),
      ammoPlanning.manualResolution
    ].filter(Boolean)),
    ammo: ammoPlanning.ammo,
    plannedUpdates: ammoPlanning.plannedUpdates,
    chat: {
      status: COMBAT_CHAT_STATUS.preview
    },
    warnings: ammoPlanning.warnings
  };
}

function buildSuppressiveFireManual(message) {
  return {
    action: {},
    attacker: {},
    weapon: {},
    targets: [],
    pendingDecisions: [],
    manualResolution: {
      required: true,
      reason: MANUAL_RESOLUTION_REASON.missingRuleData,
      message,
      blockedUpdateCategories: ["hit-location", "target-damage", "target-armor", "target-saves", "attacker-ammo"]
    },
    ammo: {},
    plannedUpdates: {
      itemUpdates: [],
      chatStatus: COMBAT_CHAT_STATUS.manual
    },
    chat: {
      status: COMBAT_CHAT_STATUS.manual
    },
    warnings: []
  };
}

function resolveSuppressiveFireTarget(target, saveDC, roller, weapon, action, resolverOptions = {}) {
  const targetWarnings = cloneArray(target.warnings);
  let manualResolution = target.manualResolution
    ? clonePlainData(target.manualResolution)
    : { required: false };

  if(manualResolution.required) {
    return {
      target: clonePlainData(target),
      attack: {},
      hits: [],
      saves: [],
      plannedUpdates: {
        embeddedItemUpdates: [],
        chatStatus: COMBAT_CHAT_STATUS.preview
      },
      manualResolution,
      warnings: targetWarnings
    };
  }

  // Resolve save: REF + Athletics + 1d10 >= saveDC
  const targetRef = target.snapshot?.stats?.ref?.total ?? 0;
  const targetAthletics = getSkillValue(target.snapshot?.skills?.athletics);

  const saveRollRequest = {
    id: "save",
    formula: "@stats.ref.total + @skill.athletics + 1d10",
    terms: ["@stats.ref.total", "@skill.athletics", "1d10"],
    rollData: {
      stats: {
        ref: {
          total: targetRef
        }
      },
      skill: {
        athletics: targetAthletics
      }
    }
  };
  const saveRoll = roll(roller, saveRollRequest);
  const savePassed = saveRoll.total >= saveDC;
  const saveMargin = saveRoll.total - saveDC;

  let hits = [];
  const plannedUpdates = {
    embeddedItemUpdates: [],
    chatStatus: COMBAT_CHAT_STATUS.preview
  };

  if(!savePassed) {
    // Failed save: calculate hits = Math.ceil(1d6 / 2)
    const hitCountRequest = {
      id: "hitCount",
      formula: "1d6"
    };
    const hitCountRoll = roll(roller, hitCountRequest);
    const numHits = Math.ceil(hitCountRoll.total / 2);

    const targetSnapshotCopy = clonePlainData(target.snapshot || {});
    const accumulatedAblations = {};

    for(let i = 0; i < numHits; i++) {
      const locationResult = resolveHitLocation(target, { ...action, targetArea: undefined }, roller);
      if(locationResult.manualResolution) {
        if(!manualResolution.required) {
          manualResolution = clonePlainData(locationResult.manualResolution);
        } else {
          const categories = new Set([
            ...(manualResolution.blockedUpdateCategories || []),
            ...(locationResult.manualResolution.blockedUpdateCategories || [])
          ]);
          manualResolution.blockedUpdateCategories = [...categories];
        }
      }
      targetWarnings.push(...locationResult.warnings);

      if(locationResult.hit) {
        const hitDetail = locationResult.hit;

        const weaponDamage = weapon?.snapshot?.damage || "1d6";
        const damageRequest = {
          id: "damage",
          formula: weaponDamage
        };
        const damageRoll = roll(roller, damageRequest);

        const weaponAP = !!weapon?.snapshot?.ap;
        const armor = resolveArmor(weaponAP, targetSnapshotCopy, hitDetail.location, {
          cover: action?.cover || action?.options?.cover
        });
        const effectiveStoppingPower = armor.effectiveStoppingPower;

        const rawDamage = damageRoll.total;
        const armorMitigation = Math.min(rawDamage, effectiveStoppingPower);
        const penetratingDamageBeforeAP = rawDamage - armorMitigation;
        let penetratingDamage = penetratingDamageBeforeAP;

        if(armor.armorPiercing && penetratingDamage > 0) {
          penetratingDamage = Math.floor(penetratingDamage / 2);
        }

        const bodyTypeDamage = resolveBodyTypeDamage(penetratingDamage, resolveTargetBodyType(target));

        const stagedPenetration = buildStagedPenetrationEvidence({
          enabled: resolveStagedPenetrationEnabled(action, resolverOptions),
          penetrated: rawDamage > effectiveStoppingPower,
          armor,
          target
        });

        if(stagedPenetration.plannedUpdate) {
          const update = stagedPenetration.plannedUpdate.updates[0];
          const armorId = update._id;
          const updatePath = Object.keys(update).find(k => k !== "_id");

          const ablationKey = `${armorId}-${updatePath}`;
          accumulatedAblations[ablationKey] = {
            actorUuid: stagedPenetration.plannedUpdate.actorUuid,
            type: "Item",
            _id: armorId,
            updatePath,
            value: update[updatePath]
          };

          const armorItem = targetSnapshotCopy.equippedArmor?.find(a => a.id === armorId);
          if(armorItem) {
            const armorSystem = armorItem.system || armorItem;
            const coverageKey = Object.keys(armorSystem.coverage || {}).find(
              k => k.toLowerCase() === hitDetail.location.toLowerCase()
            );
            if(coverageKey) {
              if(!armorSystem.coverage[coverageKey]) {
                armorSystem.coverage[coverageKey] = {};
              }
              armorSystem.coverage[coverageKey].ablation = stagedPenetration.evidence.after;
            }
          } else {
            const cyberwareItem = targetSnapshotCopy.equippedCyberware?.find(c => c.id === armorId);
            if(cyberwareItem) {
              const cyberwareSystem = cyberwareItem.system || cyberwareItem;
              cyberwareSystem.ablation = stagedPenetration.evidence.after;
            }
          }
        }

        if(stagedPenetration.warning) {
          hitDetail.warnings.push(stagedPenetration.warning);
        }

        hitDetail.damageRoll = {
          id: damageRoll.id,
          formula: damageRoll.formula || damageRequest.formula,
          total: damageRoll.total,
          die: clonePlainData(damageRoll.die || {}),
          seed: damageRoll.seed
        };
        hitDetail.rawDamage = rawDamage;
        hitDetail.effectiveStoppingPower = effectiveStoppingPower;
        hitDetail.armorPiercing = armor.armorPiercing;
        hitDetail.armorMitigation = armorMitigation;
        hitDetail.penetratingDamage = penetratingDamage;
        hitDetail.armorPiercingEvidence = {
          ...(armor.armorPiercingEvidence || {}),
          penetratingDamageBeforeAP,
          penetratingDamageAfterAP: penetratingDamage
        };
        hitDetail.bodyTypeModifier = bodyTypeDamage.bodyTypeModifier;
        hitDetail.bodyTypeMitigation = bodyTypeDamage.bodyTypeMitigation;
        hitDetail.minimumDamageApplied = bodyTypeDamage.minimumDamageApplied;
        hitDetail.finalDamage = bodyTypeDamage.finalDamage;
        hitDetail.armor = armor;
        hitDetail.stagedPenetration = stagedPenetration.evidence;
        hitDetail.warnings.push(...armor.warnings);

        hits.push(hitDetail);
      }
    }

    for(const record of Object.values(accumulatedAblations)) {
      plannedUpdates.embeddedItemUpdates.push({
        actorUuid: record.actorUuid,
        type: "Item",
        updates: [
          {
            _id: record._id,
            [record.updatePath]: record.value
          }
        ]
      });
    }
  }

  return {
    target: clonePlainData(target),
    attack: {
      save: {
        roll: {
          id: saveRoll.id,
          formula: saveRoll.formula || saveRollRequest.formula,
          total: saveRoll.total,
          die: clonePlainData(saveRoll.die || {}),
          seed: saveRoll.seed
        },
        saveDC,
        passed: savePassed,
        margin: saveMargin
      }
    },
    hits,
    saves: [],
    plannedUpdates,
    manualResolution,
    warnings: targetWarnings
  };
}

/**
 * Resolve a melee or martial action — produces a CombatOutcome with opposed
 * roll resolution per target.
 *
 * @param {Object} context CombatActionContext with type "melee" or "martial".
 *   For "melee": context.weapon.snapshot.attackSkill is required (validated by guard).
 *   For "martial": context.action.meleeAction is required (validated by guard);
 *                  weapon.attackSkill is NOT required (skill comes from martial art selection).
 * @param {Object} [options] Reserved for future resolver options.
 * @param {Function} [roller] Deterministic roller for fixture support.
 * @returns {Object} CombatOutcome with opposed rolls per target.
 */
export function resolveMeleeAction(context, options = {}, roller = undefined) {
  const action = clonePlainData(context.action || {});
  const targets = (context.targets || []).map(target =>
    resolveMeleeTargetOutcome(target, context, options, roller)
  );
  const manualTargets = targets.filter(t => t.manualResolution?.required);

  // Collect per-target pendingDecisions into root pendingDecisions
  const allPending = targets
    .filter(t => Array.isArray(t.pendingDecisions))
    .flatMap(t => t.pendingDecisions);

  // Derive martialCategory directly from context action (not from targets —
  // category is determined by meleeAction alone, independent of target count)
  const meleeActionKey = String(context.action?.meleeAction || "").toLowerCase().trim();
  const martialCategory = context.action?.type === "martial"
    ? MARTIAL_ACTION_CLASSIFICATIONS[meleeActionKey] || "damageOnly"
    : undefined;

  return {
    action: {
      ...action,
      ...(martialCategory ? { martialCategory } : {})
    },
    attacker: clonePlainData(context.attacker || {}),
    weapon: clonePlainData(context.weapon || {}),
    targets,
    pendingDecisions: allPending,
    manualResolution: buildOutcomeManualResolution([
      ...manualTargets.map(t => t.manualResolution)
    ].filter(Boolean)),
    ammo: {},
    plannedUpdates: {
      itemUpdates: [],
      chatStatus: COMBAT_CHAT_STATUS.preview
    },
    chat: {
      status: COMBAT_CHAT_STATUS.preview
    },
    warnings: []
  };
}

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
  const targetWarnings = cloneArray(target.warnings);
  let manualResolution = target.manualResolution
    ? clonePlainData(target.manualResolution)
    : { required: false };

  // 1. Early exit for manual-resolution targets
  if (manualResolution.required) {
    return meleeManualTarget(target, manualResolution, targetWarnings);
  }

  // 2. Resolve attacker skill
  let attackSkill = context.weapon?.snapshot?.attackSkill;
  const isMartial = context.action?.type === "martial";
  if (isMartial) {
    attackSkill = context.action.options?.martialArt || "brawling";
  }
  if (!attackSkill) attackSkill = "melee";

  const attacker = context.attacker;
  const attackerRef = attacker?.snapshot?.stats?.ref?.total || 0;
  const attackerSkillLevel = getSkillValueCaseInsensitive(attacker?.snapshot?.skills, attackSkill);

  // 2a. Key technique bonus (martial arts only)
  const meleeAction = String(context.action?.meleeAction || "").toLowerCase().trim();
  const keyTechniqueBonus = isMartial ? getKeyTechniqueBonus(attackSkill, meleeAction) : 0;

  // 2b. Determine martial category
  const martialCategory = isMartial
    ? (MARTIAL_ACTION_CLASSIFICATIONS[meleeAction] || "damageOnly")
    : undefined;

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

  // 2c. Add key technique bonus to attack roll total
  attackRoll.keyTechniqueBonus = keyTechniqueBonus;
  attackRoll.total += keyTechniqueBonus;
  if (martialCategory !== undefined) {
    attackRoll.martialCategory = martialCategory;
  }

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
  let hit = !attackRoll.isFumble && attackRoll.total > defendRoll.total;
  let margin = hit ? attackRoll.total - defendRoll.total : 0;

  // 5. Damage resolution on hit (only for damageOnly martial actions or non-martial melee)
  let hits = [];
  const plannedUpdates = { embeddedItemUpdates: [], chatStatus: COMBAT_CHAT_STATUS.preview };
  let targetManualResolution = { required: false };

  const resolveDamage = hit && (!isMartial || martialCategory === "damageOnly");

  if (resolveDamage) {
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

  // 6. Prerequisite enforcement (martial actions with prerequisites)
  let targetPendingDecisions = [];
  if (isMartial) {
    const prereqs = getRequiresPrerequisite(attackSkill, meleeAction);
    if (prereqs && prereqs.length > 0 && martialCategory === "grappleFamily") {
      const prereqCheck = checkGrapplePrerequisites(target.snapshot, prereqs);

      if (prereqCheck.confirmed) {
        // Prerequisite is satisfied — suppress the pending decision
        // Action proceeds normally, no warning needed
      } else {
        // Prerequisite not confirmed — block the outcome with manual resolution
        const actionLabel = context.action?.meleeAction || meleeAction || "Unknown";
        targetPendingDecisions.push({
          reason: "prerequisite-check",
          message: `${actionLabel} requires ${prereqs.map(p => MARTIAL_PREREQ_LABELS[p.toLowerCase().trim()] || p).join(" or ")} — verify prerequisite is active before applying this outcome.`,
          action: meleeAction,
          requires: prereqs
        });

        // Override hit and margin — the opposed roll happened but the
        // outcome is blocked pending manual confirmation.
        hit = false;
        margin = 0;
        targetManualResolution = {
          ...targetManualResolution,
          required: true,
          reason: "prerequisite-unconfirmed",
          message: `${actionLabel} cannot be resolved: prerequisite ${prereqs.map(p => MARTIAL_PREREQ_LABELS[p.toLowerCase().trim()] || p).join(" or ")} is not confirmed on target ${target.name || target.actorUuid || "unknown"}. Verify grapple/hold state manually or set combatState.`,
          action: meleeAction,
          requires: prereqs,
          missing: prereqCheck.missing,
          combatState: target.snapshot?.combatState || {}
        };
      }
    } else if (prereqs && prereqs.length > 0) {
      // Non-grappleFamily actions (disarm, block/parry, dodge) still fire
      // pendingDecisions warnings but are NOT blocked by manual-resolution.
      const actionLabel = context.action?.meleeAction || meleeAction || "Unknown";
      targetPendingDecisions.push({
        reason: "prerequisite-check",
        message: `${actionLabel} requires ${prereqs.map(p => MARTIAL_PREREQ_LABELS[p.toLowerCase().trim()] || p).join(" or ")} — verify prerequisite is active before applying this outcome.`,
        action: meleeAction,
        requires: prereqs
      });
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
    warnings: targetWarnings,
    ...(targetPendingDecisions.length > 0 ? { pendingDecisions: targetPendingDecisions } : {})
  };
}

/**
 * Build a CombatHitRecord for one melee hit (mirrors damage section of buildTargetOutcome).
 */
function resolveMeleeHitDamage(hitLocationResult, context, target, options, roller, plannedUpdates) {
  const weapon = context.weapon?.snapshot || {};
  const targetSnapshot = target.snapshot || {};

  // Raw damage = weapon die + strengthDamageBonus(attacker BT)
  const attackerBT = context.attacker?.snapshot?.stats?.bt?.total || 0;
  const strengthBonus = strengthDamageBonus(attackerBT);
  const damageRequest = { id: "damage", formula: weapon.damage || "1d6" };
  const damageRoll = roll(roller, damageRequest);
  const rawDamage = Math.max(1, damageRoll.total + strengthBonus);

  // Armor (same pattern as ranged buildTargetOutcome)
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

  // Collect staged penetration updates (same pattern as buildTargetOutcome)
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
          ...(armor.armorPiercingEvidence || {}),
          penetratingDamageBeforeAP,
          penetratingDamageAfterAP: penetratingDamage
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

/**
 * Resolve defender's response skill for opposed melee.
 * Uses case-insensitive matching against defender snapshot skills.
 */
function resolveDefenderMeleeSkill(target, context, attackerAttackSkill) {
  const targetSkills = target.snapshot?.skills || {};
  const actionType = context?.action?.type || "melee";

  if (actionType === "martial") {
    // Martial arts: defender always uses Brawling
    const brawlingKey = Object.keys(targetSkills).find(k => k.toLowerCase() === "brawling");
    return brawlingKey || "Brawling";
  }

  // Melee: try matching skill, then brawling, then melee, then fencing
  const matchingKey = Object.keys(targetSkills).find(
    k => k.toLowerCase() === String(attackerAttackSkill || "").toLowerCase()
  );
  if (matchingKey) return matchingKey;

  const brawlingKey = Object.keys(targetSkills).find(k => k.toLowerCase() === "brawling");
  if (brawlingKey) return brawlingKey;

  const meleeKey = Object.keys(targetSkills).find(k => k.toLowerCase() === "melee");
  if (meleeKey) return meleeKey;

  return "Brawling"; // final fallback — resolves to level 0 if missing
}

/**
 * Normalize a melee/martial roll result — same as normalizeAttackRoll without ranged-specific fields.
 */
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

/**
 * Build a manual-resolution target outcome for melee.
 */
function meleeManualTarget(target, manualResolution, targetWarnings) {
  return {
    target: clonePlainData(target),
    attack: {},
    hits: [],
    saves: [],
    plannedUpdates: { embeddedItemUpdates: [], chatStatus: COMBAT_CHAT_STATUS.preview },
    manualResolution: clonePlainData(manualResolution) || { required: false },
    warnings: cloneArray(targetWarnings)
  };
}

/**
 * Get a skill's numeric value from a snapshot skills object, matching case-insensitively.
 */
function getSkillValueCaseInsensitive(skills = {}, skillName) {
  const lowerName = String(skillName || "").toLowerCase();
  for (const [key, value] of Object.entries(skills)) {
    if (key.toLowerCase() === lowerName) {
      return getSkillValue(value);
    }
  }
  return 0;
}

export function resolveBodyTypeDamage(penetratingDamage, bodyType) {
  const normalizedPenetratingDamage = normalizeDamageAmount(penetratingDamage);
  const bodyTypeModifier = btmFromBT(normalizeBodyType(bodyType));
  if(normalizedPenetratingDamage <= 0) {
    return {
      penetratingDamage: 0,
      bodyTypeModifier,
      bodyTypeMitigation: 0,
      finalDamage: 0,
      minimumDamageApplied: false
    };
  }

  const reducedDamage = normalizedPenetratingDamage - bodyTypeModifier;
  if(reducedDamage <= 0) {
    return {
      penetratingDamage: normalizedPenetratingDamage,
      bodyTypeModifier,
      bodyTypeMitigation: Math.max(0, normalizedPenetratingDamage - 1),
      finalDamage: 1,
      minimumDamageApplied: true
    };
  }

  return {
    penetratingDamage: normalizedPenetratingDamage,
    bodyTypeModifier,
    bodyTypeMitigation: bodyTypeModifier,
    finalDamage: reducedDamage,
    minimumDamageApplied: false
  };
}

function normalizeDamageAmount(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : 0;
}

function normalizeBodyType(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : 0;
}

function buildOutcomeManualResolution(manualResolutions) {
  if(manualResolutions.length === 0) {
    return {
      required: false
    };
  }

  const blockedUpdateCategories = new Set();
  for(const manualResolution of manualResolutions) {
    for(const category of manualResolution.blockedUpdateCategories || []) {
      blockedUpdateCategories.add(category);
    }
  }

  return {
    required: true,
    reason: MANUAL_RESOLUTION_REASON.missingRuleData,
    message: "One or more targets require manual resolution before this outcome can be committed.",
    blockedUpdateCategories: [...blockedUpdateCategories]
  };
}

function buildAmmoPlanning(weapon, roundsFired = 1) {
  const ammoState = normalizeAmmoState(weapon?.snapshot?.shotsLeft);
  const plannedUpdates = {
    itemUpdates: [],
    chatStatus: COMBAT_CHAT_STATUS.preview
  };

  if(!ammoState.valid) {
    return {
      ammo: {
        before: ammoState.evidence,
        delta: 0,
        after: ammoState.evidence,
        source: "weapon.snapshot.shotsLeft"
      },
      plannedUpdates,
      manualResolution: ammoManualResolution("Weapon ammo state is unavailable; resolve ammo manually."),
      warnings: [
        ammoWarning("missing-ammo-state", "Weapon ammo state is unavailable; resolve ammo manually.")
      ]
    };
  }

  const shotsLeft = ammoState.value;
  if(shotsLeft <= 0) {
    return {
      ammo: {
        before: shotsLeft,
        delta: 0,
        after: shotsLeft,
        source: "weapon.snapshot.shotsLeft"
      },
      plannedUpdates,
      manualResolution: ammoManualResolution("Weapon has insufficient ammo; resolve ammo manually."),
      warnings: [
        ammoWarning("insufficient-ammo", "Weapon has insufficient ammo; resolve ammo manually.")
      ]
    };
  }

  const actualRounds = Math.min(shotsLeft, roundsFired);
  const delta = -actualRounds;
  const after = shotsLeft - actualRounds;
  const ammo = {
    before: shotsLeft,
    delta,
    after,
    source: "weapon.snapshot.shotsLeft"
  };

  if(!weapon?.itemUuid) {
    return {
      ammo,
      plannedUpdates,
      manualResolution: ammoManualResolution("Attacking weapon item UUID is unavailable; resolve ammo manually."),
      warnings: [
        ammoWarning("missing-ammo-update-target", "Attacking weapon item UUID is unavailable; resolve ammo manually.")
      ]
    };
  }

  plannedUpdates.itemUpdates.push({
    itemUuid: weapon.itemUuid,
    update: {
      "system.shotsLeft": after
    }
  });

  return {
    ammo,
    plannedUpdates,
    warnings: []
  };
}

export function normalizeAmmoState(rawShotsLeft) {
  if(rawShotsLeft === undefined || rawShotsLeft === null) {
    return {
      valid: false,
      evidence: null
    };
  }

  if(typeof rawShotsLeft === "string" && rawShotsLeft.trim() === "") {
    return {
      valid: false,
      evidence: rawShotsLeft
    };
  }

  if(typeof rawShotsLeft === "boolean") {
    return {
      valid: false,
      evidence: rawShotsLeft
    };
  }

  const value = Number(rawShotsLeft);
  if(!Number.isFinite(value) || !Number.isInteger(value)) {
    return {
      valid: false,
      evidence: rawShotsLeft
    };
  }

  return {
    valid: true,
    value
  };
}

function ammoManualResolution(message) {
  return {
    required: true,
    reason: MANUAL_RESOLUTION_REASON.missingRuleData,
    message,
    blockedUpdateCategories: [...AMMO_BLOCKS]
  };
}

function ammoWarning(code, message) {
  return {
    code,
    severity: COMBAT_WARNING_SEVERITY.warning,
    message
  };
}

function buildTargetOutcome(target, attackRoll, targetNumber, action, weapon, roller, resolverOptions = {}, roundsFired = 1) {
  const margin = attackRoll.total - targetNumber;
  const hit = margin >= 0;
  const targetWarnings = cloneArray(target.warnings);
  let manualResolution = target.manualResolution
    ? clonePlainData(target.manualResolution)
    : { required: false };
  let hits = [];
  const plannedUpdates = {
    embeddedItemUpdates: [],
    chatStatus: COMBAT_CHAT_STATUS.preview
  };

  const fireMode = String(action.fireMode || "").toLowerCase();
  let burstHitsRoll = null;

  if(hit && !manualResolution.required) {
    let numHits = 1;
    if (fireMode === "threeroundburst") {
      const burstHitsRequest = {
        id: "burst_hits",
        formula: "1d3"
      };
      burstHitsRoll = roller(burstHitsRequest);
      numHits = Math.min(burstHitsRoll.total, roundsFired);
    } else if (fireMode === "fullauto") {
      numHits = Number.isFinite(roundsFired) && roundsFired > 0 ? Math.max(1, Math.min(roundsFired, margin)) : 0;
    }

    const targetSnapshotCopy = clonePlainData(target.snapshot || {});
    const accumulatedAblations = {};

    for (let i = 0; i < numHits; i++) {
      const hitAction = { ...action };
      if (i > 0) {
        hitAction.targetArea = undefined;
        if (hitAction.options) {
          hitAction.options = {
            ...hitAction.options,
            targetArea: undefined
          };
        }
      }

      const locationResult = resolveHitLocation(target, hitAction, roller);
      if(locationResult.manualResolution) {
        if (!manualResolution.required) {
          manualResolution = clonePlainData(locationResult.manualResolution);
        } else {
          const categories = new Set([
            ...(manualResolution.blockedUpdateCategories || []),
            ...(locationResult.manualResolution.blockedUpdateCategories || [])
          ]);
          manualResolution.blockedUpdateCategories = [...categories];
        }
      }
      targetWarnings.push(...locationResult.warnings);

      if(locationResult.hit) {
        const hitDetail = locationResult.hit;

        const damageRequest = {
          id: "damage",
          formula: weapon?.snapshot?.damage || "1d6"
        };
        const damageRoll = roller(damageRequest);

        const weaponAP = !!weapon?.snapshot?.ap;
        const armor = resolveArmor(weaponAP, targetSnapshotCopy, hitDetail.location, {
          cover: action.cover || action.options?.cover
        });
        const effectiveStoppingPower = armor.effectiveStoppingPower;

        const rawDamage = damageRoll.total;
        const armorMitigation = Math.min(rawDamage, effectiveStoppingPower);
        const penetratingDamageBeforeAP = rawDamage - armorMitigation;
        let penetratingDamage = penetratingDamageBeforeAP;

        if(armor.armorPiercing && penetratingDamage > 0) {
          penetratingDamage = Math.floor(penetratingDamage / 2);
        }

        const bodyTypeDamage = resolveBodyTypeDamage(penetratingDamage, resolveTargetBodyType(target));

        const stagedPenetration = buildStagedPenetrationEvidence({
          enabled: resolveStagedPenetrationEnabled(action, resolverOptions),
          penetrated: rawDamage > effectiveStoppingPower,
          armor,
          target
        });

        if(stagedPenetration.plannedUpdate) {
          const update = stagedPenetration.plannedUpdate.updates[0];
          const armorId = update._id;
          const updatePath = Object.keys(update).find(k => k !== "_id");

          const ablationKey = `${armorId}-${updatePath}`;
          accumulatedAblations[ablationKey] = {
            actorUuid: stagedPenetration.plannedUpdate.actorUuid,
            type: "Item",
            _id: armorId,
            updatePath,
            value: update[updatePath]
          };

          const armorItem = targetSnapshotCopy.equippedArmor?.find(a => a.id === armorId);
          if(armorItem) {
            const armorSystem = armorItem.system || armorItem;
            const coverageKey = Object.keys(armorSystem.coverage || {}).find(
              k => k.toLowerCase() === hitDetail.location.toLowerCase()
            );
            if(coverageKey) {
              if(!armorSystem.coverage[coverageKey]) {
                armorSystem.coverage[coverageKey] = {};
              }
              armorSystem.coverage[coverageKey].ablation = stagedPenetration.evidence.after;
            }
          } else {
            const cyberwareItem = targetSnapshotCopy.equippedCyberware?.find(c => c.id === armorId);
            if(cyberwareItem) {
              const cyberwareSystem = cyberwareItem.system || cyberwareItem;
              cyberwareSystem.ablation = stagedPenetration.evidence.after;
            }
          }
        }

        if(stagedPenetration.warning) {
          hitDetail.warnings.push(stagedPenetration.warning);
        }

        hitDetail.damageRoll = {
          id: damageRoll.id,
          formula: damageRoll.formula || damageRequest.formula,
          total: damageRoll.total,
          die: clonePlainData(damageRoll.die || {}),
          seed: damageRoll.seed
        };
        hitDetail.rawDamage = rawDamage;
        hitDetail.effectiveStoppingPower = effectiveStoppingPower;
        hitDetail.armorPiercing = armor.armorPiercing;
        hitDetail.armorMitigation = armorMitigation;
        hitDetail.penetratingDamage = penetratingDamage;
        hitDetail.armorPiercingEvidence = {
          ...(armor.armorPiercingEvidence || {}),
          penetratingDamageBeforeAP,
          penetratingDamageAfterAP: penetratingDamage
        };
        hitDetail.bodyTypeModifier = bodyTypeDamage.bodyTypeModifier;
        hitDetail.bodyTypeMitigation = bodyTypeDamage.bodyTypeMitigation;
        hitDetail.minimumDamageApplied = bodyTypeDamage.minimumDamageApplied;
        hitDetail.finalDamage = bodyTypeDamage.finalDamage;
        hitDetail.armor = armor;
        hitDetail.stagedPenetration = stagedPenetration.evidence;
        hitDetail.warnings.push(...armor.warnings);

        hits.push(hitDetail);
      }
    }

    for (const record of Object.values(accumulatedAblations)) {
      plannedUpdates.embeddedItemUpdates.push({
        actorUuid: record.actorUuid,
        type: record.type,
        updates: [
          {
            _id: record._id,
            [record.updatePath]: record.value
          }
        ]
      });
    }
  }

  return {
    target: clonePlainData(target),
    attack: {
      roll: clonePlainData(attackRoll),
      targetNumber,
      hit,
      margin,
      warnings: [],
      ...(burstHitsRoll ? { burstHitsRoll: clonePlainData(burstHitsRoll) } : {})
    },
    hits,
    saves: [],
    plannedUpdates,
    manualResolution,
    warnings: targetWarnings
  };
}

function resolveTargetBodyType(target) {
  return target.snapshot?.stats?.bt?.total ?? target.snapshot?.stats?.body?.total ?? 0;
}

function resolveStagedPenetrationEnabled(action, resolverOptions) {
  const configured = action.options?.stagedPenetration ?? action.stagedPenetration ?? resolverOptions.stagedPenetration;
  if(configured !== undefined) {
    return !!configured;
  }
  return true;
}

function buildStagedPenetrationEvidence({ enabled, penetrated, armor, target }) {
  if(!enabled) {
    return {
      evidence: {
        enabled: false,
        applied: false,
        reason: "disabled"
      }
    };
  }

  if(!penetrated) {
    return {
      evidence: {
        enabled: true,
        applied: false,
        reason: "no-penetration"
      }
    };
  }

  const affectedLayer = [...(armor.layers || [])].reverse().find(layer => {
    return layer.type === "armor" && layer.id && layer.updatePath;
  });

  if(!affectedLayer) {
    const message = "Staged penetration penetrated armor, but no item-backed armor coverage update path was available.";
    return {
      evidence: {
        enabled: true,
        applied: false,
        reason: "no-item-backed-armor"
      },
      warning: {
        code: "staged-penetration-no-update-target",
        severity: COMBAT_WARNING_SEVERITY.warning,
        message
      }
    };
  }

  if(!target.actorUuid) {
    const message = "Staged penetration penetrated armor, but target actor UUID is unavailable for an embedded item update.";
    return {
      evidence: {
        enabled: true,
        applied: false,
        reason: "missing-target-actor-uuid",
        itemId: affectedLayer.id,
        coverageKey: affectedLayer.coverageKey,
        updatePath: affectedLayer.updatePath
      },
      warning: {
        code: "staged-penetration-missing-actor-uuid",
        severity: COMBAT_WARNING_SEVERITY.warning,
        message
      }
    };
  }

  const before = Number(affectedLayer.ablation || 0);
  const after = before + 1;
  const update = {
    _id: affectedLayer.id,
    [affectedLayer.updatePath]: after
  };

  return {
    evidence: {
      enabled: true,
      applied: true,
      reason: "penetrated-item-backed-armor",
      itemId: affectedLayer.id,
      coverageKey: affectedLayer.coverageKey,
      updatePath: affectedLayer.updatePath,
      before,
      after
    },
    plannedUpdate: {
      actorUuid: target.actorUuid,
      type: "Item",
      updates: [update]
    }
  };
}

function resolveHitLocation(target, action, roller) {
  const hitLocations = target.snapshot?.hitLocations;
  if(action.targetArea) {
    const locationEntry = findHitLocationEntry(action.targetArea, hitLocations);
    return {
      hit: {
        location: action.targetArea,
        locationLabel: locationEntry?.label,
        locationRoll: {
          formula: "aimed location",
          location: action.targetArea
        },
        warnings: []
      },
      warnings: []
    };
  }

  if(!hitLocations || Object.keys(hitLocations).length === 0) {
    return missingHitLocationResult();
  }

  const locationRequest = {
    id: "location",
    formula: "1d10 hit location"
  };
  const locationRoll = normalizeLocationRoll(roll(roller, locationRequest), locationRequest);
  const location = mapLocation(locationRoll, hitLocations);

  if(!location) {
    return missingHitLocationResult();
  }

  return {
    hit: {
      location,
      locationLabel: hitLocations[location]?.label,
      locationRoll: {
        ...locationRoll,
        location
      },
      warnings: []
    },
    warnings: []
  };
}

function missingHitLocationResult() {
  return {
    manualResolution: {
      required: true,
      reason: MANUAL_RESOLUTION_REASON.missingRuleData,
      message: "Target hit-location model is unavailable; resolve hit location manually.",
      blockedUpdateCategories: [...MISSING_LOCATION_BLOCKS]
    },
    warnings: [
      {
        code: "missing-hit-location-model",
        severity: COMBAT_WARNING_SEVERITY.warning,
        message: "Target hit-location model is unavailable; resolve hit location manually."
      }
    ]
  };
}

function buildAttackRollRequest(context, modifierEvidence) {
  const attackSkill = context.weapon?.snapshot?.attackSkill;
  const attackSkillValue = attackSkill ? Number(getSkillValue(context.attacker?.snapshot?.skills?.[attackSkill])) || 0 : 0;
  const skillTerm = attackSkill ? `@attackSkillBonus` : undefined;
  const terms = [
    "1d10x10",
    "@stats.ref.total",
    skillTerm,
    ...modifierEvidence
      .filter(modifier => modifier.term && modifier.code !== "weaponAccuracy")
      .map(modifier => modifier.term),
    "@weapon.accuracy"
  ].filter(Boolean);

  return {
    id: "attack",
    formula: terms.join(" + "),
    terms,
    rollData: {
      stats: {
        ref: {
          total: Number(context.attacker?.snapshot?.stats?.ref?.total) || 0
        }
      },
      attackSkillBonus: attackSkillValue,
      modifier: Object.fromEntries(modifierEvidence.map(modifier => [modifier.code, Number.isFinite(modifier.value) ? modifier.value : 0])),
      weapon: {
        accuracy: Number(context.weapon?.snapshot?.accuracy) || 0
      }
    }
  };
}

function buildModifierEvidence(action, weapon) {
  const options = {
    ...(action.options || {}),
    targetArea: action.targetArea || action.options?.targetArea
  };
  const range = normalizeRange(action.range);
  const evidence = [
    {
      code: "range",
      label: "Range",
      value: range,
      targetNumber: rangeDCs[range] || action.targetNumber
    },
    {
      code: "fireMode",
      label: "Fire Mode",
      value: action.fireMode
    }
  ];

  for(const modifier of RANGED_MODIFIERS) {
    let value = modifier.value(options);
    if(!Number.isFinite(value)) value = 0;
    if(modifier.include(value)) {
      evidence.push({
        code: modifier.code,
        label: modifier.label,
        value,
        term: modifier.term
      });
    }
  }

  const fireMode = String(action.fireMode || "").toLowerCase();
  if (fireMode === "threeroundburst" && (range === ranges.close || range === ranges.medium)) {
    evidence.push({
      code: "threeRoundBurst",
      label: "Three-Round Burst",
      value: 3,
      term: "@modifier.threeRoundBurst"
    });
  } else if (fireMode === "fullauto") {
    const rawShotsLeft = normalizeAmmoState(weapon?.snapshot?.shotsLeft);
    const rof = Math.max(0, Number(weapon?.snapshot?.rof) || 0);
    const shotsLeft = rawShotsLeft.valid ? rawShotsLeft.value : rof;
    const bullets = action.roundsFiredPerTarget !== undefined ? action.roundsFiredPerTarget : Math.max(0, Math.min(shotsLeft, rof));

    let multiplier = 0;
    if (range === ranges.close) {
      multiplier = 1;
    } else if (range === ranges.pointBlank) {
      multiplier = 0;
    } else {
      multiplier = -1;
    }

    let value = multiplier * Math.floor(bullets / 10);
    if(!Number.isFinite(value)) value = 0;
    if(value !== 0) {
      evidence.push({
        code: "fullAuto",
        label: "Full Auto",
        value,
        term: "@modifier.fullAuto"
      });
    }
  }

  evidence.push({
    code: "weaponAccuracy",
    label: "Weapon Accuracy",
    value: Number(weapon?.snapshot?.accuracy) || 0,
    term: "@weapon.accuracy"
  });

  return evidence;
}

function normalizeAttackRoll(rollResult, request) {
  const die = clonePlainData(rollResult.die || {});
  const natural = die.natural;

  return {
    id: rollResult.id,
    formula: rollResult.formula || request.formula,
    terms: clonePlainData(rollResult.terms || request.terms),
    total: rollResult.total,
    die,
    seed: rollResult.seed,
    isCritical: rollResult.isCritical ?? natural === 10,
    isFumble: rollResult.isFumble ?? natural === 1
  };
}

function normalizeLocationRoll(rollResult, request) {
  return {
    id: rollResult.id,
    formula: rollResult.formula || request.formula,
    total: rollResult.total,
    die: clonePlainData(rollResult.die || {}),
    seed: rollResult.seed,
    ...(rollResult.location !== undefined ? { location: rollResult.location } : {})
  };
}

function mapLocation(locationRoll, hitLocations) {
  const requestedLocation = locationRoll.location || defaultAreaLookup[locationRoll.die?.natural] || defaultAreaLookup[locationRoll.total];
  return findHitLocationEntry(requestedLocation, hitLocations)?.key;
}

function findHitLocationEntry(requestedLocation, hitLocations = {}) {
  if(!requestedLocation) {
    return undefined;
  }

  const requested = String(requestedLocation).toLowerCase();
  const entry = Object.entries(hitLocations).find(([key, value]) => {
    return key.toLowerCase() === requested || String(value?.label || "").toLowerCase() === requested;
  });
  if(!entry) {
    return undefined;
  }
  return {
    key: entry[0],
    label: entry[1]?.label
  };
}

function roll(roller, request) {
  if(typeof roller !== "function") {
    throw new Error("Structured combat resolution requires a deterministic roller until Foundry rolling is wired.");
  }
  return roller(request);
}

function normalizeRange(range) {
  if(rangeDCs[range]) {
    return range;
  }
  return ranges[range] || range;
}

function getSkillValue(skill) {
  if(skill === undefined || skill === null) {
    return 0;
  }
  if(typeof skill === "number") {
    return skill;
  }
  return skill.total ?? skill.level ?? skill.value ?? 0;
}

function cloneArray(data) {
  return Array.isArray(data) ? clonePlainData(data) : [];
}

function clonePlainData(data) {
  if(data === undefined) {
    return undefined;
  }
  return JSON.parse(JSON.stringify(data));
}
