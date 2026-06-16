import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { resolveCombatAction } from "../../module/combat/combat-resolver.js";
import { resolveBodyTypeDamage } from "../../module/combat/attack-resolver.js";
import { buildCombatChatData } from "../../module/combat/combat-chat.js";
import { buildWeaponCombatSnapshot } from "../../module/combat/combat-snapshot.js";
import { isActorDeadForDeathSaves, isActorStabilizedForDeathSaves, requiresRecurringDeathSave, resolveSavePromptsForTarget } from "../../module/combat/save-resolver.js";
import { planCombatUpdates } from "../../module/combat/state-planner.js";
import { normalizeSelectedTargets, normalizeTacticalTargets } from "../../module/combat/target-normalizer.js";
import { getEquippedArmorForLocation, resolveArmor } from "../../module/combat/armor-resolver.js";
import { detectAndPromptTacticalRaycasts } from "../../module/combat/tactical-raycast.js";
import { getAttackDieEntryMode, isCorebookFidelityEnabled, filterSupportedFireModes } from "../../module/combat/settings-helpers.js";

const FIXTURE_URLS = [
  new URL("./fixtures/ranged-single-shot.json", import.meta.url),
  new URL("./fixtures/three-round-burst.json", import.meta.url),
  new URL("./fixtures/ranged-full-auto.json", import.meta.url),

  new URL("./fixtures/reliability-jam.json", import.meta.url),
  new URL("./fixtures/melee-baseline.json", import.meta.url),
  new URL("./fixtures/shotgun-template.json", import.meta.url)
];

export async function runCombatFixtures() {
  const results = [];

  assertTargetNormalization();
  await assertTacticalTargetNormalization();
  assertWeaponCombatSnapshot();
  assertBodyTypeDamageResolver();
  assertWoundPlanning();
  assertSavePromptResolution();
  assertDeathSaveStateHelpers();
  assertArmorResolver();
  await assertZonedCyberwareArmorHitPlanning();
  await assertCombatResolverRouting();
  assertSettingsHelpers();

  for(const fixtureUrl of FIXTURE_URLS) {
    const fixture = JSON.parse(await readFile(fixtureUrl, "utf8"));
    results.push(await runFixture(fixture));
  }

  return results;
}

async function runFixture(fixture) {
  const roller = createScriptedRoller(fixture.rolls);
  const context = clonePlainData(fixture.context);
  const isSuppressiveFire = (String(context?.action?.fireMode || "").toLowerCase() === "suppressivefire");
  const useStructured = isSuppressiveFire || fixture.useStructured;

  context.legacy = {
    mode: "fixture",
    fallback: ({ context: resolverContext, roller }) => {
      if(useStructured) {
        // These fixture types are resolved through the structured resolver, not legacy.
        // This fallback is bypassed when options.structured=true is passed.
        return { manualResolution: { required: true }, targets: [] };
      }
      return buildSingleShotOutcome(resolverContext, roller, fixture);
    }
  };

  console.log("Running fixture:", fixture.name);
  const options = useStructured ? { structured: true } : {};
  const outcome = await resolveCombatAction(context, options, roller);
  roller.assertComplete();

  if(useStructured) {
    // Structured-resolved fixtures may use different outcome structures (e.g., saves or jam).
    // Skip standard assertOutcomeShape which expects attack roll fields.
    assert.equal(outcome.action.type, fixture.context.action.type, `${fixture.name} action type`);
    assert.equal(outcome.action.fireMode, fixture.context.action.fireMode, `${fixture.name} fire mode`);
    assert.ok(outcome.attacker.actorUuid, `${fixture.name} attacker actor UUID`);
    assert.ok(outcome.weapon.itemUuid, `${fixture.name} weapon item UUID`);
    assert.equal(outcome.targets.length, fixture.context.targets.length, `${fixture.name} target count`);
    if(fixture.expected?.outcome?.chatStatus) {
      assert.equal(outcome.chat.status, fixture.expected.outcome.chatStatus, `${fixture.name} chat status`);
    }
  } else {
    assertOutcomeShape(outcome, fixture.expected.outcome);
  }

  const plannedUpdates = planCombatUpdates(outcome);

  if(useStructured) {
    // Structured-resolved fixtures produce complex nested outcomes.
    // Use partial matching (assertObjectIncludes) instead of exact deep equality.
    assertObjectIncludes(plannedUpdates, fixture.expected?.plannedUpdates || {}, `${fixture.name} planned updates`);

    const previewChatData = buildCombatChatData(outcome, plannedUpdates);
    assertObjectIncludes(previewChatData, fixture.expected?.chatData?.preview || {}, `${fixture.name} preview chat data`);
  } else {
    assert.deepEqual(plannedUpdates, fixture.expected?.plannedUpdates || {}, `${fixture.name} planned updates`);

    const previewChatData = buildCombatChatData(outcome, plannedUpdates);
    assert.deepEqual(previewChatData, fixture.expected?.chatData?.preview || {}, `${fixture.name} preview chat data`);
  }

  await assertSingleShotCases(fixture);

  for(const statusCase of fixture.chatStatusCases || []) {
    const caseOutcome = reviveFixtureSentinels(mergePlainData(outcome, statusCase.outcome || {}));
    const casePlan = reviveFixtureSentinels(mergePlainData(plannedUpdates, statusCase.plannedUpdates || {}));
    const caseOptions = reviveFixtureSentinels(clonePlainData(statusCase.options || {}));
    const chatData = buildCombatChatData(caseOutcome, casePlan, caseOptions);
    assertObjectIncludes(chatData, statusCase.expected, `${fixture.name} ${statusCase.name} chat data`);
  }

  for(const invalidCase of fixture.invalidPlanCases || []) {
    const invalidOutcome = reviveFixtureSentinels(clonePlainData(invalidCase.outcome));
    const warningPlan = planCombatUpdates(invalidOutcome);
    assert.deepEqual(warningPlan, invalidCase.expectedPlan, `${fixture.name} ${invalidCase.name}`);
  }

  return {
    name: fixture.name,
    outcome,
    plannedUpdates
  };
}

function createScriptedRoller(rolls = []) {
  let nextRollIndex = 0;

  function roller(request = {}) {
    const scriptedRoll = rolls[nextRollIndex];
    if(!scriptedRoll) {
      throw new Error(`No scripted roll available for ${request.id || "unidentified roll"}.`);
    }
    console.log(`Roller requested: ${request.id}. Next scripted roll is: ${scriptedRoll.id}`);
    if(request.id && scriptedRoll.id !== request.id) {
      throw new Error(`Expected scripted roll ${scriptedRoll.id}, received ${request.id}.`);
    }
    if(scriptedRoll.expectedRequest) {
      assertObjectIncludes(request, scriptedRoll.expectedRequest, `${request.id || "roll"} request`);
    }

    nextRollIndex += 1;
    const rollMetadata = {
      id: scriptedRoll.id,
      formula: scriptedRoll.formula || request.formula,
      total: scriptedRoll.total,
      die: clonePlainData(scriptedRoll.die),
      seed: request.seed
    };
    if(scriptedRoll.location) {
      rollMetadata.location = scriptedRoll.location;
    }
    return rollMetadata;
  }

  roller.assertComplete = () => {
    assert.equal(nextRollIndex, rolls.length, "all scripted rolls should be consumed");
  };

  return roller;
}

function buildSingleShotOutcome(context, roller, fixture) {
  const attackRoll = roller({ id: "attack", seed: fixture.name });
  const locationRoll = roller({ id: "location", seed: fixture.name });
  const damageRoll = roller({ id: "damage", seed: fixture.name });
  const target = context.targets[0];
  const hitEvidence = fixture.outcomeEvidence?.hit;
  const hit = attackRoll.total >= context.action.targetNumber;

  return {
    action: context.action,
    attacker: context.attacker,
    weapon: context.weapon,
    targets: [
      {
        target,
        attack: {
          roll: attackRoll,
          targetNumber: context.action.targetNumber,
          hit,
          margin: attackRoll.total - context.action.targetNumber,
          warnings: []
        },
        hits: hit ? [
          {
            location: hitEvidence.location,
            locationRoll,
            damageRoll,
            rawDamage: hitEvidence.rawDamage,
            effectiveStoppingPower: hitEvidence.effectiveStoppingPower,
            armorPiercing: hitEvidence.armorPiercing,
            armorMitigation: hitEvidence.armorMitigation,
            penetratingDamage: hitEvidence.penetratingDamage,
            bodyTypeModifier: hitEvidence.bodyTypeModifier,
            bodyTypeMitigation: hitEvidence.bodyTypeMitigation,
            minimumDamageApplied: hitEvidence.minimumDamageApplied,
            finalDamage: hitEvidence.finalDamage,
            warnings: []
          }
        ] : [],
        plannedUpdates: clonePlainData(fixture.outcomeEvidence.plannedUpdates),
        warnings: []
      }
    ],
    ammo: clonePlainData(fixture.outcomeEvidence.ammo),
    plannedUpdates: {
      itemUpdates: clonePlainData(fixture.outcomeEvidence.itemUpdates),
      chatStatus: "preview"
    },
    manualResolution: {
      required: false
    },
    chat: {
      status: "preview"
    },
    warnings: []
  };
}

async function assertSingleShotCases(fixture) {
  for(const singleShotCase of fixture.singleShotCases || []) {
    // Strict ruleReference validation — every fixture case must document which rule it verifies
    if (!singleShotCase.ruleReference || typeof singleShotCase.ruleReference !== "string") {
      throw new Error(`${fixture.name}: case "${singleShotCase.name}" is missing required "ruleReference" string`);
    }
    const roller = createScriptedRoller(singleShotCase.rolls);
    const context = reviveFixtureSentinels(mergePlainData(fixture.context, singleShotCase.context || {}));
    if(singleShotCase.legacyExpected) {
      context.legacy = {
        mode: "fixture",
        fallback: () => clonePlainData(singleShotCase.legacyExpected)
      };
    }
    const outcome = await resolveCombatAction(context, { structured: true }, roller);
    roller.assertComplete();
    const plan = planCombatUpdates(outcome);
    assertObjectIncludes(outcome, singleShotCase.expected, `${fixture.name} ${singleShotCase.name} outcome`);
    if(singleShotCase.expectedPlan) {
      assertObjectIncludes(plan, singleShotCase.expectedPlan, `${fixture.name} ${singleShotCase.name} planned updates`);
    }
    if(singleShotCase.expectedChat) {
      const chatData = buildCombatChatData(outcome, plan);
      assertObjectIncludes(chatData, singleShotCase.expectedChat, `${fixture.name} ${singleShotCase.name} chat data`);
    }
  }
}

