import { buildCombatChatData } from "./combat-chat.js";
import { COMBAT_CHAT_STATUS, COMBAT_WARNING_SEVERITY } from "./combat-outcome.js";
import { planCombatUpdates } from "./state-planner.js";

const UNSAFE_PLAN_WARNING_CODES = Object.freeze([
  "invalid-actor-update",
  "invalid-item-update",
  "invalid-embedded-item-update",
  "unserializable-update-payload",
  "unserializable-update-value",
  "unserializable-embedded-item-update",
  "conflicting-update-path",
  "conflicting-embedded-update-path"
]);

export function buildCombatPreviewData(outcome = {}, plannedUpdates = undefined, options = {}) {
  const plan = plannedUpdates || planCombatUpdates(outcome);
  const warnings = collectBlockingWarnings(outcome, plan);
  const canCommit = warnings.length === 0;
  const status = canCommit ? COMBAT_CHAT_STATUS.preview : COMBAT_CHAT_STATUS.manual;
  const chatData = buildCombatChatData(outcome, plan, {
    status: options.status || status
  });

  return {
    status,
    canCommit,
    actions: {
      confirm: "confirm",
      cancel: "cancel"
    },
    action: clonePlainData(outcome.action || {}),
    attacker: extractActorRef(outcome.attacker),
    weapon: extractWeaponRef(outcome.weapon),
    ammo: clonePlainData(outcome.ammo || {}),
    plannedUpdates: summarizePlannedUpdates(plan),
    manualResolution: normalizeManualResolution(outcome.manualResolution),
    warnings,
    chatData,
    targets: (outcome.targets || []).map(buildTargetPreviewData)
  };
}

export async function previewAndApplyCombatOutcome(outcome = {}, options = {}) {
  const plan = options.plannedUpdates || planCombatUpdates(outcome);
  const preview = buildCombatPreviewData(outcome, plan, options);
  const adapter = options.adapter || createFoundryCombatAdapter();

  let messageId = options.messageId;
  const warnings = [];

  if (options.decision === "cancel") {
    try {
      messageId = await createOrUpdateCombatChatMessage(outcome, COMBAT_CHAT_STATUS.canceled, {
        ...options,
        messageId,
        plannedUpdates: plan,
        adapter
      });
    } catch (error) {
      console.warn("Failed to create or update combat chat message:", error);
      warnings.push(commitWarning("chat-update-failed", `Failed to update combat chat message: ${error.message}`));
    }
    return {
      status: COMBAT_CHAT_STATUS.canceled,
      chatData: buildFinalChatData(outcome, plan, COMBAT_CHAT_STATUS.canceled),
      preview,
      messageId,
      applied: createEmptyCounts(),
      skipped: countPlanUpdates(plan),
      warnings: warnings.concat(preview.warnings)
    };
  }

  if (options.decision === "confirm") {
    if (!preview.canCommit) {
      try {
        messageId = await createOrUpdateCombatChatMessage(outcome, COMBAT_CHAT_STATUS.manual, {
          ...options,
          messageId,
          plannedUpdates: plan,
          adapter
        });
      } catch (error) {
        console.warn("Failed to create or update combat chat message:", error);
        warnings.push(commitWarning("chat-update-failed", `Failed to update combat chat message: ${error.message}`));
      }
      return {
        status: COMBAT_CHAT_STATUS.manual,
        chatData: buildFinalChatData(outcome, plan, COMBAT_CHAT_STATUS.manual),
        preview,
        messageId,
        applied: createEmptyCounts(),
        skipped: countPlanUpdates(plan),
        warnings: warnings.concat(preview.warnings)
      };
    }

    const result = await applyCombatUpdates(plan, adapter);

    try {
      messageId = await createOrUpdateCombatChatMessage(outcome, result.status, {
        ...options,
        messageId,
        plannedUpdates: plan,
        adapter,
        warnings: result.warnings
      });
    } catch (error) {
      console.warn("Failed to create or update combat chat message:", error);
      result.warnings.push(commitWarning("chat-update-failed", `Failed to update combat chat message: ${error.message}`));
    }

    return {
      ...result,
      chatData: buildFinalChatData(outcome, plan, result.status),
      preview,
      messageId
    };
  }

  // No decision provided: we are showing the preview
  const initialStatus = preview.status;
  try {
    messageId = await createOrUpdateCombatChatMessage(outcome, initialStatus, {
      ...options,
      messageId,
      plannedUpdates: plan,
      adapter
    });
  } catch (error) {
    console.warn("Failed to create or update combat chat message:", error);
    warnings.push(commitWarning("chat-update-failed", `Failed to update combat chat message: ${error.message}`));
  }

  return {
    status: preview.status,
    chatData: buildFinalChatData(outcome, plan, preview.status),
    preview,
    messageId,
    applied: createEmptyCounts(),
    skipped: countPlanUpdates(plan),
    warnings: warnings.concat(preview.warnings)
  };
}

