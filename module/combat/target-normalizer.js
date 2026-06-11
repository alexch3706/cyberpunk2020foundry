import { COMBAT_WARNING_SEVERITY, MANUAL_RESOLUTION_REASON } from "./combat-outcome.js";
import { buildActorCombatSnapshot, clonePlainData, compactPlainObject } from "./combat-snapshot.js";

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
  return buildActorCombatSnapshot(actor, {
    existingSnapshot,
    includeEquipment: true
  });
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