function assertTargetNormalization() {
  const normalized = normalizeSelectedTargets([
    {
      id: "token-actor",
      document: {
        uuid: "Scene.test.Token.actor",
        name: "Armored Target"
      },
      actor: {
        uuid: "Actor.target",
        name: "Target Actor",
        system: {
          stats: {
            body: {
              total: 6
            }
          },
          damage: 2,
      isFBC: false,
          hitLocations: {
            torso: {
              label: "Torso"
            }
          }
        },
        itemTypes: {
          armor: [
            {
              id: "armor-vest",
              name: "Kevlar Vest",
              type: "armor",
              system: {
                equipped: true,
                coverage: {
                  torso: {
                    stoppingPower: 12,
                    ablation: 0
                  }
                }
              }
            },
            {
              id: "stored-vest",
              name: "Stored Vest",
              type: "armor",
              system: {
                equipped: false,
                coverage: {
                  torso: {
                    stoppingPower: 20,
                    ablation: 0
                  }
                }
              }
            }
          ],
          cyberware: [
            {
              id: "subdermal-armor",
              name: "Subdermal Armor",
              type: "cyberware",
              system: {
                equipped: true,
                stoppingPower: 2
              }
            },
            {
              id: "stored-subdermal-armor",
              name: "Stored Subdermal Armor",
              type: "cyberware",
              system: {
                equipped: false,
                stoppingPower: 4
              }
            }
          ]
        }
      }
    },
    {
      id: "token-actorless",
      document: {
        uuid: "Scene.test.Token.actorless",
        name: "Actorless Target"
      }
    },
    {
      id: "plain-target",
      tokenUuid: "Scene.test.Token.plain",
      actorUuid: "Actor.plain",
      name: "Plain Target",
      snapshot: {
        stats: {
          body: {
            total: 5
          }
        },
        damage: 0,
        hitLocations: {
          head: {
            label: "Head"
          }
        }
      }
    }
  ]);

  assert.deepEqual(normalized[0], {
    id: "token-actor",
    tokenUuid: "Scene.test.Token.actor",
    actorUuid: "Actor.target",
    name: "Armored Target",
    snapshot: {
      stats: {
        body: {
          total: 6
        }
      },
      damage: 2,
      isFBC: false,
      hitLocations: {
        torso: {
          label: "Torso"
        }
      },
      equippedArmor: [
        {
          id: "armor-vest",
          name: "Kevlar Vest",
          type: "armor",
          system: {
            equipped: true,
            coverage: {
              torso: {
                stoppingPower: 12,
                ablation: 0
              }
            }
          }
        }
      ],
      equippedCyberware: [
        {
          id: "subdermal-armor",
          name: "Subdermal Armor",
          type: "cyberware",
          system: {
            equipped: true,
            stoppingPower: 2
          }
        }
      ]
    }
  }, "actor-backed target normalization");

  assert.deepEqual(normalized[1], {
    id: "token-actorless",
    tokenUuid: "Scene.test.Token.actorless",
    name: "Actorless Target",
    manualResolution: {
      required: true,
      reason: "missing-target-actor",
      message: "Target Actor is unavailable; resolve target damage, armor, and saves manually.",
      blockedUpdateCategories: ["target-damage", "target-armor", "target-saves"]
    },
    warnings: [
      {
        code: "missing-target-actor",
        severity: "warning",
        message: "Target Actor is unavailable; resolve target damage, armor, and saves manually."
      }
    ]
  }, "actorless target normalization");

  assert.deepEqual(normalized[2], {
    id: "plain-target",
    tokenUuid: "Scene.test.Token.plain",
    actorUuid: "Actor.plain",
    name: "Plain Target",
    snapshot: {
      stats: {
        body: {
          total: 5
        }
      },
      damage: 0,
      hitLocations: {
        head: {
          label: "Head"
        }
      }
    }
  }, "plain target normalization");

  assert.deepEqual(JSON.parse(JSON.stringify(normalized)), normalized, "normalized targets are JSON-safe");
}

function assertWeaponCombatSnapshot() {
  const item = {
    system: {
      damage: "3d6",
      ap: true,
      shotsLeft: 8,
      rof: 2,
      reliability: "Standard",
      range: 50,
      accuracy: 1,
      attackType: "shotgun",
      attackSkill: "Rifle",
      rangeDamages: {
        pointBlank: "4d6",
        close: "4d6",
        medium: "3d6",
        far: "2d6"
      }
    }
  };
  const snapshot = buildWeaponCombatSnapshot(item);
  assert.equal(snapshot.attackType, "shotgun");
  assert.deepEqual(snapshot.rangeDamages, {
    pointBlank: "4d6",
    close: "4d6",
    medium: "3d6",
    far: "2d6"
  });
}

