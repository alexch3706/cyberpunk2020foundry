import { defaultAreaLookup, rangeDCs, ranges, btmFromBT } from "../lookups.js";
import { COMBAT_CHAT_STATUS, COMBAT_WARNING_SEVERITY, MANUAL_RESOLUTION_REASON } from "./combat-outcome.js";
import { resolveArmor } from "./armor-resolver.js";

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

export function resolveSingleShotRangedAttack(context, options = {}, roller = undefined) {
  const action = clonePlainData(context.action || {});
  action.targetArea = action.targetArea || action.options?.targetArea;
  const range = normalizeRange(action.range);
  const targetNumber = rangeDCs[range] || action.targetNumber;
  const modifierEvidence = buildModifierEvidence(action, context.weapon);
  const attackRequest = buildAttackRollRequest(context, modifierEvidence);
  const attackRoll = normalizeAttackRoll(roll(roller, attackRequest), attackRequest);

  const targets = (context.targets || []).map(target => buildTargetOutcome(target, attackRoll, targetNumber, action, context.weapon, roller));
  const manualTargets = targets.filter(target => target.manualResolution?.required);
  const ammoPlanning = buildAmmoPlanning(context.weapon);

  return {
    action: {
      ...action,
      range,
      modifiers: modifierEvidence
    },
    attacker: clonePlainData(context.attacker || {}),
    weapon: clonePlainData(context.weapon || {}),
    targets,
    pendingDecisions: [],
    manualResolution: buildOutcomeManualResolution([
      ...manualTargets.map(target => target.manualResolution),
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

function buildAmmoPlanning(weapon) {
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

  const after = shotsLeft - 1;
  const ammo = {
    before: shotsLeft,
    delta: -1,
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

function normalizeAmmoState(rawShotsLeft) {
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

function buildTargetOutcome(target, attackRoll, targetNumber, action, weapon, roller) {
  const margin = attackRoll.total - targetNumber;
  const hit = margin >= 0;
  const targetWarnings = cloneArray(target.warnings);
  let manualResolution = target.manualResolution
    ? clonePlainData(target.manualResolution)
    : { required: false };
  let hits = [];

  if(hit && !manualResolution.required) {
    const locationResult = resolveHitLocation(target, action, roller);
    if(locationResult.manualResolution) {
      manualResolution = locationResult.manualResolution;
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
      const armor = resolveArmor(weaponAP, target.snapshot, hitDetail.location);
      const effectiveStoppingPower = armor.effectiveStoppingPower;

      const rawDamage = damageRoll.total;
      const armorMitigation = Math.min(rawDamage, effectiveStoppingPower);
      let penetratingDamage = rawDamage - armorMitigation;

      if(armor.armorPiercing && penetratingDamage > 0) {
        penetratingDamage = Math.floor(penetratingDamage / 2);
      }

      const bodyTypeMitigation = btmFromBT(target.snapshot?.stats?.body?.total || 0);

      let finalDamage = 0;
      if (rawDamage > effectiveStoppingPower) {
        finalDamage = Math.max(1, penetratingDamage - bodyTypeMitigation);
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
      hitDetail.bodyTypeMitigation = bodyTypeMitigation;
      hitDetail.finalDamage = finalDamage;
      hitDetail.armor = armor;

      hits = [hitDetail];
    }
  }

  return {
    target: clonePlainData(target),
    attack: {
      roll: clonePlainData(attackRoll),
      targetNumber,
      hit,
      margin,
      warnings: []
    },
    hits,
    saves: [],
    manualResolution,
    warnings: targetWarnings
  };
}

function resolveHitLocation(target, action, roller) {
  if(action.targetArea) {
    return {
      hit: {
        location: action.targetArea,
        locationRoll: {
          formula: "aimed location",
          location: action.targetArea
        },
        warnings: []
      },
      warnings: []
    };
  }

  const hitLocations = target.snapshot?.hitLocations;
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
  const skillTerm = attackSkill ? `@skill.${attackSkill}` : undefined;
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
          total: context.attacker?.snapshot?.stats?.ref?.total || 0
        }
      },
      skill: {
        ...(attackSkill ? { [attackSkill]: getSkillValue(context.attacker?.snapshot?.skills?.[attackSkill]) } : {})
      },
      modifier: Object.fromEntries(modifierEvidence.map(modifier => [modifier.code, modifier.value])),
      weapon: {
        accuracy: Number(context.weapon?.snapshot?.accuracy || 0)
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
    const value = modifier.value(options);
    if(modifier.include(value)) {
      evidence.push({
        code: modifier.code,
        label: modifier.label,
        value,
        term: modifier.term
      });
    }
  }

  evidence.push({
    code: "weaponAccuracy",
    label: "Weapon Accuracy",
    value: Number(weapon?.snapshot?.accuracy || 0),
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
    seed: rollResult.seed
  };
}

function mapLocation(locationRoll, hitLocations) {
  const requestedLocation = locationRoll.location || defaultAreaLookup[locationRoll.die?.natural] || defaultAreaLookup[locationRoll.total];
  if(!requestedLocation) {
    return undefined;
  }

  const requested = String(requestedLocation).toLowerCase();
  return Object.entries(hitLocations).find(([key, value]) => {
    return key.toLowerCase() === requested || String(value?.label || "").toLowerCase() === requested;
  })?.[0];
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
