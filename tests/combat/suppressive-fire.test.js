import assert from "assert";
import { calculateSuppressiveFireSaveDC, buildSuppressiveFireTemplateData, handleSuppressiveFireCombatTurn, resolveSuppressiveFireDamageFromChat } from "../../module/combat/suppressive-fire-tracker.js";
import { resolveSuppressiveFireDamageOutcome } from "../../module/combat/attack-resolver.js";
import { planCombatUpdates } from "../../module/combat/state-planner.js";

export async function runSuppressiveFireTests() {
  const results = [];
  
  function addResult(name, pass) {
    results.push({ name, passed: pass });
  }

  function testSaveDC() {
    let passed = true;
    try {
      assert.strictEqual(calculateSuppressiveFireSaveDC(30, 2), 15);
      assert.strictEqual(calculateSuppressiveFireSaveDC(30, 3), 10);
      assert.strictEqual(calculateSuppressiveFireSaveDC(25, 2), 12);
      assert.strictEqual(calculateSuppressiveFireSaveDC(0, 2), 0);
    } catch (e) {
      console.error(e);
      passed = false;
    }
    addResult("suppressive-fire: Save DC calculation", passed);
  }

  function testTemplateDataBuilder() {
    let passed = true;
    try {
      const data = buildSuppressiveFireTemplateData({
        attackerTokenId: "t1",
        attackerActorId: "a1",
        weaponItemId: "w1",
        damageFormula: "2d6",
        bulletsFired: 20,
        zoneWidth: 2,
        maxDistance: 10,
        origin: {x: 100, y: 100},
        combatRound: 1,
        combatTurn: 2,
        combatId: "c1"
      });

      assert.strictEqual(data.t, "ray");
      assert.strictEqual(data.distance, 10);
      assert.strictEqual(data.width, 2);
      
      const flags = data.flags?.cyberpunk2020?.suppressiveFire;
      assert.ok(flags, "Flags must be defined");
      assert.strictEqual(flags.shooterActorId, "a1");
      assert.strictEqual(flags.shooterTokenId, "t1");
      assert.strictEqual(flags.weaponItemId, "w1");
      assert.strictEqual(flags.damageFormula, "2d6");
      assert.strictEqual(flags.bulletsFired, 20);
      assert.strictEqual(flags.remainingHitCap, 20);
      assert.strictEqual(flags.saveDC, 10); // 20 / 2
      assert.strictEqual(flags.zoneWidth, 2);
      assert.strictEqual(flags.createdCombatId, "c1");
      assert.strictEqual(flags.createdRound, 1);
      assert.strictEqual(flags.createdTurn, 2);
      assert.deepStrictEqual(flags.resolvedTokenIds, []);
    } catch(e) {
      console.error(e);
      passed = false;
    }
    addResult("suppressive-fire: Template data builder", passed);
  }

  async function testIntersectionLogic() {
    let passed = true;
    try {
        const { checkAndResolveIntersection } = await import("../../module/combat/suppressive-fire-tracker.js");
        globalThis.game = { combat: { id: "c1", round: 1, turn: 1 } };
        
        let updateCalled = false;
        const template = {
            document: {
                x: 0,
                y: 0,
                flags: {
                    cyberpunk2020: {
                        suppressiveFire: {
                            remainingHitCap: 10,
                            saveDC: 15,
                            resolvedTokenIds: []
                        }
                    }
                },
                update: async (data) => { updateCalled = true; }
            },
            shape: {
                contains: (x, y) => { return x === 50 && y === 50; } // mocks intersection
            }
        };

        const tokenDocumentIntersecting = {
            id: "tok1",
            x: 0, y: 0, width: 1, height: 1,
            object: { center: { x: 50, y: 50 } },
            actor: { name: "Test Actor" }
        };

        const resultIntersect = await checkAndResolveIntersection(tokenDocumentIntersecting, template);
        assert.ok(resultIntersect, "Should return true for intersecting token");
        assert.ok(updateCalled, "Template should be updated with new resolved token ID");

        // Now test non-intersecting
        const tokenDocumentNotIntersecting = {
            id: "tok2",
            x: 0, y: 0, width: 1, height: 1,
            object: { center: { x: 999, y: 999 } },
            actor: { name: "Test Actor" }
        };
        const resultNotIntersect = await checkAndResolveIntersection(tokenDocumentNotIntersecting, template);
        assert.strictEqual(resultNotIntersect, false, "Should return false for non-intersecting token");

    } catch (e) {
        console.error(e);
        passed = false;
    }
    addResult("suppressive-fire: Intersection logic and deduplication", passed);
  }

  async function testTemplateSurvivesAdvanceAwayFromShooter() {
    let passed = true;
    try {
      let deleted = false;
      const template = {
        document: {
          flags: {
            cyberpunk2020: {
              suppressiveFire: {
                shooterTokenId: "shooter-token",
                remainingHitCap: 10,
                resolvedTokenIds: []
              }
            }
          },
          delete: async () => { deleted = true; }
        }
      };

      globalThis.canvas = {
        templates: { placeables: [template] },
        tokens: {
          get: () => undefined
        }
      };

      const combat = {
        combatant: { tokenId: "shooter-token" },
        turns: [
          { tokenId: "shooter-token" },
          { tokenId: "next-token" }
        ]
      };

      await handleSuppressiveFireCombatTurn(combat, { turn: 1 });

      assert.strictEqual(deleted, false, "template should survive when turn advances from shooter to next combatant");
    } catch (e) {
      console.error(e);
      passed = false;
    }
    addResult("suppressive-fire: template survives turn advance away from shooter", passed);
  }

  async function testTemplateExpiresWhenShooterTurnStartsAgain() {
    let passed = true;
    try {
      let deleted = false;
      const template = {
        document: {
          flags: {
            cyberpunk2020: {
              suppressiveFire: {
                shooterTokenId: "shooter-token",
                remainingHitCap: 10,
                resolvedTokenIds: []
              }
            }
          },
          delete: async () => { deleted = true; }
        }
      };

      globalThis.canvas = {
        templates: { placeables: [template] },
        tokens: {
          get: () => undefined
        }
      };

      const combat = {
        combatant: { tokenId: "previous-token" },
        turns: [
          { tokenId: "shooter-token" },
          { tokenId: "previous-token" }
        ]
      };

      await handleSuppressiveFireCombatTurn(combat, { turn: 0 });

      assert.strictEqual(deleted, true, "template should expire when turn advances back to shooter");
    } catch (e) {
      console.error(e);
      passed = false;
    }
    addResult("suppressive-fire: template expires when shooter turn starts again", passed);
  }

  async function testFailedSaveDamageUsesPerBulletPipeline() {
    let passed = true;
    try {
      const rolls = [
        { id: "location", formula: "1d10 hit location", total: 4, die: { faces: 10, natural: 4 }, location: "torso" },
        { id: "damage", formula: "4d6", total: 15, die: { faces: 6, natural: 15 } },
        { id: "location", formula: "1d10 hit location", total: 4, die: { faces: 10, natural: 4 }, location: "torso" },
        { id: "damage", formula: "4d6", total: 15, die: { faces: 6, natural: 15 } }
      ];
      let rollIndex = 0;
      const roller = async (request = {}) => {
        const roll = rolls[rollIndex++];
        assert.strictEqual(request.id, roll.id);
        return roll;
      };
      const outcome = await resolveSuppressiveFireDamageOutcome({
        action: {
          type: "ranged",
          fireMode: "Suppressive",
          source: "suppressive-fire-test"
        },
        attacker: {
          actorUuid: "Actor.attacker",
          name: "Solo"
        },
        weapon: {
          itemUuid: "Actor.attacker.Item.rifle",
          name: "Assault Rifle",
          snapshot: {
            damage: "4d6",
            ap: false,
            attackType: "Auto"
          }
        },
        target: {
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
            equippedArmor: [
              {
                id: "armor-vest",
                name: "Kevlar Vest",
                equipped: true,
                system: {
                  coverage: {
                    torso: {
                      sp: 12,
                      ablation: 0,
                      layer: "soft"
                    }
                  }
                }
              }
            ]
          }
        },
        hitCount: 2
      }, {}, roller);

      const plan = planCombatUpdates(outcome);

      assert.strictEqual(rollIndex, rolls.length, "each suppressive hit should roll location and damage separately");
      assert.strictEqual(outcome.targets[0].hits.length, 2, "failed save should produce one hit record per bullet");
      assert.deepStrictEqual(plan.actorUpdates, [
        {
          actorUuid: "Actor.target",
          update: {
            "system.damage": 3
          }
        }
      ]);
      assert.deepStrictEqual(plan.embeddedItemUpdates, [
        {
          actorUuid: "Actor.target",
          type: "Item",
          updates: [
            {
              _id: "armor-vest",
              "system.coverage.torso.ablation": 2
            }
          ]
        }
      ]);
    } catch (e) {
      console.error(e);
      passed = false;
    }
    addResult("suppressive-fire: failed save damage uses per-bullet pipeline", passed);
  }

  async function testChatDamageResolutionCommitsActorDamage() {
    let passed = true;
    try {
      const targetState = { system: { damage: 0 } };
      const targetActor = {
        id: "target-actor",
        uuid: "Actor.target",
        name: "Target",
        system: {
          stats: { bt: { total: 6 } },
          damage: 0,
          hitLocations: { torso: { label: "Torso" } }
        },
        itemTypes: {}
      };
      const weaponItem = {
        id: "weapon-1",
        uuid: "Actor.shooter.Item.weapon-1",
        name: "Assault Rifle",
        system: {
          damage: "4d6",
          ap: false,
          attackType: "Auto"
        }
      };
      const shooterActor = {
        id: "shooter-actor",
        uuid: "Actor.shooter",
        name: "Shooter",
        system: {
          stats: {},
          skills: {},
          damage: 0,
          hitLocations: {}
        },
        itemTypes: { weapon: [weaponItem] },
        items: {
          get: (id) => id === "weapon-1" ? weaponItem : undefined
        }
      };
      const actors = new Map([
        ["target-actor", targetActor],
        ["shooter-actor", shooterActor]
      ]);
      globalThis.game = {
        system: { id: "cyberpunk2020-rilerena" },
        user: { id: "gm", isGM: true },
        settings: { get: () => "direct" },
        actors: {
          get: (id) => actors.get(id)
        }
      };
      globalThis.ui = { notifications: { warn: () => {} } };
      globalThis.canvas = {
        scene: {
          templates: {
            get: (id) => id === "template-1" ? {
              id: "template-1",
              uuid: "Scene.test.MeasuredTemplate.template-1",
              t: "ray",
              x: 100,
              y: 100,
              direction: 0,
              distance: 10,
              flags: {
                cyberpunk2020: {
                  suppressiveFire: {
                    shooterActorId: "shooter-actor",
                    weaponItemId: "weapon-1",
                    zoneWidth: 2
                  }
                }
              }
            } : undefined
          }
        }
      };

      const rolls = [
        { id: "location", formula: "1d10 hit location", total: 4, die: { faces: 10, natural: 4 }, location: "torso" },
        { id: "damage", formula: "4d6", total: 8, die: { faces: 6, natural: 8 } }
      ];
      let rollIndex = 0;
      const adapter = {
        async resolveItem() {
          return { update: async () => {} };
        },
        async resolveActor(actorUuid) {
          if (actorUuid !== "Actor.target") return undefined;
          return {
            system: targetState.system,
            async update(update) {
              Object.assign(targetState.system, { damage: update["system.damage"] });
            },
            async updateEmbeddedDocuments() {}
          };
        },
        async renderTemplate(templatePath, data) {
          return `<${data.status}>`;
        },
        async createChatMessage() {
          return "message-1";
        },
        async updateChatMessage() {}
      };

      const result = await resolveSuppressiveFireDamageFromChat({
        templateId: "template-1",
        actorId: "target-actor",
        hits: 1
      }, {
        decision: "confirm",
        adapter,
        roller: async (request = {}) => {
          const roll = rolls[rollIndex++];
          assert.strictEqual(request.id, roll.id);
          return roll;
        }
      });

      assert.strictEqual(result.status, "committed");
      assert.strictEqual(targetState.system.damage, 6);
      assert.strictEqual(rollIndex, rolls.length);
    } catch (e) {
      console.error(e);
      passed = false;
    }
    addResult("suppressive-fire: chat damage resolution commits actor damage", passed);
  }

  testSaveDC();
  testTemplateDataBuilder();
  await testIntersectionLogic();
  await testTemplateSurvivesAdvanceAwayFromShooter();
  await testTemplateExpiresWhenShooterTurnStartsAgain();
  await testFailedSaveDamageUsesPerBulletPipeline();
  await testChatDamageResolutionCommitsActorDamage();
  
  return results;
}
