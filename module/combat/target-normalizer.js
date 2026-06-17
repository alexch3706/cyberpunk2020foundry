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
    raycastRequired = false,
    legacyBareTemplateAttachToAll = false
  } = options || {};
  const sourceTargets = mergeTemplateTargets(Array.from(targets || []), template);
  const normalizedTargets = normalizeSelectedTargets(sourceTargets);
  const hasTemplateContext = template !== undefined && template !== null;
  const hasRaycastContext = raycast !== undefined && raycast !== null;
  const shouldValidateRaycast = raycastRequired === true || hasRaycastContext;
  const templateTargetKeys = getTemplateTargetKeys(template);
  const targetCount = normalizedTargets.length;

  return normalizedTargets.map((target, index) => {
    const sourceTarget = sourceTargets[index] || {};
    const normalizedTarget = {
      ...target,
      tactical: buildTargetTacticalContext(sourceTarget, {
        hasTemplateContext,
        hasRaycastContext
      })
    };

    const targetDistance = resolveTargetDistance({
      target: normalizedTarget,
      sourceTarget,
      distance,
      targetCount
    });
    if(targetDistance) {
      normalizedTarget.distance = targetDistance;
    }

    applyTemplateEvidence(normalizedTarget, {
      sourceTarget,
      template,
      templateRequired,
      templateTargetKeys,
      hasTemplateContext,
      legacyBareTemplateAttachToAll,
      distance,
      targetCount,
      targetDistance
    });
    applyRaycastEvidence(normalizedTarget, {
      raycast,
      hasRaycastContext,
      shouldValidateRaycast
    });

    return compactPlainObject(normalizedTarget);
  });
}

function buildTargetTacticalContext(sourceTarget, context) {
  const tactical = compactPlainObject({
    selected: resolveSelectedFlag(sourceTarget, context)
  });

  if(sourceTarget.tactical) {
    if(sourceTarget.tactical.cover) tactical.cover = clonePlainData(sourceTarget.tactical.cover);
    if(sourceTarget.tactical.raycast) tactical.raycast = clonePlainData(sourceTarget.tactical.raycast);
    if(sourceTarget.tactical.template) tactical.template = clonePlainData(sourceTarget.tactical.template);
  }

  return tactical;
}

function applyTemplateEvidence(normalizedTarget, context) {
  const {
    sourceTarget,
    template,
    templateRequired,
    templateTargetKeys,
    hasTemplateContext,
    legacyBareTemplateAttachToAll,
    distance,
    targetCount,
    targetDistance
  } = context;

  if(shouldAttachTemplateEvidence(sourceTarget, templateTargetKeys, hasTemplateContext, legacyBareTemplateAttachToAll)) {
    const templateTargetDistance = resolveTemplateTargetDistance({
      target: normalizedTarget,
      sourceTarget,
      distance,
      targetCount,
      targetDistance
    });
    normalizedTarget.tactical.template = buildTemplateContext(template, templateTargetDistance);
  }

  const shouldValidateTemplate = templateRequired === true || normalizedTarget.tactical.template || hasTemplateContext;
  const templateEvidence = templateRequired === true
    ? normalizedTarget.tactical.template
    : normalizedTarget.tactical.template || template;
  const templateIssue = shouldValidateTemplate
    ? getTemplateManualIssue(templateEvidence)
    : undefined;
  if(templateRequired !== true && !normalizedTarget.tactical.template && !templateIssue) {
    return;
  }

  if(templateIssue) {
    requireTacticalManualResolution(normalizedTarget, templateIssue);
  }
}

function applyRaycastEvidence(normalizedTarget, context) {
  const {
    raycast,
    hasRaycastContext,
    shouldValidateRaycast
  } = context;

  if(hasRaycastContext) {
    normalizedTarget.tactical.raycast = buildRaycastContext(raycast);
  }

  if(!shouldValidateRaycast && !normalizedTarget.tactical.raycast) {
    return;
  }

  const raycastIssue = getRaycastManualIssue(normalizedTarget.tactical.raycast || raycast);
  if(raycastIssue) {
    requireTacticalManualResolution(normalizedTarget, raycastIssue);
  }
}

