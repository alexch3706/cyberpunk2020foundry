const SAVE_PROMPT_WARNING_SEVERITY = "warning";

/**
 * Build pending Stun/Shock and Death Save prompts from plain target outcome data.
 *
 * This module deliberately has no Foundry dependency. It consumes the same
 * damage/wound evidence that state planning and chat already use.
 *
 * @param {Object} targetOutcome CombatTargetOutcome-like plain data.
 * @returns {{saves: Array<Object>, warnings: Array<Object>}}
 */
export function resolveSavePromptsForTarget(targetOutcome = {}) {
  if(targetOutcome?.manualResolution?.required) {
    return emptyResult();
  }

  if(targetOutcome?.attack && targetOutcome.attack.hit === false) {
    return emptyResult();
  }

  const damageEvidence = resolveDamageEvidence(targetOutcome);
  if(damageEvidence.warning) {
    return {
      saves: [],
      warnings: [damageEvidence.warning]
    };
  }

  const bodyType = resolveBodyType(targetOutcome);
  if(bodyType.warning) {
    return {
      saves: [],
      warnings: [bodyType.warning]
    };
  }

  const woundState = buildWoundState(damageEvidence.nextDamage);
  const saves = [];
  if(damageEvidence.damageDelta > 0) {
    saves.push(buildStunPrompt(bodyType.value, woundState, damageEvidence));
  }

  if(woundState.level >= 4) {
    saves.push(buildDeathPrompt(bodyType.value, woundState, damageEvidence));
  }

  return {
    saves,
    warnings: []
  };
}

function emptyResult() {
  return {
    saves: [],
    warnings: []
  };
}

function resolveDamageEvidence(targetOutcome) {
  if(targetOutcome?.damage) {
    const previousDamage = normalizeDamageValue(targetOutcome.damage.previousDamage);
    const nextDamage = normalizeDamageValue(targetOutcome.damage.nextDamage);
    const damageDelta = normalizeDamageValue(targetOutcome.damage.damageDelta);
    if(previousDamage === undefined || nextDamage === undefined || damageDelta === undefined) {
      return {
        warning: saveWarning("missing-target-damage-state", "Target damage state is unavailable; resolve Stun/Shock and Death Saves manually.")
      };
    }
    return {
      previousDamage,
      nextDamage,
      damageDelta
    };
  }

  const currentDamage = normalizeDamageValue(targetOutcome?.target?.snapshot?.damage);
  if(currentDamage === undefined) {
    return {
      warning: saveWarning("missing-target-damage-state", "Target damage state is unavailable; resolve Stun/Shock and Death Saves manually.")
    };
  }

  const damageDelta = sumHitWoundDamage(targetOutcome?.hits);
  if(damageDelta.invalid) {
    return {
      warning: saveWarning("invalid-wound-damage", "Wound damage must be a non-negative integer before Stun/Shock and Death Saves can be planned.")
    };
  }

  return {
    previousDamage: currentDamage,
    nextDamage: currentDamage + damageDelta.value,
    damageDelta: damageDelta.value
  };
}

function sumHitWoundDamage(hits = []) {
  if(!Array.isArray(hits)) {
    return { value: 0 };
  }
  let total = 0;
  for(const hit of hits) {
    const value = hit?.woundDamage ?? hit?.finalDamage;
    if(value === undefined || value === null || value === "") {
      continue;
    }
    const damage = Number(value);
    if(!Number.isFinite(damage) || damage < 0 || !Number.isInteger(damage)) {
      return { invalid: true };
    }
    total += damage;
  }
  return { value: total };
}

function resolveBodyType(targetOutcome) {
  const value = targetOutcome?.target?.snapshot?.stats?.bt?.total
    ?? targetOutcome?.target?.snapshot?.stats?.body?.total;
  const bodyType = Number(value);
  if(!Number.isFinite(bodyType) || bodyType <= 0 || !Number.isInteger(bodyType)) {
    return {
      warning: saveWarning("missing-target-body-type", "Target Body Type is unavailable; resolve Stun/Shock and Death Saves manually.")
    };
  }
  return { value: bodyType };
}

function buildStunPrompt(bodyType, woundState, damageEvidence) {
  const penalty = stunPenaltyForWoundState(woundState.level);
  const threshold = Math.max(1, bodyType - penalty);
  return {
    type: "stun",
    status: "pending",
    reason: "damage-taken",
    bodyType,
    threshold,
    targetNumber: threshold,
    penalty,
    woundState,
    evidence: cloneDamageEvidence(damageEvidence)
  };
}

function buildDeathPrompt(bodyType, woundState, damageEvidence) {
  const mortalLevel = mortalLevelForWoundState(woundState.level);
  const recurring = damageEvidence.damageDelta <= 0;
  const threshold = Math.max(1, bodyType - mortalLevel);
  return {
    type: "death",
    status: "pending",
    reason: recurring ? "recurring-mortal-save" : "mortal-wound",
    bodyType,
    threshold,
    targetNumber: threshold,
    penalty: mortalLevel,
    mortalLevel,
    woundState,
    ...(recurring ? {
      reminder: {
        recurring: true,
        requiresStabilization: true
      }
    } : {}),
    evidence: cloneDamageEvidence(damageEvidence)
  };
}

function stunPenaltyForWoundState(level) {
  if(level <= 1) {
    return 0;
  }
  return level - 1;
}

function mortalLevelForWoundState(level) {
  return Math.max(0, level - 4);
}

function buildWoundState(damage) {
  const level = damage <= 0 ? 0 : Math.ceil(damage / 4);
  return {
    level,
    label: woundStateLabel(level)
  };
}

function woundStateLabel(level) {
  if(level === 0) {
    return "Uninjured";
  }
  if(level === 1) {
    return "Light";
  }
  if(level === 2) {
    return "Serious";
  }
  if(level === 3) {
    return "Critical";
  }
  return `Mortal ${level - 4}`;
}

function normalizeDamageValue(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue >= 0 ? numericValue : undefined;
}

function cloneDamageEvidence(damageEvidence) {
  return {
    previousDamage: damageEvidence.previousDamage,
    nextDamage: damageEvidence.nextDamage,
    damageDelta: damageEvidence.damageDelta
  };
}

function saveWarning(code, message) {
  return {
    code,
    severity: SAVE_PROMPT_WARNING_SEVERITY,
    message
  };
}
