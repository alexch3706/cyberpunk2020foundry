import assert from "node:assert/strict";

import { COMBAT_CHAT_STATUS } from "../../module/combat/combat-outcome.js";
import {
  applyCombatUpdates,
  buildCombatPreviewData,
  previewAndApplyCombatOutcome
} from "../../module/combat/combat-commit.js";
import { planCombatUpdates } from "../../module/combat/state-planner.js";

export async function runCombatCommitTests() {
  assertPreviewData();
  await assertConfirmAppliesUpdatesInOrder();
  await assertCancelDoesNotApplyUpdates();
  await assertManualResolutionBlocksCommit();
  await assertInvalidPlanBlocksCommit();
  await assertUnresolvedDocumentBlocksCommit();
  await assertResolverRejectionBlocksCommit();
  await assertEmbeddedUpdateWithoutIdBlocksCommit();
  await assertWriteRejectionReturnsPartialFailure();

  return {
    name: "combat-commit"
  };
}

function assertPreviewData() {
  const outcome = buildOutcome();
  const plan = planCombatUpdates(outcome);
  const preview = buildCombatPreviewData(outcome, plan);

  assert.equal(preview.status, COMBAT_CHAT_STATUS.preview, "preview status");
  assert.equal(preview.canCommit, true, "preview can commit valid plan");
  assert.deepEqual(preview.actions, {
    confirm: "confirm",
    cancel: "cancel"
  }, "preview actions");
  assert.deepEqual(preview.ammo, {
    before: 10,
    delta: -1,
    after: 9,
    source: "weapon.snapshot.shotsLeft"
  }, "preview ammo evidence");
  assert.deepEqual(preview.plannedUpdates, {
    chatStatus: COMBAT_CHAT_STATUS.preview,
    actorUpdateCount: 1,
    itemUpdateCount: 1,
    embeddedItemUpdateCount: 1,
    warnings: []
  }, "preview planned update summary");
  assert.equal(preview.targets[0].target.actorUuid, "Actor.target", "preview target actor");
  assert.equal(preview.targets[0].attack.hit, true, "preview hit flag");
  assert.equal(preview.targets[0].hits[0].location, "torso", "preview hit location");
  assert.equal(preview.chatData.status, COMBAT_CHAT_STATUS.preview, "preview chat evidence");
}

async function assertConfirmAppliesUpdatesInOrder() {
  const outcome = buildOutcome();
  const plan = planCombatUpdates(outcome);
  const adapter = createFakeAdapter();
  const result = await applyCombatUpdates(plan, adapter);

  assert.deepEqual(adapter.calls, [
    {
      type: "item.update",
      uuid: "Actor.attacker.Item.heavy-pistol",
      update: {
        "system.shotsLeft": 9
      }
    },
    {
      type: "actor.updateEmbeddedDocuments",
      uuid: "Actor.target",
      documentType: "Item",
      updates: [
        {
          _id: "armor-jacket",
          "system.coverage.torso.ablation": 1
        }
      ]
    },
    {
      type: "actor.update",
      uuid: "Actor.target",
      update: {
        "system.damage": 5
      }
    }
  ], "commit order");
  assert.deepEqual(result, {
    status: COMBAT_CHAT_STATUS.committed,
    chatData: buildExpectedChatStatus(COMBAT_CHAT_STATUS.committed),
    applied: {
      itemUpdates: 1,
      embeddedItemUpdates: 1,
      actorUpdates: 1
    },
    skipped: {
      itemUpdates: 0,
      embeddedItemUpdates: 0,
      actorUpdates: 0
    },
    warnings: []
  }, "commit result");
}

async function assertCancelDoesNotApplyUpdates() {
  const outcome = buildOutcome();
  const adapter = createFakeAdapter();
  const result = await previewAndApplyCombatOutcome(outcome, {
    adapter,
    decision: "cancel"
  });

  assert.deepEqual(adapter.calls, [], "cancel should not mutate documents");
  assert.equal(result.status, COMBAT_CHAT_STATUS.canceled, "cancel status");
  assert.equal(result.chatData.status, COMBAT_CHAT_STATUS.canceled, "cancel chat status");
  assert.equal(result.preview.canCommit, true, "cancel still exposes valid preview");
}

