import { COMBAT_CHAT_STATUS } from "./combat-outcome.js";
import { resolveSavePromptsForTarget } from "./save-resolver.js";

export const STATE_PLAN_WARNING_SEVERITY = Object.freeze({
  warning: "warning",
  error: "error"
});

const WOUND_STATE_LABELS = Object.freeze([
  "Uninjured",
  "Light",
  "Serious",
  "Critical"
]);
const LIMB_LOCATION_KEYS = Object.freeze(["larm", "rarm", "lleg", "rleg", "leftarm", "rightarm", "leftleg", "rightleg", "arm", "leg"]);
const WOUND_SPECIAL_CASE_CODES = Object.freeze([
  "head-hit-double-damage",
  "head-critical-injury",
  "limb-loss-threshold"
]);

/**
 * Normalize planned combat state changes without committing them.
 *
 * @param {Object} outcome CombatOutcome-like plain data.
 * @param {Object} [options] Planner options.
 * @param {string} [options.chatStatus] Explicit chat status override.
 * @returns {Object} PlannedCombatUpdates-compatible plain object.
 */
export function planCombatUpdates(outcome = {}, options = {}) {
  const plan = createEmptyPlan(outcome?.plannedUpdates?.chatStatus);

  collectPlannedUpdates(plan, outcome?.plannedUpdates);
  collectDeltaUpdates(plan, outcome);

  for(const targetOutcome of outcome?.targets || []) {
    collectPlannedUpdates(plan, targetOutcome?.plannedUpdates);
    collectDeltaUpdates(plan, targetOutcome);
    collectWoundUpdates(plan, targetOutcome);
    collectSavePrompts(plan, targetOutcome);
  }

  if(options.chatStatus) {
    plan.chatStatus = options.chatStatus;
  }

  return plan;
}

function collectWoundUpdates(plan, targetOutcome) {
  if(targetOutcome?.manualResolution?.required) {
    return;
  }

  for(const hit of targetOutcome?.hits || []) {
    clearDerivedWoundFields(hit);
  }

  const actorUuid = targetOutcome?.target?.actorUuid;
  const currentDamage = normalizeDamageValue(targetOutcome?.target?.snapshot?.damage);
  if(!actorUuid || currentDamage === undefined) {
    warnForUnplannedWoundHits(plan, targetOutcome?.hits);
    return;
  }

  let runningDamage = currentDamage;
  let totalDamageDelta = 0;
  for(const hit of targetOutcome?.hits || []) {
    const woundApplication = buildHitWoundApplication(hit, runningDamage, plan);
    if(!woundApplication) {
      continue;
    }

    hit.woundDamage = woundApplication.damageDelta;
    if(woundApplication.specialCases.length > 0) {
      hit.specialCases = mergeSpecialCases(hit.specialCases, woundApplication.specialCases);
    }
    hit.woundTransition = buildWoundTransition(runningDamage, woundApplication.nextDamage, woundApplication.damageDelta);
    if(woundApplication.warning) {
      hit.warnings = addUniqueWarning(hit.warnings, woundApplication.warning);
    }

    runningDamage = woundApplication.nextDamage;
    totalDamageDelta += woundApplication.damageDelta;
  }

  if(totalDamageDelta <= 0) {
    return;
  }

  targetOutcome.damage = buildWoundTransition(currentDamage, runningDamage, totalDamageDelta);
  addActorUpdates(plan, [
    {
      actorUuid,
      update: {
        "system.damage": runningDamage
      }
    }
  ]);
}

function collectSavePrompts(plan, targetOutcome) {
  if(!targetOutcome || !targetOutcome?.target?.actorUuid) {
    return;
  }
  targetOutcome.saves = [];
  if(cannotResolveTargetSaves(targetOutcome)) {
    return;
  }
  const result = resolveSavePromptsForTarget(targetOutcome);
  targetOutcome.saves = result.saves;
  for(const warning of result.warnings) {
    addWarning(plan, warning.code, warning.message);
  }
}

function cannotResolveTargetSaves(targetOutcome) {
  return !targetOutcome.damage && (
    normalizeDamageValue(targetOutcome?.target?.snapshot?.damage) === undefined
    || (Array.isArray(targetOutcome?.hits) && targetOutcome.hits.some(hit => readWoundDamage(hit).invalid))
  );
}