function mergeTemplateTargets(targets, template) {
  const templateTargets = getTemplateTargets(template);
  if(templateTargets.length === 0) {
    return targets;
  }
  const mergedTargets = [...targets];
  const seen = new Map();
  targets.forEach((target, index) => {
    const key = targetKey(target);
    if(key) {
      seen.set(key, index);
    }
  });
  for(const target of templateTargets) {
    const key = targetKey(target);
    if(key && seen.has(key)) {
      const existingIndex = seen.get(key);
      mergedTargets[existingIndex] = mergeTemplateTargetEvidence(mergedTargets[existingIndex], target);
      continue;
    }
    if(key) {
      seen.set(key, mergedTargets.length);
    }
    mergedTargets.push(target);
  }
  return mergedTargets;
}

function mergeTemplateTargetEvidence(existingTarget = {}, templateTarget = {}) {
  const merged = {
    ...templateTarget,
    ...existingTarget
  };
  const tactical = mergeTemplateTacticalEvidence(existingTarget, templateTarget);
  if(tactical) {
    merged.tactical = tactical;
  }
  return merged;
}

function mergeTemplateTacticalEvidence(existingTarget = {}, templateTarget = {}) {
  const templateTactical = templateTarget.tactical;
  const existingTactical = existingTarget.tactical;
  const templateDistance = normalizeDistance(templateTarget.distance || templateTactical?.distance);
  if(!templateTactical && !existingTactical && !templateDistance) {
    return undefined;
  }
  const tactical = {
    ...(templateTactical ? clonePlainData(templateTactical) : {}),
    ...(existingTactical ? clonePlainData(existingTactical) : {})
  };
  if(templateDistance) {
    tactical.templateDistance = templateDistance;
  }
  if(typeof existingTarget.selected === "boolean" && typeof existingTactical?.selected !== "boolean") {
    tactical.selected = existingTarget.selected;
  }
  return tactical;
}

function getTemplateTargets(template) {
  if(!template || typeof template !== "object") {
    return [];
  }
  const targetLists = [template.targets, template.intersectedTargets, template.affectedTargets];
  const mergedTargets = [];
  const seen = new Set();
  for(const targets of targetLists) {
    if(!Array.isArray(targets)) {
      continue;
    }
    for(const target of targets) {
      const key = targetKey(target);
      if(key && seen.has(key)) {
        continue;
      }
      if(key) {
        seen.add(key);
      }
      mergedTargets.push(target);
    }
  }
  return mergedTargets;
}

function getTemplateTargetKeys(template) {
  const templateTargets = getTemplateTargets(template);
  if(templateTargets.length === 0) {
    return undefined;
  }
  return new Set(templateTargets.map(target => targetKey(target)).filter(Boolean));
}

function shouldAttachTemplateEvidence(sourceTarget, templateTargetKeys, hasTemplateContext, legacyBareTemplateAttachToAll = false) {
  if(!hasTemplateContext) {
    return false;
  }
  if(!templateTargetKeys) {
    return legacyBareTemplateAttachToAll === true;
  }
  const key = targetKey(sourceTarget);
  return Boolean(key && templateTargetKeys.has(key));
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

function resolveTemplateTargetDistance({ target, sourceTarget, distance, targetCount, targetDistance }) {
  const distanceCandidates = [
    sourceTarget.tactical?.templateDistance,
    isTemplateDistance(sourceTarget.distance) ? sourceTarget.distance : undefined,
    isTemplateDistance(sourceTarget.tactical?.distance) ? sourceTarget.tactical.distance : undefined,
    findDistanceByTarget(distance, target),
    targetCount === 1 && isTemplateDistance(distance) ? distance : undefined,
    targetDistance
  ];
  for(const candidate of distanceCandidates) {
    const normalized = normalizeDistance(candidate);
    if(normalized) {
      return normalized;
    }
  }
  return undefined;
}

function isTemplateDistance(distance) {
  return distance?.source === "template";
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