async function assertTacticalTargetNormalization() {
  const targets = normalizeTacticalTargets({
    targets: [
      {
        id: "token-actor",
        selected: true,
        document: { uuid: "Scene.test.Token.actor", name: "Armored Target" },
        actor: { uuid: "Actor.target", name: "Target Actor", system: { stats: { body: { total: 6 } } } }
      }
    ],
    template: {
      templateUuid: "Scene.test.MeasuredTemplate.1",
      templateId: "template-1",
      type: "cone",
      origin: { x: 100, y: 100 },
      direction: 45,
      angle: 30,
      distance: 10,
      inclusion: "intersected"
    },
    raycast: {
      origin: { x: 50, y: 50 },
      destination: { x: 150, y: 150 },
      obstruction: { id: "wall-1", uuid: "Scene.test.Wall.1", type: "wall", name: "Concrete Wall" },
      obstructionDistance: 4,
      firstTarget: true,
      requiresGmDecision: false
    },
    distance: {
      value: 8,
      units: "m",
      source: "measured"
    }
  });

  assert.equal(targets.length, 1);
  assert.equal(targets[0].tokenUuid, "Scene.test.Token.actor");
  assert.deepEqual(targets[0].distance, { value: 8, units: "m", source: "measured" });
  assert.deepEqual(JSON.parse(JSON.stringify(targets)), targets, "tactical targets are JSON-safe");
  assert.deepEqual(targets[0].tactical, {
    selected: true,
    template: {
      templateUuid: "Scene.test.MeasuredTemplate.1",
      templateId: "template-1",
      type: "cone",
      origin: { x: 100, y: 100 },
      direction: 45,
      angle: 30,
      distance: 10,
      targetDistance: 8,
      inclusion: "intersected"
    },
    raycast: {
      origin: { x: 50, y: 50 },
      destination: { x: 150, y: 150 },
      obstruction: { id: "wall-1", uuid: "Scene.test.Wall.1", type: "wall", name: "Concrete Wall" },
      obstructionDistance: 4,
      firstTarget: true,
      requiresGmDecision: false
    }
  });

  const multiTargets = normalizeTacticalTargets({
    targets: [
      { id: "token-near", selected: false, actorUuid: "Actor.near", name: "Near Target", snapshot: {} },
      { id: "token-far", selected: false, actorUuid: "Actor.far", name: "Far Target", snapshot: {} }
    ],
    template: {
      templateId: "template-2",
      type: "cone",
      origin: { x: 10, y: 20 },
      direction: 0,
      angle: 45,
      distance: 12,
      inclusion: "intersected"
    },
    distance: {
      byTarget: {
        "token-near": { value: 3, units: "m", source: "template" },
        "token-far": { value: 9, units: "m", source: "template" }
      }
    }
  });

  assert.equal(multiTargets[0].tactical.selected, false);
  assert.equal(multiTargets[1].tactical.selected, false);
  assert.deepEqual(multiTargets[0].distance, { value: 3, units: "m", source: "template" });
  assert.deepEqual(multiTargets[1].distance, { value: 9, units: "m", source: "template" });
  assert.equal(multiTargets[0].tactical.template.targetDistance, 3);
  assert.equal(multiTargets[1].tactical.template.targetDistance, 9);

  const selectedTargetWithSeparateAffectedToken = normalizeTacticalTargets({
    targets: [
      { id: "token-selected", selected: true, actorUuid: "Actor.selected", name: "Selected Target", snapshot: {} }
    ],
    template: {
      templateId: "template-affected",
      type: "cone",
      origin: { x: 10, y: 20 },
      direction: 0,
      angle: 45,
      distance: 12,
      inclusion: "intersected",
      affectedTargets: [
        { id: "token-affected", actorUuid: "Actor.affected", name: "Affected Token", snapshot: {} }
      ]
    }
  });

  assert.equal(selectedTargetWithSeparateAffectedToken.length, 2);
  assert.equal(selectedTargetWithSeparateAffectedToken[0].id, "token-selected");
  assert.equal(selectedTargetWithSeparateAffectedToken[0].tactical.selected, true);
  assert.equal(selectedTargetWithSeparateAffectedToken[0].tactical.template, undefined);
  assert.equal(selectedTargetWithSeparateAffectedToken[1].id, "token-affected");
  assert.equal(selectedTargetWithSeparateAffectedToken[1].tactical.selected, false);
  assert.equal(selectedTargetWithSeparateAffectedToken[1].tactical.template.templateId, "template-affected");

  const selectedTargetAlsoCaughtInHazardZone = normalizeTacticalTargets({
    targets: [
      { id: "token-overlap", selected: true, actorUuid: "Actor.overlap", name: "Overlapping Target", snapshot: {} }
    ],
    template: {
      templateId: "template-overlap",
      type: "cone",
      origin: { x: 10, y: 20 },
      direction: 0,
      angle: 45,
      distance: 12,
      inclusion: "intersected",
      affectedTargets: [
        { id: "token-overlap", actorUuid: "Actor.overlap", name: "Overlapping Target", snapshot: {} }
      ]
    }
  });

  assert.equal(selectedTargetAlsoCaughtInHazardZone.length, 1);
  assert.equal(selectedTargetAlsoCaughtInHazardZone[0].id, "token-overlap");
  assert.equal(selectedTargetAlsoCaughtInHazardZone[0].tactical.selected, true);
  assert.equal(selectedTargetAlsoCaughtInHazardZone[0].tactical.template.templateId, "template-overlap");

  const selectedTargetAlsoCaughtWithPerTargetHazardZoneEvidence = normalizeTacticalTargets({
    targets: [
      { id: "token-overlap-evidence", selected: true, actorUuid: "Actor.overlapEvidence", name: "Overlapping Evidence Target", snapshot: {} }
    ],
    template: {
      templateId: "template-overlap-evidence",
      type: "cone",
      origin: { x: 10, y: 20 },
      direction: 0,
      angle: 45,
      distance: 12,
      inclusion: "intersected",
      affectedTargets: [
        {
          id: "token-overlap-evidence",
          actorUuid: "Actor.overlapEvidence",
          name: "Overlapping Evidence Target",
          snapshot: {},
          distance: { value: 4, units: "m", source: "template" }
        }
      ]
    }
  });

  assert.equal(selectedTargetAlsoCaughtWithPerTargetHazardZoneEvidence.length, 1);
  assert.equal(selectedTargetAlsoCaughtWithPerTargetHazardZoneEvidence[0].id, "token-overlap-evidence");
  assert.equal(selectedTargetAlsoCaughtWithPerTargetHazardZoneEvidence[0].tactical.selected, true);
  assert.equal(selectedTargetAlsoCaughtWithPerTargetHazardZoneEvidence[0].tactical.template.templateId, "template-overlap-evidence");
  assert.deepEqual(selectedTargetAlsoCaughtWithPerTargetHazardZoneEvidence[0].distance, { value: 4, units: "m", source: "template" });
  assert.equal(selectedTargetAlsoCaughtWithPerTargetHazardZoneEvidence[0].tactical.template.targetDistance, 4);

  const selectedTargetAlsoCaughtWithSelectedAndHazardZoneDistances = normalizeTacticalTargets({
    targets: [
      {
        id: "token-overlap-distance",
        selected: true,
        actorUuid: "Actor.overlapDistance",
        name: "Overlapping Distance Target",
        snapshot: {},
        distance: { value: 8, units: "m", source: "grid" }
      }
    ],
    template: {
      templateId: "template-overlap-distance",
      type: "cone",
      origin: { x: 10, y: 20 },
      direction: 0,
      angle: 45,
      distance: 12,
      inclusion: "intersected",
      affectedTargets: [
        {
          id: "token-overlap-distance",
          actorUuid: "Actor.overlapDistance",
          name: "Overlapping Distance Target",
          snapshot: {},
          distance: { value: 3, units: "m", source: "template" }
        }
      ]
    }
  });

  assert.equal(selectedTargetAlsoCaughtWithSelectedAndHazardZoneDistances.length, 1);
  assert.equal(selectedTargetAlsoCaughtWithSelectedAndHazardZoneDistances[0].id, "token-overlap-distance");
  assert.equal(selectedTargetAlsoCaughtWithSelectedAndHazardZoneDistances[0].tactical.selected, true);
  assert.deepEqual(selectedTargetAlsoCaughtWithSelectedAndHazardZoneDistances[0].distance, { value: 8, units: "m", source: "grid" });
  assert.equal(selectedTargetAlsoCaughtWithSelectedAndHazardZoneDistances[0].tactical.template.templateId, "template-overlap-distance");
  assert.equal(selectedTargetAlsoCaughtWithSelectedAndHazardZoneDistances[0].tactical.template.targetDistance, 3);

  const zoneOnlyAffectedTokens = normalizeTacticalTargets({
    template: {
      templateId: "template-zone-only",
      type: "cone",
      origin: { x: 10, y: 20 },
      direction: 0,
      angle: 45,
      distance: 12,
      inclusion: "intersected",
      affectedTargets: [
        { id: "token-zone-left", actorUuid: "Actor.zoneLeft", name: "Zone Left", snapshot: {} },
        { id: "token-zone-right", actorUuid: "Actor.zoneRight", name: "Zone Right", snapshot: {} }
      ]
    }
  });

  assert.equal(zoneOnlyAffectedTokens.length, 2);
  assert.equal(zoneOnlyAffectedTokens[0].id, "token-zone-left");
  assert.equal(zoneOnlyAffectedTokens[1].id, "token-zone-right");
  assert.equal(zoneOnlyAffectedTokens[0].tactical.selected, false);
  assert.equal(zoneOnlyAffectedTokens[1].tactical.selected, false);
  assert.equal(zoneOnlyAffectedTokens[0].tactical.template.templateId, "template-zone-only");
  assert.equal(zoneOnlyAffectedTokens[1].tactical.template.templateId, "template-zone-only");

  const templateWithEmptyTargetsAndAffectedTokens = normalizeTacticalTargets({
    template: {
      templateId: "template-empty-targets",
      type: "cone",
      origin: { x: 10, y: 20 },
      direction: 0,
      angle: 45,
      distance: 12,
      inclusion: "intersected",
      targets: [],
      affectedTargets: [
        { id: "token-empty-fallback", actorUuid: "Actor.emptyFallback", name: "Empty Fallback", snapshot: {} }
      ]
    }
  });

  assert.equal(templateWithEmptyTargetsAndAffectedTokens.length, 1);
  assert.equal(templateWithEmptyTargetsAndAffectedTokens[0].id, "token-empty-fallback");
  assert.equal(templateWithEmptyTargetsAndAffectedTokens[0].tactical.selected, false);
  assert.equal(templateWithEmptyTargetsAndAffectedTokens[0].tactical.template.templateId, "template-empty-targets");

  const templateCollectedTargets = normalizeTacticalTargets({
    template: {
      templateId: "template-collected",
      type: "cone",
      origin: { x: 10, y: 20 },
      direction: 0,
      angle: 45,
      distance: 12,
      inclusion: "intersected",
      targets: [
        { id: "token-template-near", selected: false, actorUuid: "Actor.templateNear", name: "Template Near", snapshot: {} },
        { id: "token-template-far", selected: false, actorUuid: "Actor.templateFar", name: "Template Far", snapshot: {} }
      ]
    },
    distance: {
      byTarget: {
        "token-template-near": { value: 1, units: "m", source: "template" },
        "token-template-far": { value: 3, units: "m", source: "template" }
      }
    }
  });

  assert.equal(templateCollectedTargets.length, 2);
  assert.equal(templateCollectedTargets[0].tactical.template.targetDistance, 1);
  assert.equal(templateCollectedTargets[1].tactical.template.targetDistance, 3);
  assert.deepEqual(JSON.parse(JSON.stringify(templateCollectedTargets)), templateCollectedTargets, "template-collected targets are JSON-safe");
  
  // Test manual fallback for missing target context
  const manualTargets = normalizeTacticalTargets({
    targets: [{ id: "token-actorless" }],
    template: { type: "cone" }, // Missing origin, inclusion, etc.
    raycast: { origin: { x: 0, y: 0 } } // Missing destination
  });
  
  assert.equal(manualTargets[0].manualResolution.required, true);
  assert.equal(manualTargets[0].manualResolution.reason, "missing-target-actor");
  assert.deepEqual(manualTargets[0].manualResolution.blockedUpdateCategories, ["target-damage", "target-armor", "target-saves"]);
  assert.ok(manualTargets[0].warnings.some(w => w.code === "missing-target-actor"));
  assert.ok(manualTargets[0].warnings.some(w => w.code === "missing-tactical-template"));
  assert.ok(manualTargets[0].warnings.some(w => w.code === "missing-tactical-raycast"));

  const missingRequestedContext = normalizeTacticalTargets({
    targets: [{ id: "token-requested", actorUuid: "Actor.requested", name: "Requested Target", snapshot: {} }],
    templateRequired: true,
    raycastRequired: true
  });

  assert.equal(missingRequestedContext[0].manualResolution.required, true);
  assert.deepEqual(missingRequestedContext[0].manualResolution.blockedUpdateCategories, ["target-damage", "target-armor", "target-saves"]);
  assert.ok(missingRequestedContext[0].warnings.some(w => w.code === "missing-tactical-template"));
  assert.ok(missingRequestedContext[0].warnings.some(w => w.code === "missing-tactical-raycast"));

  const gmDecisionTargets = normalizeTacticalTargets({
    targets: [{ id: "token-gm", actorUuid: "Actor.gm", name: "GM Target", snapshot: {} }],
    template: {
      templateId: "template-manual",
      type: "cone",
      origin: { x: 0, y: 0 },
      inclusion: "manual_decision"
    },
    raycast: {
      origin: { x: 0, y: 0 },
      destination: { x: 5, y: 5 },
      requiresGmDecision: true
    }
  });

  assert.equal(gmDecisionTargets[0].manualResolution.required, true);
  assert.ok(gmDecisionTargets[0].warnings.some(w => w.code === "manual-tactical-template"));
  assert.ok(gmDecisionTargets[0].warnings.some(w => w.code === "manual-tactical-raycast"));

  const ambiguousRaycastTargets = normalizeTacticalTargets({
    targets: [{ id: "token-ambiguous", actorUuid: "Actor.ambiguous", name: "Ambiguous Target", snapshot: {} }],
    raycast: {
      origin: { x: 0, y: 0 },
      destination: { x: 5, y: 5 },
      obstruction: { id: "wall-1" }, // missing type or name making it ambiguous
      requiresGmDecision: false
    }
  });

  assert.equal(ambiguousRaycastTargets[0].manualResolution.required, true);
  assert.ok(ambiguousRaycastTargets[0].warnings.some(w => w.code === "ambiguous-tactical-raycast"));

  assert.deepEqual(normalizeTacticalTargets(null), []);
  
  // Prove resolveCombatAction() remains the public seam for tactical flows
  // and accepts tactical context without breaking
  const tacticalContext = {
    action: {
      type: "ranged",
      fireMode: "semiauto",
      targetNumber: 15,
      options: {}
    },
    attacker: {
      actorUuid: "Actor.attacker",
      snapshot: { stats: { ref: { total: 10 } } }
    },
    weapon: {
      itemUuid: "Item.weapon",
      snapshot: { damage: "2d6", type: "P", accuracy: 0, attackSkill: "Handgun", attackType: "auto", rof: 2 }
    },
    targets: targets,
    legacy: {
      mode: "fallback",
      fallback: () => ({ targets: [{ target: targets[0] }] })
    }
  };
  
  // Stub a roller that guarantees a miss to just check routing
  const staticRoller = () => ({ id: "attack", total: 10, die: { result: 1 } });
  
  const outcome = await resolveCombatAction(tacticalContext, { structured: true }, staticRoller);
  assert.equal(outcome.targets.length, 1);
  assert.equal(outcome.targets[0].target.tactical.template.inclusion, "intersected");

  const previousCanvas = globalThis.canvas;
  const previousConfig = globalThis.CONFIG;
  try {
    delete globalThis.canvas;
    const manualRaycastTargets = await detectAndPromptTacticalRaycasts({ center: { x: 0, y: 0 } }, [{
      id: "token-manual",
      actorUuid: "Actor.manual",
      name: "Manual Target",
      snapshot: {}
    }]);
    assert.equal(manualRaycastTargets[0].manualResolution.required, true, "missing canvas marks raycast target manual");
    assert.ok(manualRaycastTargets[0].warnings.some(warning => warning.code === "manual-tactical-raycast"), "missing canvas adds raycast manual warning");

    globalThis.canvas = {
      ready: true,
      walls: {},
      grid: { size: 100 },
      scene: { grid: { distance: 2 } }
    };
    globalThis.CONFIG = {
      Canvas: {
        polygonBackends: {
          sight: {
            testCollision: () => null
          }
        }
      }
    };
    const staleTarget = {
      id: "token-stale",
      actorUuid: "Actor.stale",
      name: "Stale Target",
      snapshot: {},
      center: { x: 10, y: 0 },
      tactical: {
        raycast: { requiresGmDecision: true },
        cover: { applies: true, stoppingPower: 10 },
        selected: true
      }
    };
    const clearTargets = await detectAndPromptTacticalRaycasts({ center: { x: 0, y: 0 } }, [staleTarget]);
    assert.equal(clearTargets[0].tactical.raycast, undefined, "no-collision raycast clears stale raycast context");
    assert.equal(clearTargets[0].tactical.cover, undefined, "no-collision raycast clears stale cover context");
    assert.equal(staleTarget.tactical.cover.stoppingPower, 10, "raycast adapter does not mutate source target tactical data");
  } finally {
    globalThis.canvas = previousCanvas;
    globalThis.CONFIG = previousConfig;
  }
}

