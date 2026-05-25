import { COMBAT_CHAT_STATUS } from "./combat-outcome.js";

export const STATE_PLAN_WARNING_SEVERITY = Object.freeze({
  warning: "warning",
  error: "error"
});

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
  }

  if(options.chatStatus) {
    plan.chatStatus = options.chatStatus;
  }

  return plan;
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