function clearDerivedWoundFields(hit) {
  if(!hit) {
    return;
  }
  delete hit.woundDamage;
  delete hit.woundTransition;
  if(Array.isArray(hit.specialCases)) {
    const retainedCases = hit.specialCases.filter(specialCase => !WOUND_SPECIAL_CASE_CODES.includes(specialCase?.code));
    if(retainedCases.length > 0) {
      hit.specialCases = retainedCases;
    }
    else {
      delete hit.specialCases;
    }
  }
  if(Array.isArray(hit.warnings)) {
    const retainedWarnings = hit.warnings.filter(warning => !WOUND_SPECIAL_CASE_CODES.includes(warning?.code));
    hit.warnings = retainedWarnings;
  }
}

function warnForUnplannedWoundHits(plan, hits = []) {
  let hasPositiveWoundDamage = false;
  for(const hit of hits) {
    const damage = readWoundDamage(hit);
    if(damage.invalid) {
      addWarning(plan, "invalid-wound-damage", "Wound damage must be a non-negative integer before it can be planned.");
      continue;
    }
    if(damage.value > 0) {
      hasPositiveWoundDamage = true;
    }
  }
  if(hasPositiveWoundDamage) {
    addWarning(plan, "missing-target-damage-state", "Target damage state is unavailable; resolve target damage manually before committing wound updates.");
  }
}

function addUniqueWarning(warnings = [], warning) {
  if(warnings.some(existing => existing?.code === warning.code)) {
    return warnings;
  }
  return [...warnings, warning];
}

function buildHitWoundApplication(hit, currentDamage, plan) {
  const finalDamage = readWoundDamage(hit);
  if(finalDamage.invalid) {
    addWarning(plan, "invalid-wound-damage", "Wound damage must be a non-negative integer before it can be planned.");
    return undefined;
  }
  if(!finalDamage.value || finalDamage.value <= 0) {
    return undefined;
  }

  const specialCases = [];
  let damageDelta = finalDamage.value;
  if(isHeadHit(hit)) {
    damageDelta = finalDamage.value * 2;
    specialCases.push({
      code: "head-hit-double-damage",
      damageMultiplier: 2,
      damageBeforeMultiplier: finalDamage.value,
      damageAfterMultiplier: damageDelta
    });
  }

  const warning = buildSpecialDamageWarning(hit, damageDelta, specialCases);
  return {
    damageDelta,
    nextDamage: currentDamage + damageDelta,
    specialCases,
    warning
  };
}

function readWoundDamage(hit) {
  if(hit?.finalDamage === undefined || hit?.finalDamage === null || hit?.finalDamage === "") {
    return { value: 0 };
  }
  const numericValue = Number(hit.finalDamage);
  if(!Number.isFinite(numericValue) || numericValue < 0 || !Number.isInteger(numericValue)) {
    return { invalid: true };
  }
  return { value: numericValue };
}

function buildSpecialDamageWarning(hit, woundDamage, specialCases) {
  if(woundDamage <= 8) {
    return undefined;
  }

  if(isHeadHit(hit)) {
    specialCases.push({
      code: "head-critical-injury",
      threshold: 8,
      woundDamage
    });
    return {
      code: "head-critical-injury",
      severity: STATE_PLAN_WARNING_SEVERITY.warning,
      message: "Head hit exceeded 8 damage in one attack; target is killed automatically unless the referee overrides the special case."
    };
  }

  if(isLimbHit(hit)) {
    specialCases.push({
      code: "limb-loss-threshold",
      threshold: 8,
      woundDamage
    });
    return {
      code: "limb-loss-threshold",
      severity: STATE_PLAN_WARNING_SEVERITY.warning,
      message: "Limb hit exceeded 8 damage in one attack; limb is severed or crushed and requires follow-up resolution."
    };
  }

  return undefined;
}

function mergeSpecialCases(existingCases = [], woundCases = []) {
  const mergedCases = Array.isArray(existingCases) ? [...existingCases] : [];
  for(const woundCase of woundCases) {
    if(!mergedCases.some(existingCase => existingCase?.code === woundCase.code)) {
      mergedCases.push(woundCase);
    }
  }
  return mergedCases;
}