function assertBodyTypeDamageResolver() {
  assert.deepEqual(resolveBodyTypeDamage(0, 6), {
    penetratingDamage: 0,
    bodyTypeModifier: 2,
    bodyTypeMitigation: 0,
    finalDamage: 0,
    minimumDamageApplied: false
  }, "full armor stop skips BTM and minimum damage");

  assert.deepEqual(resolveBodyTypeDamage(5, 6), {
    penetratingDamage: 5,
    bodyTypeModifier: 2,
    bodyTypeMitigation: 2,
    finalDamage: 3,
    minimumDamageApplied: false
  }, "BTM partially reduces penetrating damage");

  assert.deepEqual(resolveBodyTypeDamage(1, 6), {
    penetratingDamage: 1,
    bodyTypeModifier: 2,
    bodyTypeMitigation: 0,
    finalDamage: 1,
    minimumDamageApplied: true
  }, "BTM cannot reduce penetrating damage below minimum 1");

  assert.deepEqual(resolveBodyTypeDamage(5, "not-a-number"), {
    penetratingDamage: 5,
    bodyTypeModifier: 0,
    bodyTypeMitigation: 0,
    finalDamage: 5,
    minimumDamageApplied: false
  }, "invalid Body Type does not become maximum BTM");

  // BT 13 — modifier 6 (was 5 before fix), 7 - 6 = 1, not minimum-forced
  assert.deepEqual(resolveBodyTypeDamage(7, 13), {
    penetratingDamage: 7,
    bodyTypeModifier: 6,
    bodyTypeMitigation: 6,
    finalDamage: 1,
    minimumDamageApplied: false
  }, "BT 13 BTM reduces penetrating damage to exactly 1 (not minimum-forced)");

  // BT 14 — modifier 6 (was 5 before fix), 5 - 6 = -1, forced to minimum 1
  assert.deepEqual(resolveBodyTypeDamage(5, 14), {
    penetratingDamage: 5,
    bodyTypeModifier: 6,
    bodyTypeMitigation: 4,
    finalDamage: 1,
    minimumDamageApplied: true
  }, "BT 14 BTM forces minimum damage when BTM exceeds penetrating damage");

  // BT 15 — modifier 8 (was 5 before fix), 10 - 8 = 2
  assert.deepEqual(resolveBodyTypeDamage(10, 15), {
    penetratingDamage: 10,
    bodyTypeModifier: 8,
    bodyTypeMitigation: 8,
    finalDamage: 2,
    minimumDamageApplied: false
  }, "BT 15 BTM correctly resolves to modifier 8");

  // BT 2 — modifier 0 (guard limit)
  assert.deepEqual(resolveBodyTypeDamage(5, 2), {
    penetratingDamage: 5,
    bodyTypeModifier: 0,
    bodyTypeMitigation: 0,
    finalDamage: 5,
    minimumDamageApplied: false
  }, "BT 2 BTM resolves to modifier 0");

  // BT 3 — modifier 1 (CP2020 p.106: BT 3-4 = -1)
  assert.deepEqual(resolveBodyTypeDamage(6, 3), {
    penetratingDamage: 6,
    bodyTypeModifier: 1,
    bodyTypeMitigation: 1,
    finalDamage: 5,
    minimumDamageApplied: false
  }, "BT 3 BTM resolves to modifier 1");

  // BT 4 — modifier 1
  assert.deepEqual(resolveBodyTypeDamage(5, 4), {
    penetratingDamage: 5,
    bodyTypeModifier: 1,
    bodyTypeMitigation: 1,
    finalDamage: 4,
    minimumDamageApplied: false
  }, "BT 4 BTM resolves to modifier 1");

  // BT 5 — modifier 2 (CP2020 p.106: BT 5-7 = -2)
  assert.deepEqual(resolveBodyTypeDamage(5, 5), {
    penetratingDamage: 5,
    bodyTypeModifier: 2,
    bodyTypeMitigation: 2,
    finalDamage: 3,
    minimumDamageApplied: false
  }, "BT 5 BTM resolves to modifier 2");

  // BT 7 — modifier 2 (CP2020 p.106: BT 5-7 = -2)
  assert.deepEqual(resolveBodyTypeDamage(5, 7), {
    penetratingDamage: 5,
    bodyTypeModifier: 2,
    bodyTypeMitigation: 2,
    finalDamage: 3,
    minimumDamageApplied: false
  }, "BT 7 BTM resolves to modifier 2");

  // BT 8 — modifier 3 (CP2020 p.106: BT 8-9 = -3)
  assert.deepEqual(resolveBodyTypeDamage(6, 8), {
    penetratingDamage: 6,
    bodyTypeModifier: 3,
    bodyTypeMitigation: 3,
    finalDamage: 3,
    minimumDamageApplied: false
  }, "BT 8 BTM resolves to modifier 3");

  // BT 9 — modifier 3 (CP2020 p.106: BT 8-9 = -3)
  assert.deepEqual(resolveBodyTypeDamage(4, 9), {
    penetratingDamage: 4,
    bodyTypeModifier: 3,
    bodyTypeMitigation: 3,
    finalDamage: 1,
    minimumDamageApplied: false
  }, "BT 9 BTM resolves to modifier 3; 4-3=1 exactly, no minimum forcing");

  // BT 11 — modifier 5 (explicit case)
  assert.deepEqual(resolveBodyTypeDamage(7, 11), {
    penetratingDamage: 7,
    bodyTypeModifier: 5,
    bodyTypeMitigation: 5,
    finalDamage: 2,
    minimumDamageApplied: false
  }, "BT 11 BTM resolves to modifier 5");

  // BT 12 — modifier 5 (explicit case)
  assert.deepEqual(resolveBodyTypeDamage(5, 12), {
    penetratingDamage: 5,
    bodyTypeModifier: 5,
    bodyTypeMitigation: 4,
    finalDamage: 1,
    minimumDamageApplied: true
  }, "BT 12 BTM forces minimum damage when BTM matches penetrating damage");

  // BT 10.5 — fractional input resolves to BT 10 (modifier 4)
  assert.deepEqual(resolveBodyTypeDamage(10, 10.5), {
    penetratingDamage: 10,
    bodyTypeModifier: 4,
    bodyTypeMitigation: 4,
    finalDamage: 6,
    minimumDamageApplied: false
  }, "fractional BT 10.5 resolves to BT 10 modifier 4");

  // BT "13" — string input resolves to modifier 6
  assert.deepEqual(resolveBodyTypeDamage(7, "13"), {
    penetratingDamage: 7,
    bodyTypeModifier: 6,
    bodyTypeMitigation: 6,
    finalDamage: 1,
    minimumDamageApplied: false
  }, "string BT '13' resolves to BT 13 modifier 6");
}

function assertWoundPlanning() {
  const torsoOutcome = buildWoundOutcome({
    currentDamage: 3,
    location: "torso",
    finalDamage: 2
  });
  const torsoPlan = planCombatUpdates(torsoOutcome);
  assert.deepEqual(torsoPlan.actorUpdates, [
    {
      actorUuid: "Actor.target",
      update: {
        "system.damage": 5
      }
    }
  ], "wound planning advances target damage");
  assert.deepEqual(torsoOutcome.targets[0].hits[0].woundTransition, {
    previousDamage: 3,
    damageDelta: 2,
    nextDamage: 5,
    previousWoundState: {
      level: 1,
      label: "Light"
    },
    nextWoundState: {
      level: 2,
      label: "Serious"
    },
    crossedThreshold: true
  }, "wound planning records wound transition evidence");

  const criticalOutcome = buildWoundOutcome({
    currentDamage: 7,
    location: "torso",
    finalDamage: 2
  });
  planCombatUpdates(criticalOutcome);
  assert.deepEqual(criticalOutcome.targets[0].damage.nextWoundState, {
    level: 3,
    label: "Critical"
  }, "wound planning records Critical transition");

  const mortalOutcome = buildWoundOutcome({
    currentDamage: 11,
    location: "torso",
    finalDamage: 2
  });
  planCombatUpdates(mortalOutcome);
  assert.deepEqual(mortalOutcome.targets[0].damage.nextWoundState, {
    level: 4,
    label: "Mortal 0"
  }, "wound planning records Mortal transition");

  const headOutcome = buildWoundOutcome({
    currentDamage: 0,
    location: "Head",
    finalDamage: 5
  });
  const headPlan = planCombatUpdates(headOutcome);
  assert.deepEqual(headPlan.actorUpdates[0].update, {
    "system.damage": 10
  }, "head hit doubles wound damage");
  assert.equal(headOutcome.targets[0].hits[0].woundDamage, 10, "head hit exposes wound damage");
  assert.deepEqual(headOutcome.targets[0].hits[0].specialCases, [
    {
      code: "head-hit-double-damage",
      damageMultiplier: 2,
      damageBeforeMultiplier: 5,
      damageAfterMultiplier: 10
    },
    {
      code: "head-critical-injury",
      threshold: 8,
      woundDamage: 10
    }
  ], "head hit exposes special cases without save prompts");
  assert.deepEqual(headOutcome.targets[0].hits[0].warnings, [
    {
      code: "head-critical-injury",
      severity: "warning",
      message: "Head hit exceeded 8 damage in one attack; target is killed automatically unless the referee overrides the special case."
    }
  ], "head threshold surfaces automatic-death warning");

  const labeledHeadOutcome = buildWoundOutcome({
    currentDamage: 0,
    location: "skull",
    locationLabel: "Head",
    finalDamage: 2
  });
  planCombatUpdates(labeledHeadOutcome);
  assert.equal(labeledHeadOutcome.targets[0].hits[0].woundDamage, 4, "head label doubles wound damage even when key differs");

  const limbOutcome = buildWoundOutcome({
    currentDamage: 0,
    location: "rArm",
    finalDamage: 9
  });
  planCombatUpdates(limbOutcome);
  assert.deepEqual(limbOutcome.targets[0].hits[0].warnings, [
    {
      code: "limb-loss-threshold",
      severity: "warning",
      message: "Limb hit exceeded 8 damage in one attack; limb is severed or crushed and requires follow-up resolution."
    }
  ], "limb threshold surfaces warning");

  const stoppedOutcome = buildWoundOutcome({
    currentDamage: 4,
    location: "torso",
    finalDamage: 0
  });
  const stoppedPlan = planCombatUpdates(stoppedOutcome);
  assert.deepEqual(stoppedPlan.actorUpdates, [], "full stop does not plan target damage");
  assert.equal(stoppedOutcome.targets[0].hits[0].woundTransition, undefined, "full stop does not add wound transition");

  stoppedOutcome.targets[0].hits[0].woundDamage = 9;
  stoppedOutcome.targets[0].hits[0].woundTransition = { stale: true };
  stoppedOutcome.targets[0].hits[0].specialCases = [{ code: "head-critical-injury" }];
  planCombatUpdates(stoppedOutcome);
  assert.equal(stoppedOutcome.targets[0].hits[0].woundDamage, undefined, "replanning clears stale wound damage");
  assert.equal(stoppedOutcome.targets[0].hits[0].woundTransition, undefined, "replanning clears stale wound transition");
  assert.equal(stoppedOutcome.targets[0].hits[0].specialCases, undefined, "replanning clears stale special cases");

  const missingDamageOutcome = buildWoundOutcome({
    currentDamage: undefined,
    location: "torso",
    finalDamage: 2
  });
  const missingDamagePlan = planCombatUpdates(missingDamageOutcome);
  assert.deepEqual(missingDamagePlan.actorUpdates, [], "missing damage snapshot does not plan target damage");
  assert.deepEqual(missingDamagePlan.warnings, [
    {
      code: "missing-target-damage-state",
      severity: "warning",
      message: "Target damage state is unavailable; resolve target damage manually before committing wound updates."
    }
  ], "missing damage snapshot produces unsafe plan warning");

  const fractionalDamageOutcome = buildWoundOutcome({
    currentDamage: 0,
    location: "torso",
    finalDamage: 1.5
  });
  const fractionalDamagePlan = planCombatUpdates(fractionalDamageOutcome);
  assert.deepEqual(fractionalDamagePlan.actorUpdates, [], "fractional final damage does not plan target damage");
  assert.deepEqual(fractionalDamagePlan.warnings, [
    {
      code: "invalid-wound-damage",
      severity: "warning",
      message: "Wound damage must be a non-negative integer before it can be planned."
    }
  ], "fractional final damage produces unsafe plan warning");

  const existingSpecialCaseOutcome = buildWoundOutcome({
    currentDamage: 0,
    location: "rArm",
    finalDamage: 9,
    specialCases: [{ code: "existing-special-case" }]
  });
  planCombatUpdates(existingSpecialCaseOutcome);
  assert.deepEqual(existingSpecialCaseOutcome.targets[0].hits[0].specialCases, [
    {
      code: "existing-special-case"
    },
    {
      code: "limb-loss-threshold",
      threshold: 8,
      woundDamage: 9
    }
  ], "wound planning preserves existing special cases");
}

