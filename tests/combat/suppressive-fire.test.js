import assert from "assert";
import { calculateSuppressiveFireSaveDC, buildSuppressiveFireTemplateData, handleSuppressiveFireCombatTurn } from "../../module/combat/suppressive-fire-tracker.js";

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

  testSaveDC();
  testTemplateDataBuilder();
  await testIntersectionLogic();
  await testTemplateSurvivesAdvanceAwayFromShooter();
  await testTemplateExpiresWhenShooterTurnStartsAgain();
  
  return results;
}