export async function applyCombatUpdates(plan = {}, adapter = createFoundryCombatAdapter()) {
  const planWarnings = collectUnsafePlanWarnings(plan);
  if(planWarnings.length > 0) {
    return blockedResult(plan, planWarnings);
  }

  const preflight = await preflightCombatUpdates(plan, adapter);
  if(preflight.warnings.length > 0) {
    return blockedResult(plan, preflight.warnings);
  }

  const applied = createEmptyCounts();

  const itemUpdates = plan.itemUpdates || [];
  for(let index = 0; index < itemUpdates.length; index += 1) {
    const entry = itemUpdates[index];
    try {
      await preflight.items.get(entry.itemUuid).update(clonePlainData(entry.update));
      applied.itemUpdates += 1;
    }
    catch(error) {
      return failedCommitResult(plan, applied, {
        itemUpdates: itemUpdates.length - index,
        embeddedItemUpdates: countEmbeddedUpdates(plan.embeddedItemUpdates),
        actorUpdates: (plan.actorUpdates || []).length
      }, error, "item-update-failed");
    }
  }

  const embeddedItemUpdates = plan.embeddedItemUpdates || [];
  for(let index = 0; index < embeddedItemUpdates.length; index += 1) {
    const batch = embeddedItemUpdates[index];
    try {
      await preflight.actors.get(batch.actorUuid).updateEmbeddedDocuments(batch.type, clonePlainData(batch.updates));
      applied.embeddedItemUpdates += (batch.updates || []).length;
    }
    catch(error) {
      return failedCommitResult(plan, applied, {
        itemUpdates: 0,
        embeddedItemUpdates: countEmbeddedUpdates(embeddedItemUpdates.slice(index)),
        actorUpdates: (plan.actorUpdates || []).length
      }, error, "embedded-item-update-failed");
    }
  }

  const actorUpdates = plan.actorUpdates || [];
  for(let index = 0; index < actorUpdates.length; index += 1) {
    const entry = actorUpdates[index];
    try {
      await preflight.actors.get(entry.actorUuid).update(clonePlainData(entry.update));
      applied.actorUpdates += 1;
    }
    catch(error) {
      return failedCommitResult(plan, applied, {
        itemUpdates: 0,
        embeddedItemUpdates: 0,
        actorUpdates: actorUpdates.length - index
      }, error, "actor-update-failed");
    }
  }

  return {
    status: COMBAT_CHAT_STATUS.committed,
    chatData: buildStatusData(COMBAT_CHAT_STATUS.committed),
    applied,
    skipped: createEmptyCounts(),
    warnings: []
  };
}

export function createFoundryCombatAdapter() {
  return {
    async resolveItem(itemUuid) {
      return resolveFoundryDocument(itemUuid);
    },
    async resolveActor(actorUuid) {
      return resolveFoundryDocument(actorUuid);
    },
    async renderTemplate(templatePath, data) {
      if (typeof globalThis.renderTemplate !== "function") {
        throw new Error("Foundry renderTemplate is unavailable; inject a combat commit adapter for tests or non-Foundry runtimes.");
      }
      return globalThis.renderTemplate(templatePath, data);
    },
    async createChatMessage(chatData) {
      if (typeof globalThis.ChatMessage?.create !== "function") {
        throw new Error("Foundry ChatMessage.create is unavailable; inject a combat commit adapter for tests or non-Foundry runtimes.");
      }
      const message = await globalThis.ChatMessage.create(chatData);
      return message?.id;
    },
    async updateChatMessage(messageId, updateData) {
      if (typeof globalThis.game?.messages?.get !== "function") {
        throw new Error("Foundry game.messages.get is unavailable; inject a combat commit adapter for tests or non-Foundry runtimes.");
      }
      const message = globalThis.game.messages.get(messageId);
      if (!message) {
        console.warn(`ChatMessage ${messageId} could not be resolved for update (it may have been deleted).`);
        return;
      }
      await message.update(updateData);
    }
  };
}