function buildWoundTransition(previousDamage, nextDamage, damageDelta) {
  const previousWoundState = buildWoundState(previousDamage);
  const nextWoundState = buildWoundState(nextDamage);
  return {
    previousDamage,
    damageDelta,
    nextDamage,
    previousWoundState,
    nextWoundState,
    crossedThreshold: previousWoundState.level !== nextWoundState.level
  };
}

function buildWoundState(damage) {
  const level = damage <= 0 ? 0 : Math.ceil(damage / 4);
  return {
    level,
    label: woundStateLabel(level)
  };
}

function woundStateLabel(level) {
  if(level < WOUND_STATE_LABELS.length) {
    return WOUND_STATE_LABELS[level];
  }
  return `Mortal ${level - 4}`;
}

function normalizeDamageValue(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue >= 0 ? numericValue : undefined;
}

function normalizeLocationKey(location) {
  return String(location || "").toLowerCase().replace(/[^a-z]/g, "");
}

function locationKeysForHit(hit) {
  return [
    hit?.location,
    hit?.locationLabel,
    hit?.locationKey,
    hit?.location?.key,
    hit?.location?.label
  ].map(normalizeLocationKey).filter(Boolean);
}

function isHeadHit(hit) {
  return locationKeysForHit(hit).includes("head");
}

function isLimbHit(hit) {
  return locationKeysForHit(hit).some(location => LIMB_LOCATION_KEYS.includes(location));
}

function createEmptyPlan(chatStatus = COMBAT_CHAT_STATUS.preview) {
  return {
    actorUpdates: [],
    itemUpdates: [],
    embeddedItemUpdates: [],
    chatStatus,
    warnings: []
  };
}

function collectPlannedUpdates(plan, plannedUpdates) {
  if(!plannedUpdates) {
    return;
  }

  if(plannedUpdates.chatStatus) {
    plan.chatStatus = plannedUpdates.chatStatus;
  }

  addActorUpdates(plan, plannedUpdates.actorUpdates);
  addItemUpdates(plan, plannedUpdates.itemUpdates);
  addEmbeddedItemUpdates(plan, plannedUpdates.embeddedItemUpdates);
}

function collectDeltaUpdates(plan, source) {
  addActorUpdates(plan, source?.actorDeltas);
  addItemUpdates(plan, source?.itemDeltas);
  addEmbeddedItemUpdates(plan, source?.embeddedItemDeltas);
}

function addActorUpdates(plan, updates = []) {
  for(const entry of updates) {
    if(!entry?.actorUuid || !entry.update) {
      addWarning(plan, "invalid-actor-update", "Actor update plan requires actorUuid and update payload.");
      continue;
    }
    mergeDocumentUpdate(plan.actorUpdates, "actorUuid", entry, plan);
  }
}

function addItemUpdates(plan, updates = []) {
  for(const entry of updates) {
    if(!entry?.itemUuid || !entry.update) {
      addWarning(plan, "invalid-item-update", "Item update plan requires itemUuid and update payload.");
      continue;
    }
    mergeDocumentUpdate(plan.itemUpdates, "itemUuid", entry, plan);
  }
}

function addEmbeddedItemUpdates(plan, batches = []) {
  for(const batch of batches) {
    if(!batch?.actorUuid || !batch.type || !Array.isArray(batch.updates)) {
      addWarning(plan, "invalid-embedded-item-update", "Embedded item update plan requires actorUuid, type, and updates array.");
      continue;
    }

    const existing = plan.embeddedItemUpdates.find(entry => entry.actorUuid === batch.actorUuid && entry.type === batch.type);
    const clonedUpdates = clonePlainData(batch.updates, plan, "unserializable-embedded-item-update");
    if(!clonedUpdates) {
      continue;
    }
    if(existing && hasEmbeddedUpdateConflict(existing.updates, clonedUpdates)) {
      addWarning(plan, "conflicting-embedded-update-path", `Conflicting embedded item update for ${batch.type} on actor ${batch.actorUuid}.`);
      plan.embeddedItemUpdates.push({
        actorUuid: batch.actorUuid,
        type: batch.type,
        updates: clonedUpdates
      });
      continue;
    }
    if(existing) {
      existing.updates.push(...clonedUpdates);
    }
    else {
      plan.embeddedItemUpdates.push({
        actorUuid: batch.actorUuid,
        type: batch.type,
        updates: clonedUpdates
      });
    }
  }
}

