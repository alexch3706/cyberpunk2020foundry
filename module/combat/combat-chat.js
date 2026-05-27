import { COMBAT_CHAT_STATUS, COMBAT_WARNING_SEVERITY } from "./combat-outcome.js";
import { planCombatUpdates } from "./state-planner.js";

const VALID_CHAT_STATUSES = Object.freeze(Object.values(COMBAT_CHAT_STATUS));

/**
 * Build plain template data for structured combat chat.
 *
 * This module deliberately does not render templates or create ChatMessages.
 * Runtime code can pass the returned object to a Foundry template later.
 *
 * @param {Object} outcome CombatOutcome-like plain data.
 * @param {Object=} plannedUpdates PlannedCombatUpdates-like plain data. If omitted, derived from outcome.
 * @param {Object} [options] Chat data options.
 * @param {string} [options.status] Explicit chat status override.
 * @returns {Object} Plain chat template data.
 */
export function buildCombatChatData(outcome = {}, plannedUpdates = undefined, options = {}) {
  const plan = plannedUpdates || planCombatUpdates(outcome);
  const warnings = [];
  const status = deriveChatStatus(outcome, plan, options, warnings);

  return {
    status,
    ...buildStatusFlags(status),
    action: clonePlainData(outcome.action || {}),
    attacker: extractActorRef(outcome.attacker),
    weapon: extractWeaponRef(outcome.weapon),
    ammo: clonePlainData(outcome.ammo || {}),
    plannedUpdates: summarizePlannedUpdates(plan),
    manualResolution: normalizeManualResolution(outcome.manualResolution),
    warnings: [
      ...cloneArray(outcome.warnings),
      ...warnings
    ],
    pendingDecisions: cloneArray(outcome.pendingDecisions),
    targets: (outcome.targets || []).map(targetOutcome => buildTargetChatData(targetOutcome, status))
  };
}

function deriveChatStatus(outcome, plannedUpdates, options, warnings) {
  const candidates = [
    { source: "options.status", value: options?.status },
    { source: "plannedUpdates.chatStatus", value: plannedUpdates?.chatStatus },
    { source: "outcome.chat.status", value: outcome?.chat?.status }
  ];

  for(const candidate of candidates) {
    if(candidate.value === undefined || candidate.value === null) {
      continue;
    }
    if(isValidChatStatus(candidate.value)) {
      return candidate.value;
    }
    warnings.push({
      code: "invalid-chat-status",
      severity: COMBAT_WARNING_SEVERITY.warning,
      message: `Ignored invalid chat status '${candidate.value}' from ${candidate.source}.`
    });
  }

  return hasManualResolution(outcome) ? COMBAT_CHAT_STATUS.manual : COMBAT_CHAT_STATUS.preview;
}

function isValidChatStatus(status) {
  return VALID_CHAT_STATUSES.includes(status);
}

function hasManualResolution(outcome) {
  return !!outcome?.manualResolution?.required || (outcome?.targets || []).some(targetOutcome => !!targetOutcome?.manualResolution?.required);
}

function buildStatusFlags(status) {
  return {
    isPreview: status === COMBAT_CHAT_STATUS.preview,
    isManual: status === COMBAT_CHAT_STATUS.manual,
    isCommitted: status === COMBAT_CHAT_STATUS.committed,
    isCanceled: status === COMBAT_CHAT_STATUS.canceled
  };
}

function buildTargetChatData(targetOutcome, inheritedStatus) {
  const targetStatus = targetOutcome?.manualResolution?.required ? COMBAT_CHAT_STATUS.manual : inheritedStatus;

  return {
    target: extractActorRef(targetOutcome?.target),
    status: targetStatus,
    attack: buildAttackChatData(targetOutcome?.attack),
    hits: (targetOutcome?.hits || []).map(buildHitChatData),
    saves: cloneArray(targetOutcome?.saves),
    plannedUpdates: summarizePlannedUpdates(targetOutcome?.plannedUpdates),
    manualResolution: normalizeManualResolution(targetOutcome?.manualResolution),
    warnings: cloneArray(targetOutcome?.warnings)
  };
}

function buildAttackChatData(attack = {}) {
  return compactPlainObject({
    total: attack?.roll?.total,
    formula: attack?.roll?.formula,
    die: clonePlainData(attack?.roll?.die),
    targetNumber: attack?.targetNumber,
    opposedRoll: clonePlainData(attack?.opposedRoll),
    hit: attack?.hit,
    margin: attack?.margin,
    warnings: cloneArray(attack?.warnings)
  });
}

function buildHitChatData(hit = {}) {
  return compactPlainObject({
    location: hit.location,
    rawDamage: hit.rawDamage,
    effectiveStoppingPower: hit.effectiveStoppingPower,
    armorPiercing: hit.armorPiercing,
    armorMitigation: hit.armorMitigation,
    penetratingDamage: hit.penetratingDamage,
    armorPiercingEvidence: clonePlainData(hit.armorPiercingEvidence),
    armor: clonePlainData(hit.armor),
    stagedPenetration: clonePlainData(hit.stagedPenetration),
    bodyTypeModifier: hit.bodyTypeModifier,
    bodyTypeMitigation: hit.bodyTypeMitigation,
    minimumDamageApplied: hit.minimumDamageApplied,
    finalDamage: hit.finalDamage,
    woundTransition: clonePlainData(hit.woundTransition),
    damageRoll: clonePlainData(hit.damageRoll),
    locationRoll: clonePlainData(hit.locationRoll),
    warnings: cloneArray(hit.warnings)
  });
}

function summarizePlannedUpdates(plannedUpdates = {}) {
  return {
    chatStatus: plannedUpdates.chatStatus || COMBAT_CHAT_STATUS.preview,
    actorUpdateCount: (plannedUpdates.actorUpdates || []).length,
    itemUpdateCount: (plannedUpdates.itemUpdates || []).length,
    embeddedItemUpdateCount: countEmbeddedUpdates(plannedUpdates.embeddedItemUpdates),
    warnings: cloneArray(plannedUpdates.warnings)
  };
}

function countEmbeddedUpdates(embeddedItemUpdates = []) {
  return embeddedItemUpdates.reduce((count, batch) => count + (batch?.updates || []).length, 0);
}

function normalizeManualResolution(manualResolution = {}) {
  return {
    required: !!manualResolution.required,
    ...(manualResolution.reason ? { reason: manualResolution.reason } : {}),
    ...(manualResolution.message ? { message: manualResolution.message } : {}),
    ...(manualResolution.blockedUpdateCategories ? { blockedUpdateCategories: cloneArray(manualResolution.blockedUpdateCategories) } : {})
  };
}

function extractActorRef(ref = {}) {
  return {
    ...(ref.actorUuid ? { actorUuid: ref.actorUuid } : {}),
    ...(ref.tokenUuid ? { tokenUuid: ref.tokenUuid } : {}),
    ...(ref.name ? { name: ref.name } : {})
  };
}

function extractWeaponRef(weapon = {}) {
  return {
    ...(weapon.itemUuid ? { itemUuid: weapon.itemUuid } : {}),
    ...(weapon.name ? { name: weapon.name } : {})
  };
}

function cloneArray(value = []) {
  return Array.isArray(value) ? value.map(entry => clonePlainData(entry)) : [];
}

function clonePlainData(data) {
  if(data === undefined) {
    return undefined;
  }
  return JSON.parse(JSON.stringify(data));
}

function compactPlainObject(data) {
  return Object.entries(data).reduce((compact, [key, value]) => {
    if(value !== undefined) {
      compact[key] = value;
    }
    return compact;
  }, {});
}