function assertSavePromptResolution() {
  assert.deepEqual(resolveSavePromptsForTarget(buildWoundOutcome({
    currentDamage: 3,
    location: "torso",
    finalDamage: 2
  }).targets[0]), {
    saves: [
      {
        type: "stun",
        status: "pending",
        reason: "damage-taken",
        bodyType: 6,
        threshold: 5,
        targetNumber: 5,
        penalty: 1,
        woundState: {
          level: 2,
          label: "Serious"
        },
        evidence: {
          previousDamage: 3,
          nextDamage: 5,
          damageDelta: 2
        }
      }
    ],
    warnings: []
  }, "Serious wound damage creates pending Stun/Shock prompt");

  assert.deepEqual(resolveSavePromptsForTarget(buildWoundOutcome({
    currentDamage: 11,
    location: "torso",
    finalDamage: 2
  }).targets[0]), {
    saves: [
      {
        type: "stun",
        status: "pending",
        reason: "damage-taken",
        bodyType: 6,
        threshold: 3,
        targetNumber: 3,
        penalty: 3,
        woundState: {
          level: 4,
          label: "Mortal 0"
        },
        evidence: {
          previousDamage: 11,
          nextDamage: 13,
          damageDelta: 2
        }
      },
      {
        type: "death",
        status: "pending",
        reason: "mortal-wound",
        bodyType: 6,
        threshold: 6,
        targetNumber: 6,
        penalty: 0,
        mortalLevel: 0,
        woundState: {
          level: 4,
          label: "Mortal 0"
        },
        evidence: {
          previousDamage: 11,
          nextDamage: 13,
          damageDelta: 2
        }
      }
    ],
    warnings: []
  }, "Mortal wound damage creates pending Stun/Shock and Death prompts");

  assert.deepEqual(resolveSavePromptsForTarget(buildWoundOutcome({
    currentDamage: 13,
    location: "torso",
    finalDamage: 0
  }).targets[0]), {
    saves: [],
    warnings: []
  }, "Existing Mortal target does not receive attack-time recurring Death Save reminder");

  assert.deepEqual(resolveSavePromptsForTarget(buildWoundOutcome({
    currentDamage: 41,
    location: "torso",
    finalDamage: 2
  }).targets[0]), {
    saves: [],
    warnings: [
      {
        code: "target-already-dead",
        severity: "warning",
        message: "Target is dead or Mortal 7+; do not generate a new Death Save prompt."
      }
    ]
  }, "Mortal 7+ target receives no new Stun/Shock or Death prompt");

  assert.deepEqual(resolveSavePromptsForTarget(buildWoundOutcome({
    currentDamage: 13,
    location: "torso",
    finalDamage: 2,
    deathSaveState: {
      stabilized: true
    }
  }).targets[0]), {
    saves: [
      {
        type: "stun",
        status: "pending",
        reason: "damage-taken",
        bodyType: 6,
        threshold: 3,
        targetNumber: 3,
        penalty: 3,
        woundState: {
          level: 4,
          label: "Mortal 0"
        },
        evidence: {
          previousDamage: 13,
          nextDamage: 15,
          damageDelta: 2
        }
      }
    ],
    warnings: []
  }, "Stabilized Mortal target suppresses attack-time Death prompts while preserving Stun/Shock");

  const noDamageOutcome = buildWoundOutcome({
    currentDamage: 4,
    location: "torso",
    finalDamage: 0
  });
  const noDamagePlan = planCombatUpdates(noDamageOutcome);
  assert.deepEqual(noDamageOutcome.targets[0].saves, [], "no-damage non-Mortal target receives no save prompts");
  assert.deepEqual(noDamagePlan.warnings, [], "no-damage non-Mortal target does not warn");

  const missingBodyTypeOutcome = buildWoundOutcome({
    currentDamage: 3,
    location: "torso",
    finalDamage: 2,
    bodyType: null
  });
  const missingBodyTypePlan = planCombatUpdates(missingBodyTypeOutcome);
  assert.deepEqual(missingBodyTypeOutcome.targets[0].saves, [], "missing Body Type blocks save prompts");
  assert.deepEqual(missingBodyTypePlan.warnings, [
    {
      code: "missing-target-body-type",
      severity: "warning",
      message: "Target Body Type is unavailable; resolve Stun/Shock and Death Saves manually."
    }
  ], "missing Body Type produces manual save warning");

  const criticalOutcome = buildWoundOutcome({
    currentDamage: 7,
    location: "torso",
    finalDamage: 2
  });
  const criticalPlan = planCombatUpdates(criticalOutcome);
  assert.deepEqual(criticalOutcome.targets[0].saves, [
    {
      type: "stun",
      status: "pending",
      reason: "damage-taken",
      bodyType: 6,
      threshold: 4,
      targetNumber: 4,
      penalty: 2,
      woundState: {
        level: 3,
        label: "Critical"
      },
      evidence: {
        previousDamage: 7,
        nextDamage: 9,
        damageDelta: 2
      }
    }
  ], "planning attaches Critical Stun/Shock prompt to outcome");
  assert.deepEqual(buildCombatChatData(criticalOutcome, criticalPlan).targets[0].saves, criticalOutcome.targets[0].saves, "chat data exposes save prompts");
}

function assertDeathSaveStateHelpers() {
  assert.equal(requiresRecurringDeathSave({ system: { damage: 13, stats: { bt: { total: 6 } } } }), true, "Mortal actor requires recurring Death Save");
  assert.equal(requiresRecurringDeathSave({ system: { damage: 12, stats: { bt: { total: 6 } } } }), false, "Critical actor does not require recurring Death Save");
  assert.equal(requiresRecurringDeathSave({ system: { damage: 13, deathSave: { stabilized: true }, stats: { bt: { total: 6 } } } }), false, "stabilized Mortal actor suppresses recurring Death Save");
  assert.equal(requiresRecurringDeathSave({ system: { damage: 41, stats: { bt: { total: 6 } } } }), false, "Mortal 7+ actor is treated as dead");
  assert.equal(isActorDeadForDeathSaves({ system: { deathSave: { failed: true } } }), true, "failed death save state is dead");
  assert.equal(isActorStabilizedForDeathSaves({ system: { deathSave: { stabilized: true } } }), true, "deathSave.stabilized is recognized");
}

function buildWoundOutcome({ currentDamage, location, locationLabel = undefined, finalDamage, specialCases = undefined, bodyType = 6, deathSaveState = undefined }) {
  const stats = bodyType === undefined
    ? {}
    : {
        bt: {
          total: bodyType
        }
      };
  return {
    targets: [
      {
        target: {
          actorUuid: "Actor.target",
          snapshot: {
            stats,
            damage: currentDamage,
            ...(deathSaveState ? { deathSave: deathSaveState } : {})
          }
        },
        manualResolution: {
          required: false
        },
        hits: [
          {
            location,
            locationLabel,
            finalDamage,
            specialCases,
            warnings: []
          }
        ]
      }
    ],
    plannedUpdates: {
      chatStatus: "preview"
    }
  };
}

function assertOutcomeShape(outcome, expected) {
  assert.equal(outcome.action.type, expected.actionType, "outcome action type");
  assert.equal(outcome.action.fireMode, expected.fireMode, "outcome fire mode");
  assert.ok(outcome.attacker.actorUuid, "outcome attacker actor UUID");
  assert.ok(outcome.weapon.itemUuid, "outcome weapon item UUID");
  assert.equal(outcome.targets.length, 1, "outcome target count");
  assert.equal(outcome.targets[0].attack.roll.total, expected.attackTotal, "outcome attack total");
  assert.equal(outcome.targets[0].attack.targetNumber, expected.targetNumber, "outcome target number");
  assert.equal(outcome.targets[0].attack.hit, expected.hit, "outcome hit flag");
  assert.equal(outcome.targets[0].hits[0].location, expected.location, "outcome hit location");
  assert.equal(outcome.targets[0].hits[0].rawDamage, expected.rawDamage, "outcome raw damage");
  assert.equal(outcome.targets[0].hits[0].effectiveStoppingPower, expected.effectiveStoppingPower, "outcome armor evidence");
  assert.equal(outcome.targets[0].hits[0].armorMitigation, expected.armorMitigation, "outcome armor mitigation");
  if("penetratingDamage" in expected) {
    assert.equal(outcome.targets[0].hits[0].penetratingDamage, expected.penetratingDamage, "outcome penetrating damage");
  }
  if("bodyTypeModifier" in expected) {
    assert.equal(outcome.targets[0].hits[0].bodyTypeModifier, expected.bodyTypeModifier, "outcome body type modifier");
  }
  assert.equal(outcome.targets[0].hits[0].bodyTypeMitigation, expected.bodyTypeMitigation, "outcome body type mitigation");
  if("minimumDamageApplied" in expected) {
    assert.equal(outcome.targets[0].hits[0].minimumDamageApplied, expected.minimumDamageApplied, "outcome minimum damage evidence");
  }
  assert.equal(outcome.targets[0].hits[0].finalDamage, expected.finalDamage, "outcome final damage");
  assert.deepEqual(outcome.targets[0].attack.roll, expected.rolls.attack, "outcome attack roll metadata");
  assert.deepEqual(outcome.targets[0].hits[0].locationRoll, expected.rolls.location, "outcome location roll metadata");
  assert.deepEqual(outcome.targets[0].hits[0].damageRoll, expected.rolls.damage, "outcome damage roll metadata");
  assert.equal(outcome.chat.status, expected.chatStatus, "outcome chat status");
}

