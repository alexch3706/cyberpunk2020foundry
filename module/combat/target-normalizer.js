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

/**
 * Normalizes targets along with tactical context like templates and raycasts.
 * @param {Object} options Options containing targets, template, raycast, distance
 * @returns {Array<Object>} Normalized targets
 */
export function normalizeTacticalTargets(options = {}) {
  const {
    targets = [],
    template,
    raycast,
    distance,
    templateRequired = false,
    raycastRequired = false
  } = options || {};
  const sourceTargets = mergeTemplateTargets(Array.from(targets || []), template);
  const normalizedTargets = normalizeSelectedTargets(sourceTargets);
  const hasTemplateContext = template !== undefined && template !== null;
  const hasRaycastContext = raycast !== undefined && raycast !== null;
  const shouldValidateTemplate = templateRequired === true || hasTemplateContext;
  const shouldValidateRaycast = raycastRequired === true || hasRaycastContext;

  return normalizedTargets.map((target, index) => {
    const sourceTarget = sourceTargets[index] || {};
    const tactical = compactPlainObject({
      selected: resolveSelectedFlag(sourceTarget, {
        hasTemplateContext,
        hasRaycastContext
      })
    });

    // Preserve existing tactical data from source target
    if (sourceTarget.tactical) {
      if (sourceTarget.tactical.cover) tactical.cover = clonePlainData(sourceTarget.tactical.cover);
      if (sourceTarget.tactical.raycast) tactical.raycast = clonePlainData(sourceTarget.tactical.raycast);
      if (sourceTarget.tactical.template) tactical.template = clonePlainData(sourceTarget.tactical.template);
    }

    const normalizedTarget = {
      ...target,
      tactical
    };

    const targetDistance = resolveTargetDistance({
      target: normalizedTarget,
      sourceTarget,
      distance,
      targetCount: normalizedTargets.length
    });
    if(targetDistance) {
      normalizedTarget.distance = targetDistance;
    }

    if(hasTemplateContext) {
      normalizedTarget.tactical.template = buildTemplateContext(template, targetDistance);
    }
    if(shouldValidateTemplate || normalizedTarget.tactical.template) {
      const templateIssue = getTemplateManualIssue(normalizedTarget.tactical.template || template);
      if(templateIssue) {
        requireTacticalManualResolution(normalizedTarget, templateIssue);
      }
    }

    if(hasRaycastContext) {
      normalizedTarget.tactical.raycast = buildRaycastContext(raycast);
    }
    if(shouldValidateRaycast || normalizedTarget.tactical.raycast) {
      const raycastIssue = getRaycastManualIssue(normalizedTarget.tactical.raycast || raycast);
      if(raycastIssue) {
        requireTacticalManualResolution(normalizedTarget, raycastIssue);
      }
    }

    return compactPlainObject(normalizedTarget);
  });
}

function mergeTemplateTargets(targets, template) {
  const templateTargets = getTemplateTargets(template);
  if(templateTargets.length === 0) {
    return targets;
  }
  const mergedTargets = [...targets];
  const seen = new Set(targets.map(target => targetKey(target)).filter(Boolean));
  for(const target of templateTargets) {
    const key = targetKey(target);
    if(key && seen.has(key)) {
      continue;
    }
    if(key) {
      seen.add(key);
    }
    mergedTargets.push(target);
  }
  return mergedTargets;
}

function getTemplateTargets(template) {
  if(!template || typeof template !== "object") {
    return [];
  }
  const targetCandidates = template.targets || template.intersectedTargets || template.affectedTargets;
  return Array.isArray(targetCandidates) ? targetCandidates : [];
}

function targetKey(target = {}) {
  return target.id || target.tokenUuid || target.actorUuid || target.uuid || target.document?.uuid || target.actor?.uuid;
}

function resolveSelectedFlag(sourceTarget, context) {
  if(typeof sourceTarget?.tactical?.selected === "boolean") {
    return sourceTarget.tactical.selected;
  }
  if(typeof sourceTarget?.selected === "boolean") {
    return sourceTarget.selected;
  }
  return !(context.hasTemplateContext || context.hasRaycastContext);
}