async function assertManualResolutionBlocksCommit() {
  const outcome = buildOutcome({
    manualResolution: {
      required: true,
      reason: "missing-rule-data",
      blockedUpdateCategories: ["target-damage"]
    }
  });
  const adapter = createFakeAdapter();
  const result = await previewAndApplyCombatOutcome(outcome, {
    adapter,
    decision: "confirm"
  });

  assert.deepEqual(adapter.calls, [], "manual resolution should not mutate documents");
  assert.equal(result.status, COMBAT_CHAT_STATUS.manual, "manual block status");
  assert.equal(result.chatData.status, COMBAT_CHAT_STATUS.manual, "manual chat status");
  assert.equal(result.preview.canCommit, false, "manual preview cannot commit");
  assert.equal(result.warnings[0].code, "manual-resolution-required", "manual warning");
}

async function assertInvalidPlanBlocksCommit() {
  const outcome = buildOutcome({
    plannedUpdates: {
      itemUpdates: [
        {
          itemUuid: "",
          update: {
            "system.shotsLeft": 9
          }
        }
      ]
    }
  });
  const plan = planCombatUpdates(outcome);
  const adapter = createFakeAdapter();
  const result = await applyCombatUpdates(plan, adapter);

  assert.deepEqual(adapter.calls, [], "invalid plan should not mutate documents");
  assert.equal(result.status, COMBAT_CHAT_STATUS.manual, "invalid plan status");
  assert.equal(result.warnings[0].code, "unsafe-plan-warning", "invalid plan warning");
}

async function assertUnresolvedDocumentBlocksCommit() {
  const outcome = buildOutcome();
  const plan = planCombatUpdates(outcome);
  const adapter = createFakeAdapter({
    missingItems: ["Actor.attacker.Item.heavy-pistol"]
  });
  const result = await applyCombatUpdates(plan, adapter);

  assert.deepEqual(adapter.calls, [], "missing document should not mutate documents");
  assert.equal(result.status, COMBAT_CHAT_STATUS.manual, "missing document status");
  assert.equal(result.warnings[0].code, "missing-item-document", "missing document warning");
}

async function assertResolverRejectionBlocksCommit() {
  const outcome = buildOutcome();
  const plan = planCombatUpdates(outcome);
  const adapter = createFakeAdapter({
    rejectItems: ["Actor.attacker.Item.heavy-pistol"]
  });
  const result = await applyCombatUpdates(plan, adapter);

  assert.deepEqual(adapter.calls, [], "resolver rejection should not mutate documents");
  assert.equal(result.status, COMBAT_CHAT_STATUS.manual, "resolver rejection status");
  assert.equal(result.warnings[0].code, "resolve-item-document-failed", "resolver rejection warning");
}

async function assertEmbeddedUpdateWithoutIdBlocksCommit() {
  const outcome = buildOutcome({
    targets: [
      {
        plannedUpdates: {
          embeddedItemUpdates: [
            {
              actorUuid: "Actor.target",
              type: "Item",
              updates: [
                {
                  "system.coverage.torso.ablation": 1
                }
              ]
            }
          ]
        }
      }
    ]
  });
  const plan = planCombatUpdates(outcome);
  const adapter = createFakeAdapter();
  const result = await applyCombatUpdates(plan, adapter);

  assert.deepEqual(adapter.calls, [], "embedded update without id should not mutate documents");
  assert.equal(result.status, COMBAT_CHAT_STATUS.manual, "embedded update without id status");
  assert.equal(result.warnings[0].code, "invalid-embedded-item-update", "embedded update without id warning");
}

async function assertWriteRejectionReturnsPartialFailure() {
  const outcome = buildOutcome();
  const plan = planCombatUpdates(outcome);
  const adapter = createFakeAdapter({
    rejectEmbeddedActors: ["Actor.target"]
  });
  const result = await applyCombatUpdates(plan, adapter);

  assert.deepEqual(adapter.calls, [
    {
      type: "item.update",
      uuid: "Actor.attacker.Item.heavy-pistol",
      update: {
        "system.shotsLeft": 9
      }
    }
  ], "write rejection should stop after first failed phase");
  assert.equal(result.status, COMBAT_CHAT_STATUS.manual, "write rejection status");
  assert.deepEqual(result.applied, {
    itemUpdates: 1,
    embeddedItemUpdates: 0,
    actorUpdates: 0
  }, "write rejection applied counts");
  assert.deepEqual(result.skipped, {
    itemUpdates: 0,
    embeddedItemUpdates: 1,
    actorUpdates: 1
  }, "write rejection skipped counts");
  assert.equal(result.warnings[0].code, "combat-update-failed", "write rejection warning");
}