function clonePlainData(data) {
  return JSON.parse(JSON.stringify(data));
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

function isPlainObject(value) {
  return !!value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype;
}

function assertObjectIncludes(actual, expected, message) {
  if(Array.isArray(expected)) {
    assert.ok(Array.isArray(actual), `${message} should be an array`);
    assert.equal(actual.length, expected.length, `${message} length`);
    expected.forEach((expectedValue, index) => {
      if(isPlainObject(expectedValue) || Array.isArray(expectedValue)) {
        assertObjectIncludes(actual[index], expectedValue, `${message}[${index}]`);
      }
      else {
        assert.deepEqual(actual[index], expectedValue, `${message}[${index}]`);
      }
    });
    return;
  }

  for(const [key, expectedValue] of Object.entries(expected)) {
    if(isPlainObject(expectedValue) || Array.isArray(expectedValue)) {
      assertObjectIncludes(actual?.[key], expectedValue, `${message}.${key}`);
    }
    else {
      assert.deepEqual(actual?.[key], expectedValue, `${message}.${key}`);
    }
  }
}

function reviveFixtureSentinels(data) {
  if(Array.isArray(data)) {
    return data.map(value => reviveFixtureSentinels(value));
  }
  if(data && typeof data === "object") {
    for(const [key, value] of Object.entries(data)) {
      data[key] = reviveFixtureSentinels(value);
    }
    return data;
  }
  if(data === "__UNDEFINED__") {
    return undefined;
  }
  return data;
}

function assertArmorResolver() {
  // Test target snapshot structure with a mix of equipped/unequipped armor and cyberware
  const targetSnapshot = {
    stats: {
      body: { total: 6 }
    },
    hitLocations: {
      torso: { stoppingPower: 99, label: "Torso" } // Pre-summed SP that must be ignored!
    },
    equippedArmor: [
      {
        id: "armor-torso-1",
        name: "Light Kevlar Vest",
        type: "armor",
        system: {
          equipped: true,
          coverage: {
            torso: { stoppingPower: 10, ablation: 0, layer: "soft" },
            rarm: { stoppingPower: 6, ablation: 1, layer: "soft" }
          }
        }
      },
      {
        id: "armor-torso-2",
        name: "MetalGear",
        type: "armor",
        system: {
          equipped: true,
          coverage: {
            torso: { sp: 25, ablation: 2, layer: "hard" }
          }
        }
      },
      {
        id: "armor-unequipped",
        name: "Unequipped Vest",
        type: "armor",
        system: {
          equipped: false,
          coverage: {
            torso: { stoppingPower: 12, ablation: 0 }
          }
        }
      }
    ],
    equippedCyberware: [
      {
        id: "cyberware-subdermal",
        name: "Subdermal Armor",
        type: "cyberware",
        system: {
          equipped: true,
          stoppingPower: 2,
          ablation: 0,
          layer: "hard"
        }
      },
      {
        id: "cyberware-skinweave",
        name: "Skinweave SP12",
        type: "cyberware",
        system: {
          equipped: true,
          cyberwareType: "BIOWARE",
          cyberwareSubtype: "SKINWEAVE",
          flavor: "12 SP;50% chance-1 ATTR loss",
          source: "Cyberpunk 2020 2nd ed. pg.85"
        }
      },
      {
        id: "cyberware-skull",
        name: "Subdermal Skull Armor SP6",
        type: "cyberware",
        system: {
          equipped: true,
          cyberwareType: "IMPLANT",
          cyberwareSubtype: "SUBDERMAL ARMOR",
          flavor: "6SP; DIFF 30 to spot"
        }
      },
      {
        id: "cyberware-unequipped",
        name: "Unequipped Skin Weave",
        type: "cyberware",
        system: {
          equipped: false,
          stoppingPower: 4,
          ablation: 0
        }
      }
    ]
  };

  // 1. Test getEquippedArmorForLocation with Torso (case-insensitive)
  const torsoLayers = getEquippedArmorForLocation(targetSnapshot, "Torso");
  assert.equal(torsoLayers.length, 4, "should extract 4 layers for Torso (2 armor, 2 cyberware)");

  // Verify details of armor-torso-1
  const layer1 = torsoLayers.find(l => l.id === "armor-torso-1");
  assert.ok(layer1, "layer 1 exists");
  assert.equal(layer1.stoppingPower, 10, "layer 1 SP");
  assert.equal(layer1.type, "armor", "layer 1 type");
  assert.equal(layer1.layer, "soft", "layer 1 material");

  // Verify details of MetalGear (uses alternative 'sp' property)
  const layer2 = torsoLayers.find(l => l.id === "armor-torso-2");
  assert.ok(layer2, "layer 2 exists");
  assert.equal(layer2.stoppingPower, 23, "layer 2 usable SP accounts for ablation");
  assert.equal(layer2.type, "armor", "layer 2 type");
  assert.equal(layer2.layer, "hard", "layer 2 material");

  // Verify details of subdermal armor
  const cyberLayer = torsoLayers.find(l => l.id === "cyberware-subdermal");
  assert.ok(cyberLayer, "cyberware layer exists");
  assert.equal(cyberLayer.stoppingPower, 2, "cyberware SP");
  assert.equal(cyberLayer.type, "cyberware", "cyberware type");
  assert.equal(cyberLayer.layer, "hard", "cyberware material");
  assert.equal(cyberLayer.ablation, 0, "cyberware layer preserves current ablation");
  assert.equal(cyberLayer.updatePath, "system.ablation", "cyberware layer exposes ablation update path");

  const skinweaveLayer = torsoLayers.find(l => l.id === "cyberware-skinweave");
  assert.ok(skinweaveLayer, "skinweave layer exists");
  assert.equal(skinweaveLayer.stoppingPower, 12, "skinweave SP is parsed from existing pack-style text");
  assert.equal(skinweaveLayer.layer, "soft", "pack-style skinweave defaults to soft layer");
  assert.equal(skinweaveLayer.source, "Cyberpunk 2020 2nd ed. pg.85", "skinweave source is preserved");
  assert.equal(skinweaveLayer.updatePath, "system.ablation", "skinweave layer exposes cyberware ablation update path");
  assert.ok(!torsoLayers.some(l => l.id === "cyberware-skull"), "skull-only subdermal armor does not cover torso");

  const zonedSkinweaveSnapshot = {
    equippedCyberware: [
      {
        id: "zoned-skinweave",
        name: "Skinweave SP12",
        type: "cyberware",
        system: {
          equipped: true,
          cyberwareSubtype: "SKINWEAVE",
          coverage: {
            Torso: { stoppingPower: 12, ablation: 2, layer: "soft" },
            rArm: { stoppingPower: 12, ablation: 0, layer: "soft" }
          }
        }
      }
    ]
  };
  const zonedSkinweaveTorso = getEquippedArmorForLocation(zonedSkinweaveSnapshot, "torso")[0];
  assert.equal(zonedSkinweaveTorso.stoppingPower, 10, "zoned skinweave torso SP accounts for torso ablation only");
  assert.equal(zonedSkinweaveTorso.coverageKey, "Torso", "zoned skinweave preserves matched coverage key");
  assert.equal(zonedSkinweaveTorso.updatePath, "system.coverage.Torso.ablation", "zoned skinweave ablates the hit location");
  const zonedSkinweaveRarm = getEquippedArmorForLocation(zonedSkinweaveSnapshot, "rarm")[0];
  assert.equal(zonedSkinweaveRarm.stoppingPower, 12, "zoned skinweave arm SP ignores torso ablation");
  assert.equal(zonedSkinweaveRarm.updatePath, "system.coverage.rArm.ablation", "zoned skinweave keeps per-location ablation path");

  const headLayers = getEquippedArmorForLocation(targetSnapshot, "Head");
  const skullLayer = headLayers.find(l => l.id === "cyberware-skull");
  assert.ok(skullLayer, "skull subdermal armor covers head");
  assert.equal(skullLayer.stoppingPower, 6, "skull subdermal SP is parsed from name/flavor");

  // Verify that unequipped layers are ignored
  assert.ok(!torsoLayers.some(l => l.id === "armor-unequipped"), "unequipped armor is ignored");
  assert.ok(!torsoLayers.some(l => l.id === "cyberware-unequipped"), "unequipped cyberware is ignored");

  // 2. Test resolveArmor
  // Inside-out proportional resolution combines cyberware, armor, then outer layers.
  const resolvedNonAP = resolveArmor(false, targetSnapshot, "torso");
  assert.equal(resolvedNonAP.effectiveStoppingPower, 28, "non-AP effective stopping power uses proportional layering with ablation");
  assert.equal(resolvedNonAP.armorPiercing, false, "armorPiercing flag is false");
  assert.equal(resolvedNonAP.rawStoppingPower, 28, "raw stopping power reflects ablated layers before AP");

  // AP behavior is preserved from 3.1 until full AP semantics are handled in 3.3.
  const resolvedAP = resolveArmor(true, targetSnapshot, "torso");
  assert.equal(resolvedAP.effectiveStoppingPower, 14, "AP effective stopping power is halved after proportional layering");
  assert.equal(resolvedAP.armorPiercing, true, "armorPiercing flag is true");
  assert.deepEqual(resolvedAP.armorPiercingEvidence, {
    applied: true,
    rawStoppingPower: 28,
    effectiveStoppingPower: 14,
    coverRawStoppingPower: 0,
    coverEffectiveStoppingPower: 0,
    personalRawStoppingPower: 28,
    personalEffectiveStoppingPower: 14,
    armorDivisor: 2,
    penetratingDamageDivisor: 2
  }, "AP evidence describes both armor and penetrating-damage divisors");
  assert.equal(resolvedAP.warnings.length, 2, "four active torso layers with multiple hard layers produce warnings");
  assert.deepEqual(resolvedAP.warnings.map(warning => warning.code), ["armor-too-many-layers", "armor-multiple-hard-layers"]);

  assert.equal(layer1.baseStoppingPower, 10, "armor layer preserves base SP");
  assert.equal(layer1.coverageKey, "torso", "armor layer preserves original coverage key");
  assert.equal(layer1.ablation, 0, "armor layer preserves current ablation");
  assert.equal(layer1.updatePath, "system.coverage.torso.ablation", "armor layer exposes ablation update path");
  assert.equal(layer2.baseStoppingPower, 25, "ablated armor layer preserves base SP");
  assert.equal(layer2.stoppingPower, 23, "ablated armor layer reduces usable SP");
  assert.equal(layer2.coverageKey, "torso", "alternative sp coverage preserves original key");

  // Skinweave and generic subdermal armor cover all locations, so rarm has three proportional layers.
  const resolvedRarmAP = resolveArmor(true, targetSnapshot, "rarm");
  assert.equal(resolvedRarmAP.effectiveStoppingPower, 9, "AP halves proportional 18 SP to 9");

  const layeredSnapshot = {
    equippedArmor: [
      {
        id: "soft-jacket",
        name: "Armor Jacket",
        system: {
          equipped: true,
          coverage: {
            torso: { stoppingPower: 10, layer: "soft" }
          }
        }
      },
      {
        id: "hard-plate",
        name: "Hard Plate",
        system: {
          equipped: true,
          coverage: {
            torso: { stoppingPower: 12, layer: "hard" }
          }
        }
      }
    ]
  };

  const layeredArmor = resolveArmor(false, layeredSnapshot, "torso");
  assert.equal(layeredArmor.effectiveStoppingPower, 17, "0-4 SP difference adds +5 to larger SP");
  assert.deepEqual(layeredArmor.layers.map(layer => layer.id), ["soft-jacket", "hard-plate"], "armor layers remain inspectable");

  const coveredArmor = resolveArmor(false, layeredSnapshot, "torso", {
    cover: {
      name: "Concrete Barrier",
      stoppingPower: 8,
      layer: "hard",
      source: "manual cover"
    }
  });
  assert.equal(coveredArmor.effectiveStoppingPower, 25, "cover is resolved first, then personal armor mitigation is added sequentially");
  assert.equal(coveredArmor.layers.at(-1).type, "cover", "manual cover is appended as a cover layer");
  assert.equal(coveredArmor.layers.at(-1).source, "manual cover", "manual cover source is preserved");

  const emptyLocationCover = resolveArmor(false, layeredSnapshot, "torso", {
    cover: {
      name: "Narrow Barrier",
      stoppingPower: 8,
      protectedLocations: [],
      source: "raycast-gm"
    }
  });
  assert.equal(emptyLocationCover.cover.present, false, "empty protected location list bypasses cover for every hit");
  assert.equal(emptyLocationCover.cover.bypassed, true, "bypassed cover remains visible as cover evidence");
  assert.equal(emptyLocationCover.cover.bypassReason, "hit-location-unprotected", "empty protected location list records the bypass reason");

  const aliasedLocationCover = resolveArmor(false, layeredSnapshot, "lArm", {
    cover: {
      name: "Door Frame",
      stoppingPower: 8,
      protectedLocations: ["leftArm"],
      source: "raycast-gm"
    }
  });
  assert.equal(aliasedLocationCover.cover.present, true, "leftArm protected location aliases match lArm hits");
  assert.equal(aliasedLocationCover.cover.effectiveStoppingPower, 8, "aliased protected cover applies full SP before ablation");

  const ablatedCover = resolveArmor(false, layeredSnapshot, "torso", {
    cover: {
      name: "Concrete Barrier",
      stoppingPower: 8,
      ablation: 3,
      protectedLocations: ["Torso"],
      source: "raycast-gm",
      transient: true
    }
  });
  assert.equal(ablatedCover.cover.baseStoppingPower, 8, "cover evidence keeps base SP");
  assert.equal(ablatedCover.cover.ablation, 3, "cover evidence keeps transient ablation");
  assert.equal(ablatedCover.cover.effectiveStoppingPower, 5, "transient cover ablation degrades effective Cover SP");

  const skinweaveAndHardArmor = resolveArmor(false, {
    equippedArmor: [
      {
        id: "hard-plate",
        name: "Hard Plate",
        system: {
          equipped: true,
          coverage: {
            torso: { stoppingPower: 12, layer: "hard" }
          }
        }
      }
    ],
    equippedCyberware: [
      {
        id: "cyberware-skinweave",
        name: "Skinweave SP12",
        system: {
          equipped: true,
          cyberwareSubtype: "SKINWEAVE",
          flavor: "12 SP"
        }
      }
    ]
  }, "torso");
  assert.equal(skinweaveAndHardArmor.warnings.length, 0, "skinweave plus one hard layer is not a multi-hard violation");

  const explicitSkinweaveLayer = getEquippedArmorForLocation({
    equippedCyberware: [
      {
        id: "explicit-skinweave",
        name: "Skinweave SP12",
        system: {
          equipped: true,
          layer: "hard",
          flavor: "12 SP"
        }
      }
    ]
  }, "torso")[0];
  assert.equal(explicitSkinweaveLayer.layer, "hard", "explicit cyberware layer overrides Skinweave default");

  const warningSnapshot = {
    equippedArmor: [
      ...layeredSnapshot.equippedArmor,
      {
        id: "second-hard-plate",
        name: "Second Hard Plate",
        system: {
          equipped: true,
          coverage: {
            torso: { stoppingPower: 8, layer: "hard" }
          }
        }
      }
    ]
  };
  const warningArmor = resolveArmor(false, warningSnapshot, "torso", {
    cover: {
      name: "Concrete Barrier",
      stoppingPower: 8,
      layer: "hard",
      source: "manual cover"
    }
  });
  assert.equal(warningArmor.warnings.length, 1, "cover-specific hard layers do not create false multi-hard warnings against personal armor");
  assert.deepEqual(warningArmor.warnings.map(warning => warning.code), ["armor-multiple-hard-layers"]);

  const casePreservingArmor = resolveArmor(false, {
    equippedArmor: [
      {
        id: "case-vest",
        name: "Case Vest",
        system: {
          equipped: true,
          coverage: {
            Torso: { stoppingPower: 10, ablation: 3, layer: "soft" }
          }
        }
      }
    ]
  }, "torso");
  assert.equal(casePreservingArmor.layers[0].coverageKey, "Torso", "original coverage key case is preserved");
  assert.equal(casePreservingArmor.layers[0].stoppingPower, 7, "existing ablation reduces usable stopping power");
  assert.equal(casePreservingArmor.layers[0].updatePath, "system.coverage.Torso.ablation", "update path preserves original coverage key");
}

async function assertZonedCyberwareArmorHitPlanning() {
  const context = {
    action: {
      type: "ranged",
      fireMode: "semiAuto",
      range: "medium",
      targetNumber: 15,
      options: {
        targetArea: "torso",
        stagedPenetration: true
      }
    },
    attacker: {
      actorUuid: "Actor.attacker",
      name: "Solo",
      snapshot: {
        stats: {
          ref: { total: 8 }
        },
        skills: {
          handgun: { level: 6 }
        }
      }
    },
    weapon: {
      itemUuid: "Actor.attacker.Item.heavy-pistol",
      name: "Heavy Pistol",
      snapshot: {
        damage: "4d6",
        ap: false,
        shotsLeft: 10,
        rof: 2,
        reliability: "standard",
        attackType: "Auto",
        attackSkill: "handgun"
      }
    },
    targets: [
      {
        actorUuid: "Actor.target",
        tokenUuid: "Scene.test.Token.target",
        name: "Target",
        snapshot: {
          stats: {
            bt: { total: 6 }
          },
          damage: 0,
          hitLocations: {
            torso: { label: "Torso" }
          },
          equippedCyberware: [
            {
              id: "zoned-skinweave",
              name: "Skinweave",
              type: "cyberware",
              system: {
                equipped: true,
                cyberwareSubtype: "SKINWEAVE",
                coverage: {
                  Torso: { stoppingPower: 12, ablation: 1, layer: "soft" },
                  rArm: { stoppingPower: 12, ablation: 0, layer: "soft" }
                }
              }
            }
          ]
        }
      }
    ],
    legacy: {
      fallback: () => ({ manualResolution: { required: true }, targets: [] })
    }
  };
  const roller = createScriptedRoller([
    {
      id: "attack",
      total: 21,
      die: { faces: 10, natural: 9, results: [9], exploded: false }
    },
    {
      id: "damage",
      formula: "4d6",
      total: 14,
      die: { faces: 6, natural: 14, results: [4, 4, 3, 3] }
    }
  ]);

  const outcome = await resolveCombatAction(context, { structured: true }, roller);
  roller.assertComplete();
  const hit = outcome.targets[0].hits[0];
  assert.equal(hit.effectiveStoppingPower, 11, "zoned skinweave hit uses ablated SP for the hit location");
  assert.equal(hit.stagedPenetration.updatePath, "system.coverage.Torso.ablation", "zoned skinweave hit records a location-specific update path");

  const plannedUpdates = planCombatUpdates(outcome);
  assert.deepEqual(plannedUpdates.embeddedItemUpdates, [
    {
      actorUuid: "Actor.target",
      type: "Item",
      updates: [
        {
          _id: "zoned-skinweave",
          "system.coverage.Torso.ablation": 2
        }
      ]
    }
  ], "zoned skinweave hit plans ablation only for the struck location");

  const coverContext = {
    action: {
      type: "ranged",
      fireMode: "threeroundburst",
      range: "medium",
      targetNumber: 15,
      targetArea: "torso",
      options: {
        targetArea: "torso",
        stagedPenetration: true
      }
    },
    attacker: {
      actorUuid: "Actor.attacker",
      name: "Solo",
      snapshot: {
        stats: {
          ref: { total: 8 }
        },
        skills: {
          handgun: { level: 6 }
        }
      }
    },
    weapon: {
      itemUuid: "Actor.attacker.Item.heavy-pistol",
      name: "Heavy Pistol",
      snapshot: {
        damage: "4d6",
        ap: false,
        shotsLeft: 3,
        rof: 2,
        reliability: "standard",
        attackType: "Auto",
        attackSkill: "handgun"
      }
    },
    targets: [
      {
        actorUuid: "Actor.target",
        tokenUuid: "Scene.test.Token.target",
        name: "Target",
        tactical: {
          raycast: {
            origin: { x: 0, y: 0 },
            destination: { x: 10, y: 0 },
            obstruction: { id: "wall-1", uuid: "Scene.test.Wall.1", type: "wall", name: "Concrete Wall" },
            obstructionDistance: 4,
            firstTarget: true,
            requiresGmDecision: false
          },
          cover: {
            applies: true,
            stoppingPower: 8,
            protectedLocations: ["Torso"],
            source: "raycast-gm",
            transient: true
          }
        },
        snapshot: {
          stats: {
            bt: { total: 6 }
          },
          damage: 0,
          hitLocations: {
            torso: { label: "Torso" }
          }
        }
      }
    ],
    legacy: {
      fallback: () => ({ manualResolution: { required: true }, targets: [] })
    }
  };
  const coverRoller = createScriptedRoller([
    { id: "attack", total: 24, die: { faces: 10, natural: 10, results: [10], exploded: false } },
    { id: "burst_hits", total: 2, die: { faces: 3, natural: 2, results: [2], exploded: false } },
    { id: "damage", formula: "4d6", total: 10, die: { faces: 6, natural: 10, results: [3, 3, 2, 2] } },
    { id: "damage", formula: "4d6", total: 10, die: { faces: 6, natural: 10, results: [3, 3, 2, 2] } }
  ]);

  const coverOutcome = await resolveCombatAction(coverContext, { structured: true }, coverRoller);
  coverRoller.assertComplete();
  const coverHits = coverOutcome.targets[0].hits;
  assert.equal(coverHits.length, 2, "three-round burst cover fixture produces two hits");
  assert.equal(coverHits[0].cover.effectiveStoppingPower, 8, "first cover hit uses original Cover SP");
  assert.deepEqual(coverHits[0].cover.ablation, { before: 0, after: 1, applied: true }, "first cover hit records transient cover ablation");
  assert.equal(coverHits[1].cover.effectiveStoppingPower, 7, "second cover hit uses transiently ablated Cover SP");
  assert.deepEqual(coverHits[1].cover.protectedLocations, ["Torso"], "cover hit evidence preserves protected locations");
  assert.equal(coverHits[1].cover.mitigation, 7, "cover hit evidence exposes cover mitigation separately");

  const coverChat = buildCombatChatData(coverOutcome);
  assert.equal(coverChat.targets[0].hits[0].cover.ablation.after, 1, "chat data exposes cover ablation evidence");
  assert.deepEqual(coverChat.targets[0].hits[0].cover.protectedLocations, ["Torso"], "chat data exposes protected cover locations");
}

async function assertCombatResolverRouting() {
  const roller = (request) => {
    if (request.id === "attack") {
      return { id: "attack", total: 20, die: { natural: 8 } };
    }
    if (request.id === "location") {
      return { id: "location", total: 4, die: { natural: 4 }, location: "torso" };
    }
    if (request.id === "damage") {
      return { id: "damage", total: 10, die: { natural: 10 } };
    }
    return { total: 10 };
  };
  const context = {
    action: {
      type: "ranged",
      fireMode: "FullAuto",
      range: "close",
      targetNumber: 15
    },
    attacker: {
      snapshot: {
        stats: { ref: { total: 8 } }
      }
    },
    weapon: {
      snapshot: {
        attackSkill: "rifle",
        shotsLeft: 10,
        rof: 10,
        attackType: "Auto"
      }
    },
    targets: [
      {
        snapshot: {
          stats: { bt: { total: 6 } },
          hitLocations: { torso: { label: "Torso" } }
        }
      }
    ],
    legacy: {
      fallback: () => "fallback-called"
    }
  };

  const result = await resolveCombatAction(context, { structured: true }, roller);
  assert.notEqual(result, "fallback-called", "FullAuto should be routed to structured resolver");

  // Multi-target full-auto with sufficient ammo/ROF (ROF 10, targets 2 => roundsFiredPerTarget = Math.floor(10 / 2) = 5)
  const multiTargetContext = {
    ...context,
    weapon: {
      snapshot: {
        attackSkill: "rifle",
        shotsLeft: 10,
        rof: 10,
        attackType: "Auto"
      }
    },
    targets: [
      {
        snapshot: {
          stats: { bt: { total: 6 } },
          hitLocations: { torso: { label: "Torso" } }
        }
      },
      {
        snapshot: {
          stats: { bt: { total: 6 } },
          hitLocations: { torso: { label: "Torso" } }
        }
      }
    ]
  };
  const multiResult = await resolveCombatAction(multiTargetContext, { structured: true }, roller);
  assert.notEqual(multiResult, "fallback-called", "Multi-target FullAuto with sufficient ROF/ammo should be routed to structured resolver");

  // Multi-target full-auto with insufficient ammo (shotsLeft 1, targets 2 => roundsFiredPerTarget = Math.floor(1 / 2) = 0)
  const insufficientAmmoContext = {
    ...multiTargetContext,
    weapon: {
      snapshot: {
        attackSkill: "rifle",
        shotsLeft: 1,
        rof: 10,
        attackType: "Auto"
      }
    }
  };
  const insufficientResult = await resolveCombatAction(insufficientAmmoContext, { structured: true }, roller);
  assert.notEqual(insufficientResult, "fallback-called", "Multi-target FullAuto with roundsFiredPerTarget < 1 should stay structured");
  assert.equal(insufficientResult.manualResolution.required, true, "insufficient multi-target full-auto should be manual");
  assert.equal(insufficientResult.chat.status, "manual", "insufficient multi-target full-auto should produce a manual chat outcome");
  assert.equal(insufficientResult.ammo.delta, 0, "insufficient multi-target full-auto should not spend ammo");

  const semiAutoMultiTargetContext = {
    ...multiTargetContext,
    action: {
      type: "ranged",
      fireMode: "SemiAuto",
      range: "close",
      targetNumber: 15
    }
  };
  const semiAutoMultiResult = await resolveCombatAction(semiAutoMultiTargetContext, { structured: true }, roller);
  assert.notEqual(semiAutoMultiResult, "fallback-called", "SemiAuto multi-target should stay structured");
  assert.equal(semiAutoMultiResult.manualResolution.required, true, "SemiAuto multi-target should be manual");
  assert.match(semiAutoMultiResult.manualResolution.message, /exactly one target/i, "SemiAuto multi-target should explain target count");

  const noTargetContext = {
    ...context,
    action: {
      type: "ranged",
      fireMode: "SemiAuto",
      range: "close",
      targetNumber: 15
    },
    targets: []
  };
  const noTargetResult = await resolveCombatAction(noTargetContext, { structured: true }, roller);
  assert.equal(noTargetResult.manualResolution.required, true, "missing ranged target should be manual");
  assert.match(noTargetResult.manualResolution.message, /select a target/i, "missing target should explain required target selection");

  const manualAttackDieContext = {
    ...context,
    action: {
      type: "ranged",
      fireMode: "SemiAuto",
      range: "close",
      targetNumber: 15
    },
    weapon: {
      snapshot: {
        attackSkill: "rifle",
        shotsLeft: 10,
        rof: 10,
        attackType: "Auto"
      }
    },
    targets: [
      {
        snapshot: {
          stats: { bt: { total: 6 } },
          hitLocations: { torso: { label: "Torso" } }
        }
      }
    ]
  };
  const manualAttackDieResult = await resolveCombatAction(manualAttackDieContext, { structured: true, manualAttackDie: "10,7" }, roller);
  assert.equal(manualAttackDieResult.targets[0].attack.roll.total, 25, "manual ranged attack die applies before stat and skill math");
  assert.deepEqual(manualAttackDieResult.targets[0].attack.roll.die.results, [10, 7], "manual ranged attack die records the physical dice");

  const manualMeleeResult = await resolveCombatAction({
    action: { type: "melee" },
    attacker: {
      snapshot: {
        stats: { ref: { total: 9 }, bt: { total: 6 } },
        skills: { melee: { level: 5 } }
      }
    },
    weapon: {
      snapshot: {
        attackSkill: "melee",
        damage: "1d6",
        attackType: "Melee"
      }
    },
    targets: [
      {
        snapshot: {
          stats: { ref: { total: 6 }, bt: { total: 8 } },
          skills: { brawling: { level: 3 }, melee: { level: 4 } },
          hitLocations: { torso: { label: "Torso" } }
        }
      }
    ],
    legacy: { fallback: () => "fallback-called" }
  }, { structured: true, manualAttackDie: "9" }, createScriptedRoller([
    { id: "defend", total: 30, die: { faces: 10, natural: 10, results: [10], exploded: false } }
  ]));
  assert.equal(manualMeleeResult.targets[0].attack.roll.total, 23, "manual melee attack die applies before stat and skill math");
  assert.deepEqual(manualMeleeResult.targets[0].attack.roll.die.results, [9], "manual melee attack die records the physical die");

  const manualMartialResult = await resolveCombatAction({
    action: {
      type: "martial",
      meleeAction: "Strike",
      options: { martialArt: "karate" }
    },
    attacker: {
      snapshot: {
        stats: { ref: { total: 9 }, bt: { total: 6 } },
        skills: { karate: { level: 5 } }
      }
    },
    weapon: {
      snapshot: {
        attackSkill: null,
        damage: "1d3",
        attackType: "Martial"
      }
    },
    targets: [
      {
        snapshot: {
          stats: { ref: { total: 6 }, bt: { total: 8 } },
          skills: { brawling: { level: 3 } },
          hitLocations: { torso: { label: "Torso" } }
        }
      }
    ],
    legacy: { fallback: () => "fallback-called" }
  }, { structured: true, manualAttackDie: "10,10" }, createScriptedRoller([
    { id: "defend", total: 40, die: { faces: 10, natural: 10, results: [10], exploded: false } }
  ]));
  assert.equal(manualMartialResult.targets[0].attack.roll.total, 36, "manual martial attack die applies before stat, skill, and key technique math");
  assert.deepEqual(manualMartialResult.targets[0].attack.roll.die.results, [10, 10], "manual martial attack die records one explosion pair");

  await assert.rejects(
    () => resolveCombatAction(manualAttackDieContext, { structured: true, manualAttackDie: "10" }, roller),
    /explosion/i,
    "manual attack die 10 requires one explosion follow-up"
  );
  await assert.rejects(
    () => resolveCombatAction(manualAttackDieContext, { structured: true, manualAttackDie: "10,10,4" }, roller),
    /explosion/i,
    "manual attack die rejects chained explosions"
  );

  const zeroRofContext = {
    ...context,
    weapon: {
      snapshot: {
        attackSkill: "rifle",
        shotsLeft: 10,
        rof: 0,
        attackType: "Auto"
      }
    }
  };
  const zeroRofResult = await resolveCombatAction(zeroRofContext, { structured: true }, roller);
  assert.equal(zeroRofResult.manualResolution.required, true, "FullAuto with zero ROF should be manual");
  assert.match(zeroRofResult.manualResolution.message, /positive weapon ROF/i, "zero ROF should explain invalid ROF");

  const zeroAmmoFullAutoContext = {
    ...context,
    weapon: {
      snapshot: {
        attackSkill: "rifle",
        shotsLeft: 0,
        rof: 10,
        attackType: "Auto"
      }
    }
  };
  const zeroAmmoFullAutoResult = await resolveCombatAction(zeroAmmoFullAutoContext, { structured: true }, roller);
  assert.notEqual(zeroAmmoFullAutoResult, "fallback-called", "FullAuto with zero ammo should stay structured");
  assert.equal(zeroAmmoFullAutoResult.manualResolution.required, true, "FullAuto with zero ammo should be manual");
  assert.equal(zeroAmmoFullAutoResult.warnings[0].code, "insufficient-ammo", "FullAuto with zero ammo should warn about ammo");

  const zeroAmmoBurstContext = {
    ...context,
    action: {
      type: "ranged",
      fireMode: "ThreeRoundBurst",
      range: "close",
      targetNumber: 15
    },
    weapon: {
      snapshot: {
        attackSkill: "rifle",
        shotsLeft: 0,
        rof: 10,
        attackType: "Auto"
      }
    }
  };
  const zeroAmmoBurstResult = await resolveCombatAction(zeroAmmoBurstContext, { structured: true }, roller);
  assert.notEqual(zeroAmmoBurstResult, "fallback-called", "ThreeRoundBurst with zero ammo should stay structured");
  assert.equal(zeroAmmoBurstResult.manualResolution.required, true, "ThreeRoundBurst with zero ammo should be manual");
  assert.equal(zeroAmmoBurstResult.warnings[0].code, "insufficient-ammo", "ThreeRoundBurst with zero ammo should warn about ammo");
}

function assertSettingsHelpers() {
  const originalGame = global.game;

  try {
    // 1. Default (no game object): should return true
    delete global.game;
    assert.equal(isCorebookFidelityEnabled(), true);
    assert.deepEqual(filterSupportedFireModes(["FullAuto", "Suppressive"]), ["FullAuto"]);
    assert.equal(getAttackDieEntryMode(), "auto");
    assert.equal(getAttackDieEntryMode({ options: { attackDieEntryMode: "prompt" } }), "prompt");

    // 2. Corebook Fidelity ON
    global.game = { system: { id: "cyberpunk2020" }, settings: { get: () => true } };
    assert.equal(isCorebookFidelityEnabled(), true);
    assert.deepEqual(filterSupportedFireModes(["FullAuto", "Suppressive"]), ["FullAuto"]);

    // 3. Corebook Fidelity OFF (relaxed mode)
    global.game = { system: { id: "cyberpunk2020" }, settings: { get: () => false } };
    assert.equal(isCorebookFidelityEnabled(), false);
    assert.deepEqual(filterSupportedFireModes(["FullAuto", "Suppressive"]), ["FullAuto", "Suppressive"]);
  } finally {
    // Restore
    global.game = originalGame;
  }
}