function mergeDocumentUpdate(collection, uuidKey, entry, plan) {
  const existing = collection.find(candidate => candidate[uuidKey] === entry[uuidKey]);
  if(!existing) {
    const clonedUpdate = clonePlainData(entry.update, plan, "unserializable-update-payload");
    if(!clonedUpdate) {
      return;
    }
    collection.push({
      [uuidKey]: entry[uuidKey],
      update: clonedUpdate
    });
    return;
  }

  const merged = { ...existing.update };
  for(const [path, value] of Object.entries(entry.update)) {
    if(hasConflictingUpdatePath(merged, path, value)) {
      addWarning(plan, "conflicting-update-path", `Conflicting update for ${uuidKey}:${entry[uuidKey]} at ${path}.`);
      const clonedUpdate = clonePlainData(entry.update, plan, "unserializable-update-payload");
      if(!clonedUpdate) {
        return;
      }
      collection.push({
        [uuidKey]: entry[uuidKey],
        update: clonedUpdate
      });
      return;
    }
    const clonedValue = clonePlainData(value, plan, "unserializable-update-value");
    if(clonedValue === undefined) {
      continue;
    }
    merged[path] = clonedValue;
  }
  existing.update = merged;
}

function hasConflictingUpdatePath(update, path, value) {
  for(const [existingPath, existingValue] of Object.entries(update)) {
    if(!pathsOverlap(existingPath, path)) {
      continue;
    }
    if(existingPath === path && isEqualPlainData(existingValue, value)) {
      continue;
    }
    return true;
  }
  return false;
}

function pathsOverlap(left, right) {
  return left === right || left.startsWith(`${right}.`) || right.startsWith(`${left}.`);
}

function hasEmbeddedUpdateConflict(existingUpdates, incomingUpdates) {
  for(const existing of existingUpdates) {
    for(const incoming of incomingUpdates) {
      if(!existing?._id || existing._id !== incoming?._id) {
        continue;
      }
      for(const [path, value] of Object.entries(incoming)) {
        if(path === "_id") {
          continue;
        }
        if(hasConflictingUpdatePath(stripEmbeddedId(existing), path, value)) {
          return true;
        }
      }
    }
  }
  return false;
}

function stripEmbeddedId(update) {
  const stripped = { ...update };
  delete stripped._id;
  return stripped;
}

function addWarning(plan, code, message) {
  if(plan.warnings.some(warning => warning.code === code && warning.message === message)) {
    return;
  }
  plan.warnings.push({
    code,
    severity: STATE_PLAN_WARNING_SEVERITY.warning,
    message
  });
}

function clonePlainData(data, plan, warningCode) {
  if(data === null) {
    return null;
  }
  if(!isJsonSafePlainData(data)) {
    if(plan && warningCode) {
      addWarning(plan, warningCode, "State planner only accepts JSON-serializable plain data.");
    }
    return undefined;
  }
  try {
    return JSON.parse(JSON.stringify(data));
  }
  catch {
    if(plan && warningCode) {
      addWarning(plan, warningCode, "State planner only accepts JSON-serializable plain data.");
    }
    return undefined;
  }
}

function isJsonSafePlainData(data, seen = new Set()) {
  if(data === null) {
    return true;
  }
  if(data === undefined) {
    return false;
  }
  const valueType = typeof data;
  if(valueType === "function" || valueType === "symbol" || valueType === "bigint") {
    return false;
  }
  if(valueType === "number") {
    return Number.isFinite(data);
  }
  if(valueType !== "object") {
    return true;
  }
  if(seen.has(data)) {
    return false;
  }

  seen.add(data);
  const values = Array.isArray(data) ? data : Object.values(data);
  const isSafe = values.every(value => isJsonSafePlainData(value, seen));
  seen.delete(data);
  return isSafe;
}

function isEqualPlainData(left, right) {
  try {
    return JSON.stringify(sortPlainData(left)) === JSON.stringify(sortPlainData(right));
  }
  catch {
    return false;
  }
}

function sortPlainData(data) {
  if(Array.isArray(data)) {
    return data.map(value => sortPlainData(value));
  }
  if(data && typeof data === "object") {
    return Object.keys(data).sort().reduce((sorted, key) => {
      sorted[key] = sortPlainData(data[key]);
      return sorted;
    }, {});
  }
  return data;
}