async function preflightCombatUpdates(plan, adapter) {
  const items = new Map();
  const actors = new Map();
  const warnings = [];

  for(const entry of plan.itemUpdates || []) {
    let item;
    try {
      item = await adapter.resolveItem(entry.itemUuid);
    }
    catch(error) {
      warnings.push(commitWarning("resolve-item-document-failed", `Item document ${entry.itemUuid} could not be resolved for commit.`, errorToPlainData(error)));
      continue;
    }
    if(!item || typeof item.update !== "function") {
      warnings.push(commitWarning("missing-item-document", `Item document ${entry.itemUuid} could not be resolved for commit.`));
      continue;
    }
    items.set(entry.itemUuid, item);
  }

  for(const batch of plan.embeddedItemUpdates || []) {
    const actor = await resolveActorForPreflight(actors, adapter, batch.actorUuid, warnings);
    if(!actor || typeof actor.updateEmbeddedDocuments !== "function") {
      warnings.push(commitWarning("missing-actor-document", `Actor document ${batch.actorUuid} could not be resolved for embedded item commit.`));
    }
    for(const update of batch.updates || []) {
      if(!update?._id) {
        warnings.push(commitWarning("invalid-embedded-item-update", `Embedded ${batch.type} update on actor ${batch.actorUuid} requires an _id before commit.`));
      }
    }
  }

  for(const entry of plan.actorUpdates || []) {
    const actor = await resolveActorForPreflight(actors, adapter, entry.actorUuid, warnings);
    if(!actor || typeof actor.update !== "function") {
      warnings.push(commitWarning("missing-actor-document", `Actor document ${entry.actorUuid} could not be resolved for commit.`));
    }
  }

  return {
    items,
    actors,
    warnings
  };
}

async function resolveActorForPreflight(actors, adapter, actorUuid, warnings) {
  if(actors.has(actorUuid)) {
    return actors.get(actorUuid);
  }

  let actor;
  try {
    actor = await adapter.resolveActor(actorUuid);
  }
  catch(error) {
    warnings.push(commitWarning("resolve-actor-document-failed", `Actor document ${actorUuid} could not be resolved for commit.`, errorToPlainData(error)));
    return undefined;
  }
  if(actor) {
    actors.set(actorUuid, actor);
  }
  return actor;
}

function collectBlockingWarnings(outcome, plan) {
  const warnings = [];
  if(outcome?.manualResolution?.required) {
    warnings.push(commitWarning("manual-resolution-required", outcome.manualResolution.message || "Manual resolution is required before combat updates can be committed."));
  }

  for(const target of outcome?.targets || []) {
    if(target?.manualResolution?.required) {
      warnings.push(commitWarning("manual-resolution-required", target.manualResolution.message || "A target requires manual resolution before combat updates can be committed."));
    }
  }

  warnings.push(...collectUnsafePlanWarnings(plan));
  return warnings;
}

function collectUnsafePlanWarnings(plan) {
  return (plan?.warnings || [])
    .filter(warning => UNSAFE_PLAN_WARNING_CODES.includes(warning?.code))
    .map(warning => commitWarning("unsafe-plan-warning", warning.message || `Unsafe planned update warning: ${warning.code}.`, warning));
}

function blockedResult(plan, warnings) {
  return {
    status: COMBAT_CHAT_STATUS.manual,
    chatData: buildStatusData(COMBAT_CHAT_STATUS.manual),
    applied: createEmptyCounts(),
    skipped: countPlanUpdates(plan),
    warnings
  };
}

function failedCommitResult(plan, applied, skipped, error, phase) {
  return {
    status: COMBAT_CHAT_STATUS.manual,
    chatData: buildStatusData(COMBAT_CHAT_STATUS.manual),
    applied,
    skipped,
    warnings: [
      commitWarning("combat-update-failed", `Combat update failed during ${phase}; later updates were not applied.`, errorToPlainData(error))
    ]
  };
}