function resolveTargetDistance({ target, sourceTarget, distance, targetCount }) {
  const distanceCandidates = [
    sourceTarget.distance,
    sourceTarget.tactical?.distance,
    findDistanceByTarget(distance, target),
    targetCount === 1 ? distance : undefined
  ];
  for(const candidate of distanceCandidates) {
    const normalized = normalizeDistance(candidate);
    if(normalized) {
      return normalized;
    }
  }
  return undefined;
}

function findDistanceByTarget(distance, target) {
  const keyedDistances = distance?.byTarget || distance?.targets;
  if(!keyedDistances || typeof keyedDistances !== "object" || Array.isArray(keyedDistances)) {
    return undefined;
  }
  return keyedDistances[target.id] || keyedDistances[target.tokenUuid] || keyedDistances[target.actorUuid];
}

function normalizeDistance(distance) {
  if(!distance || typeof distance !== "object") {
    return undefined;
  }
  return compactPlainObject({
    value: distance.value,
    units: distance.units,
    source: distance.source
  });
}

function buildTemplateContext(template, targetDistance = undefined) {
  return compactPlainObject({
    templateUuid: template.templateUuid,
    templateId: template.templateId,
    type: template.type,
    origin: clonePlainData(template.origin),
    direction: template.direction,
    angle: template.angle,
    width: template.width,
    distance: template.distance,
    targetDistance: targetDistance?.value ?? template.targetDistance,
    inclusion: template.inclusion
  });
}

function buildRaycastContext(raycast) {
  return compactPlainObject({
    origin: clonePlainData(raycast.origin),
    destination: clonePlainData(raycast.destination),
    obstruction: clonePlainData(raycast.obstruction),
    obstructionDistance: raycast.obstructionDistance,
    firstTarget: raycast.firstTarget,
    requiresGmDecision: raycast.requiresGmDecision
  });
}

function getTemplateManualIssue(template) {
  if(!template) {
    return buildTacticalIssue(
      "missing-tactical-template",
      "Template mode requested but tactical data is incomplete."
    );
  }
  const inclusion = template.inclusion;
  if(!template.type || !template.origin || !inclusion) {
    return buildTacticalIssue(
      "missing-tactical-template",
      "Template mode requested but tactical data is incomplete."
    );
  }
  if(inclusion === "manual_decision") {
    return buildTacticalIssue(
      "manual-tactical-template",
      "Template inclusion requires GM decision before automated updates."
    );
  }
  return undefined;
}

function getRaycastManualIssue(raycast) {
  if(!raycast) {
    return buildTacticalIssue(
      "missing-tactical-raycast",
      "Raycast mode requested but tactical data is incomplete."
    );
  }
  if(!raycast.origin || !raycast.destination) {
    return buildTacticalIssue(
      "missing-tactical-raycast",
      "Raycast mode requested but tactical data is incomplete."
    );
  }
  if(raycast.obstruction) {
    if(!raycast.obstruction.type || (!raycast.obstruction.name && !raycast.obstruction.id && !raycast.obstruction.uuid)) {
      return buildTacticalIssue(
        "ambiguous-tactical-raycast",
        "Raycast obstruction is missing required identity fields."
      );
    }
  }
  if(raycast.requiresGmDecision === true) {
    return buildTacticalIssue(
      "manual-tactical-raycast",
      "Raycast result requires GM decision before automated updates."
    );
  }
  return undefined;
}

function buildTacticalIssue(code, message) {
  return {
    code,
    message
  };
}

function requireTacticalManualResolution(target, issue) {
  target.manualResolution = {
    ...(target.manualResolution || {}),
    required: true,
    reason: target.manualResolution?.reason || MANUAL_RESOLUTION_REASON.pendingUserDecision,
    message: target.manualResolution?.message || issue.message,
    blockedUpdateCategories: mergeBlockedUpdateCategories(target.manualResolution?.blockedUpdateCategories)
  };
  target.warnings = appendWarning(target.warnings, {
    code: issue.code,
    severity: COMBAT_WARNING_SEVERITY.warning,
    message: issue.message
  });
}

function mergeBlockedUpdateCategories(existing = []) {
  return Array.from(new Set([...(existing || []), ...TARGET_UPDATE_BLOCKS]));
}

function appendWarning(warnings = [], warning) {
  if(warnings.some(existing => existing?.code === warning.code)) {
    return warnings;
  }
  return [...warnings, warning];
}
