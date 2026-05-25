import { COMBAT_WARNING_SEVERITY, MANUAL_RESOLUTION_REASON } from "./combat-outcome.js";

const MISSING_TARGET_ACTOR_MESSAGE = "Target Actor is unavailable; resolve target damage, armor, and saves manually.";
const TARGET_UPDATE_BLOCKS = Object.freeze(["target-damage", "target-armor", "target-saves"]);

/**
 * Convert selected Foundry targets or existing plain target refs into resolver-ready data.
 *
 * @param {Iterable<Object>|Array<Object>} targets Selected targets or plain target references.
 * @returns {Array<Object>} Plain target references safe for resolver/tests.
 */
export function normalizeSelectedTargets(targets = []) {
  return Array.from(targets || []).map(target => normalizeSelectedTarget(target));
}

function normalizeSelectedTarget(target = {}) {
  const document = target.document || {};
  const actor = target.actor;
  const actorUuid = target.actorUuid || actor?.uuid;

  const targetRef = compactPlainObject({
    id: target.id || document.id,
    tokenUuid: target.tokenUuid || document.uuid || target.uuid,
    actorUuid,
    name: document.name || target.name || actor?.name
  });

  const snapshot = actorUuid
    ? buildTargetSnapshot(actor, target.snapshot)
    : undefined;

  if(snapshot) {
    targetRef.snapshot = snapshot;
  }

  if(!actorUuid) {
    targetRef.manualResolution = buildMissingActorManualResolution();
    targetRef.warnings = [buildMissingActorWarning()];
  }
  else {
    if(target.manualResolution) {
      targetRef.manualResolution = clonePlainData(target.manualResolution);
    }
    if(target.warnings) {
      targetRef.warnings = clonePlainData(target.warnings);
    }
  }

  return targetRef;
}

function buildTargetSnapshot(actor, existingSnapshot) {
  if(existingSnapshot) {
    return clonePlainData(existingSnapshot);
  }
  if(!actor?.system) {
    return undefined;
  }

  return compactPlainObject({
    stats: clonePlainData(actor.system.stats),
    damage: clonePlainData(actor.system.damage),
    hitLocations: clonePlainData(actor.system.hitLocations),
    equippedArmor: normalizeItemSnapshots(actor.itemTypes?.armor || []),
    equippedCyberware: normalizeItemSnapshots(actor.itemTypes?.cyberware || [])
  });
}

function normalizeItemSnapshots(items = []) {
  return Array.from(items || [])
    .filter(item => item?.system?.equipped === true)
    .map(item => compactPlainObject({
      id: item.id,
      name: item.name,
      type: item.type,
      system: clonePlainData(item.system)
    }));
}

function buildMissingActorManualResolution() {
  return {
    required: true,
    reason: MANUAL_RESOLUTION_REASON.missingTargetActor,
    message: MISSING_TARGET_ACTOR_MESSAGE,
    blockedUpdateCategories: [...TARGET_UPDATE_BLOCKS]
  };
}

function buildMissingActorWarning() {
  return {
    code: "missing-target-actor",
    severity: COMBAT_WARNING_SEVERITY.warning,
    message: MISSING_TARGET_ACTOR_MESSAGE
  };
}

function clonePlainData(data) {
  if(data === undefined) {
    return undefined;
  }
  try {
    return JSON.parse(JSON.stringify(data));
  }
  catch {
    return undefined;
  }
}

function compactPlainObject(data) {
  return Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== undefined)
  );
}