function countPlanUpdates(plan = {}) {
  return {
    itemUpdates: (plan.itemUpdates || []).length,
    embeddedItemUpdates: countEmbeddedUpdates(plan.embeddedItemUpdates),
    actorUpdates: (plan.actorUpdates || []).length
  };
}

function createEmptyCounts() {
  return {
    itemUpdates: 0,
    embeddedItemUpdates: 0,
    actorUpdates: 0
  };
}

function buildTargetPreviewData(targetOutcome = {}) {
  return {
    target: extractActorRef(targetOutcome.target),
    attack: clonePlainData(targetOutcome.attack || {}),
    hits: cloneArray(targetOutcome.hits),
    plannedUpdates: summarizePlannedUpdates(targetOutcome.plannedUpdates),
    manualResolution: normalizeManualResolution(targetOutcome.manualResolution),
    warnings: cloneArray(targetOutcome.warnings)
  };
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

function commitWarning(code, message, source = undefined) {
  return {
    code,
    severity: COMBAT_WARNING_SEVERITY.warning,
    message,
    ...(source ? { source } : {})
  };
}

function buildFinalChatData(outcome, plan, status) {
  return buildCombatChatData(outcome, {
    ...plan,
    chatStatus: status
  }, {
    status
  });
}

function buildStatusData(status) {
  return {
    status,
    ...{
      isPreview: status === COMBAT_CHAT_STATUS.preview,
      isManual: status === COMBAT_CHAT_STATUS.manual,
      isCommitted: status === COMBAT_CHAT_STATUS.committed,
      isCanceled: status === COMBAT_CHAT_STATUS.canceled
    }
  };
}

function errorToPlainData(error) {
  return {
    name: error?.name || "Error",
    message: error?.message || String(error)
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

async function resolveFoundryDocument(uuid) {
  if(typeof globalThis.fromUuid !== "function") {
    throw new Error("Foundry fromUuid is unavailable; inject a combat commit adapter for tests or non-Foundry runtimes.");
  }
  return globalThis.fromUuid(uuid);
}

export async function createOrUpdateCombatChatMessage(outcome = {}, resultStatus, options = {}) {
  const adapter = options.adapter || createFoundryCombatAdapter();
  const plan = {
    ...(options.plannedUpdates || planCombatUpdates(outcome)),
    chatStatus: resultStatus
  };
  const chatData = buildCombatChatData(outcome, plan, { status: resultStatus });
  if (options.warnings && options.warnings.length > 0) {
    chatData.warnings = [
      ...chatData.warnings,
      ...options.warnings
    ];
  }

  const templatePath = "systems/cyberpunk2020/templates/chat/combat-outcome.hbs";
  const htmlContent = await adapter.renderTemplate(templatePath, chatData);

  const messageId = options.messageId;
  if (messageId) {
    await adapter.updateChatMessage(messageId, { content: htmlContent });
    return messageId;
  } else {
    let speaker = options.speaker;
    if(!speaker && typeof globalThis.ChatMessage?.getSpeaker === "function") {
      let actor;
      if (outcome.attacker?.actorUuid) {
        actor = await adapter.resolveActor(outcome.attacker.actorUuid).catch(() => undefined);
      }
      if (actor) {
        speaker = globalThis.ChatMessage.getSpeaker({ actor });
      } else {
        speaker = {};
      }
    }
    const chatMessageData = {
      content: htmlContent
    };
    const userId = options.userId || (typeof globalThis.game?.user?.id === "string" ? globalThis.game.user.id : undefined);
    if (userId) chatMessageData.user = userId;
    if (speaker && Object.keys(speaker).length > 0) chatMessageData.speaker = speaker;
    const msgType = typeof globalThis.CONST?.CHAT_MESSAGE_TYPES?.OTHER !== "undefined" ? globalThis.CONST.CHAT_MESSAGE_TYPES.OTHER : undefined;
    if (msgType !== undefined) chatMessageData.type = msgType;

    const createdId = await adapter.createChatMessage(chatMessageData);
    if (!createdId) {
      throw new Error("ChatMessage creation resolved to empty or undefined message ID.");
    }
    return createdId;
  }
}
