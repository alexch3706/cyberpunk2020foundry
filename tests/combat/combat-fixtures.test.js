import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { resolveCombatAction } from "../../module/combat/combat-resolver.js";
import { resolveBodyTypeDamage } from "../../module/combat/attack-resolver.js";
import { buildCombatChatData } from "../../module/combat/combat-chat.js";
import { planCombatUpdates } from "../../module/combat/state-planner.js";
import { normalizeSelectedTargets } from "../../module/combat/target-normalizer.js";
import { getEquippedArmorForLocation, resolveArmor } from "../../module/combat/armor-resolver.js";

const FIXTURE_URLS = [
  new URL("./fixtures/ranged-single-shot.json", import.meta.url)
];

export async function runCombatFixtures() {
  const results = [];

  assertTargetNormalization();
  assertBodyTypeDamageResolver();
  assertArmorResolver();

  for(const fixtureUrl of FIXTURE_URLS) {
    const fixture = JSON.parse(await readFile(fixtureUrl, "utf8"));
    results.push(runFixture(fixture));
  }

  return results;
}

function runFixture(fixture) {
  const roller = createScriptedRoller(fixture.rolls);
  const context = clonePlainData(fixture.context);
  context.legacy = {
    mode: "fixture",
    fallback: ({ context: resolverContext, roller }) => buildSingleShotOutcome(resolverContext, roller, fixture)
  };

  const outcome = resolveCombatAction(context, {}, roller);
  roller.assertComplete();

  assertOutcomeShape(outcome, fixture.expected.outcome);

  const plannedUpdates = planCombatUpdates(outcome);
  assert.deepEqual(plannedUpdates, fixture.expected.plannedUpdates, `${fixture.name} planned updates`);

  const previewChatData = buildCombatChatData(outcome, plannedUpdates);
  assert.deepEqual(previewChatData, fixture.expected.chatData.preview, `${fixture.name} preview chat data`);

  assertSingleShotCases(fixture);

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
  const hitEvidence = fixture.outcomeEvidence.hit;
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

function assertSingleShotCases(fixture) {
  for(const singleShotCase of fixture.singleShotCases || []) {
    const roller = createScriptedRoller(singleShotCase.rolls);
    const context = reviveFixtureSentinels(mergePlainData(fixture.context, singleShotCase.context || {}));
    if(singleShotCase.legacyExpected) {
      context.legacy = {
        mode: "fixture",
        fallback: () => clonePlainData(singleShotCase.legacyExpected)
      };
    }
    const outcome = resolveCombatAction(context, { structured: true }, roller);
    roller.assertComplete();
    assertObjectIncludes(outcome, singleShotCase.expected, `${fixture.name} ${singleShotCase.name} outcome`);
    if(singleShotCase.expectedPlan) {
      assertObjectIncludes(planCombatUpdates(outcome), singleShotCase.expectedPlan, `${fixture.name} ${singleShotCase.name} planned updates`);
    }
    if(singleShotCase.expectedChat) {
      const plan = planCombatUpdates(outcome);
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

  const skinweaveLayer = torsoLayers.find(l => l.id === "cyberware-skinweave");
  assert.ok(skinweaveLayer, "skinweave layer exists");
  assert.equal(skinweaveLayer.stoppingPower, 12, "skinweave SP is parsed from existing pack-style text");
  assert.equal(skinweaveLayer.layer, "soft", "pack-style skinweave defaults to soft layer");
  assert.equal(skinweaveLayer.source, "Cyberpunk 2020 2nd ed. pg.85", "skinweave source is preserved");
  assert.ok(!torsoLayers.some(l => l.id === "cyberware-skull"), "skull-only subdermal armor does not cover torso");

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
  assert.equal(coveredArmor.effectiveStoppingPower, 20, "cover is combined as the outer protection layer");
  assert.equal(coveredArmor.layers.at(-1).type, "cover", "manual cover is appended as a cover layer");
  assert.equal(coveredArmor.layers.at(-1).source, "manual cover", "manual cover source is preserved");

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
  assert.equal(warningArmor.warnings.length, 2, "four layers with multiple hard layers produce warning evidence");
  assert.deepEqual(warningArmor.warnings.map(warning => warning.code), ["armor-too-many-layers", "armor-multiple-hard-layers"]);

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