function buildOutcome(overrides = {}) {
  return mergePlainData({
    action: {
      type: "ranged",
      fireMode: "SemiAuto",
      range: "RangeClose"
    },
    attacker: {
      actorUuid: "Actor.attacker",
      name: "Solo"
    },
    weapon: {
      itemUuid: "Actor.attacker.Item.heavy-pistol",
      name: "Heavy Pistol"
    },
    ammo: {
      before: 10,
      delta: -1,
      after: 9,
      source: "weapon.snapshot.shotsLeft"
    },
    targets: [
      {
        target: {
          actorUuid: "Actor.target",
          tokenUuid: "Scene.test.Token.target",
          name: "Guard"
        },
        attack: {
          roll: {
            total: 18
          },
          targetNumber: 15,
          hit: true,
          margin: 3,
          warnings: []
        },
        hits: [
          {
            location: "torso",
            warnings: []
          }
        ],
        plannedUpdates: {
          actorUpdates: [
            {
              actorUuid: "Actor.target",
              update: {
                "system.damage": 5
              }
            }
          ],
          embeddedItemUpdates: [
            {
              actorUuid: "Actor.target",
              type: "Item",
              updates: [
                {
                  _id: "armor-jacket",
                  "system.coverage.torso.ablation": 1
                }
              ]
            }
          ]
        },
        warnings: []
      }
    ],
    plannedUpdates: {
      itemUpdates: [
        {
          itemUuid: "Actor.attacker.Item.heavy-pistol",
          update: {
            "system.shotsLeft": 9
          }
        }
      ],
      chatStatus: COMBAT_CHAT_STATUS.preview
    },
    manualResolution: {
      required: false
    },
    chat: {
      status: COMBAT_CHAT_STATUS.preview
    },
    warnings: []
  }, overrides);
}

function createFakeAdapter(options = {}) {
  const calls = [];

  return {
    calls,
    async resolveItem(itemUuid) {
      if((options.rejectItems || []).includes(itemUuid)) {
        throw new Error(`Cannot resolve ${itemUuid}`);
      }
      if((options.missingItems || []).includes(itemUuid)) {
        return undefined;
      }
      return {
        async update(update) {
          calls.push({
            type: "item.update",
            uuid: itemUuid,
            update
          });
        }
      };
    },
    async resolveActor(actorUuid) {
      if((options.rejectActors || []).includes(actorUuid)) {
        throw new Error(`Cannot resolve ${actorUuid}`);
      }
      if((options.missingActors || []).includes(actorUuid)) {
        return undefined;
      }
      return {
        async updateEmbeddedDocuments(documentType, updates) {
          if((options.rejectEmbeddedActors || []).includes(actorUuid)) {
            throw new Error(`Cannot update embedded documents for ${actorUuid}`);
          }
          calls.push({
            type: "actor.updateEmbeddedDocuments",
            uuid: actorUuid,
            documentType,
            updates
          });
        },
        async update(update) {
          if((options.rejectActorUpdates || []).includes(actorUuid)) {
            throw new Error(`Cannot update actor ${actorUuid}`);
          }
          calls.push({
            type: "actor.update",
            uuid: actorUuid,
            update
          });
        }
      };
    }
  };
}

function buildExpectedChatStatus(status) {
  return {
    status,
    isPreview: status === COMBAT_CHAT_STATUS.preview,
    isManual: status === COMBAT_CHAT_STATUS.manual,
    isCommitted: status === COMBAT_CHAT_STATUS.committed,
    isCanceled: status === COMBAT_CHAT_STATUS.canceled
  };
}

function mergePlainData(base, patch) {
  if(Array.isArray(base) || Array.isArray(patch) || !isPlainObject(base) || !isPlainObject(patch)) {
    return patch === undefined ? clonePlainData(base) : clonePlainData(patch);
  }

  const merged = clonePlainData(base);
  for(const [key, value] of Object.entries(patch)) {
    merged[key] = key in merged ? mergePlainData(merged[key], value) : clonePlainData(value);
  }
  return merged;
}

function clonePlainData(data) {
  return JSON.parse(JSON.stringify(data));
}

function isPlainObject(value) {
  return !!value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype;
}
