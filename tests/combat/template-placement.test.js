import assert from "node:assert/strict";

import { drawAoETemplateAndGetTargets, drawAutoshotgunPatternsAndGetTargets } from "../../module/combat/template-placement.js";

export async function runTemplatePlacementTests() {
  const results = [];

  async function testShotgunConeTemplateIsTransient() {
    let passed = true;
    try {
      let createdTemplateDeleted = false;
      const handlers = {};
      const createdDoc = {
        id: "shotgun-template",
        uuid: "Scene.test.MeasuredTemplate.shotgun-template",
        x: 100,
        y: 100,
        direction: 45,
        angle: 45,
        distance: 10,
        delete: async () => { createdTemplateDeleted = true; }
      };
      createdDoc.object = {
        document: createdDoc,
        shape: {
          contains: () => false
        }
      };

      globalThis.game = {
        user: { id: "user-1", color: "#ff0000" }
      };
      globalThis.ui = { notifications: { warn: () => {} } };
      globalThis.Ray = class {
        constructor(origin, destination) {
          this.angle = Math.atan2(destination.y - origin.y, destination.x - origin.x);
          this.distance = Math.hypot(destination.x - origin.x, destination.y - origin.y);
        }
      };
      Math.normalizeDegrees = Math.normalizeDegrees || ((degrees) => ((degrees % 360) + 360) % 360);
      Math.toDegrees = Math.toDegrees || ((radians) => radians * 180 / Math.PI);

      globalThis.CONFIG = {
        MeasuredTemplate: {
          documentClass: class {
            constructor(data) {
              this.data = data;
              this.x = data.x;
              this.y = data.y;
              this.direction = data.direction;
              this.angle = data.angle;
              this.distance = data.distance;
            }
            updateSource(update) {
              Object.assign(this, update);
            }
            toObject() {
              return { ...this.data, direction: this.direction };
            }
          },
          objectClass: class {
            constructor(doc) {
              this.document = doc;
              this.layer = { preview: { addChild: () => {} } };
            }
            async draw() {}
            refresh() {}
            destroy() {}
          }
        }
      };
      globalThis.canvas = {
        ready: true,
        scene: {
          grid: { distance: 1 },
          createEmbeddedDocuments: async () => [createdDoc]
        },
        grid: { size: 100 },
        templates: { preview: { addChild: () => {} } },
        tokens: {
          placeables: []
        },
        stage: {
          on: (event, handler) => { handlers[event] = handler; },
          off: (event) => { delete handlers[event]; }
        },
        app: {
          view: {
            addEventListener: () => {},
            removeEventListener: () => {}
          }
        }
      };

      const promise = drawAoETemplateAndGetTargets(
        { system: { aoe: { type: "cone", value: 10 } } },
        { id: "attacker-token", center: { x: 100, y: 100 } }
      );
      await new Promise(resolve => setTimeout(resolve, 0));
      handlers.pointerdown({
        stopPropagation: () => {}
      });

      const result = await promise;
      assert.equal(result.hazardZone.lifecycle, "transient");
      assert.equal(createdTemplateDeleted, true, "shotgun cone MeasuredTemplate should be deleted after evidence is collected");
    } catch (e) {
      console.error(e);
      passed = false;
    }
    results.push({ name: "template-placement: shotgun cone template is transient", passed });
  }

  async function testAutoshotgunPatternsAreCollectedSequentially() {
    let passed = true;
    try {
      const calls = [];
      const placements = [
        {
          affectedTargets: [
            {
              id: "target-shell-1",
              tactical: {
                template: {
                  templateUuid: "Scene.test.MeasuredTemplate.autoshotgun-shell-1",
                  templateId: "autoshotgun-shell-1",
                  type: "cone",
                  origin: { x: 0, y: 0 },
                  direction: 0,
                  angle: 45,
                  distance: 20,
                  targetDistance: 12,
                  inclusion: "intersected"
                }
              }
            }
          ],
          hazardZone: {
            templateUuid: "Scene.test.MeasuredTemplate.autoshotgun-shell-1",
            templateId: "autoshotgun-shell-1",
            type: "cone",
            origin: { x: 0, y: 0 },
            direction: 0,
            angle: 45,
            distance: 20,
            inclusion: "intersected"
          }
        },
        {
          affectedTargets: [
            {
              id: "target-shell-2",
              tactical: {
                template: {
                  templateUuid: "Scene.test.MeasuredTemplate.autoshotgun-shell-2",
                  templateId: "autoshotgun-shell-2",
                  type: "cone",
                  origin: { x: 0.5, y: 0 },
                  direction: 0,
                  angle: 45,
                  distance: 20,
                  targetDistance: 12,
                  inclusion: "intersected"
                }
              }
            }
          ],
          hazardZone: {
            templateUuid: "Scene.test.MeasuredTemplate.autoshotgun-shell-2",
            templateId: "autoshotgun-shell-2",
            type: "cone",
            origin: { x: 0.5, y: 0 },
            direction: 0,
            angle: 45,
            distance: 20,
            inclusion: "intersected"
          }
        }
      ];

      const result = await drawAutoshotgunPatternsAndGetTargets(
        { name: "CAWS", system: { aoe: { type: "cone", value: 20 } } },
        { id: "attacker-token" },
        2,
        {
          drawPattern: async (item, attackerToken, shellIndex) => {
            calls.push({ item, attackerToken, shellIndex });
            return placements[shellIndex - 1];
          }
        }
      );

      assert.equal(calls.length, 2, "autoshotgun placement calls drawPattern once per shell");
      assert.deepEqual(calls.map(call => call.shellIndex), [1, 2], "autoshotgun placement passes shell indexes in order");
      assert.equal(result.patterns.length, 2, "autoshotgun placement returns one pattern per shell");
      assert.equal(result.patterns[0].shellIndex, 1);
      assert.equal(result.patterns[0].template.templateId, "autoshotgun-shell-1");
      assert.equal(result.patterns[0].affectedTargets[0].id, "target-shell-1");
      assert.equal(result.patterns[1].shellIndex, 2);
      assert.equal(result.patterns[1].template.templateId, "autoshotgun-shell-2");
      assert.equal(result.patterns[1].affectedTargets[0].id, "target-shell-2");
    } catch (e) {
      console.error(e);
      passed = false;
    }
    results.push({ name: "template-placement: autoshotgun patterns are collected sequentially", passed });
  }

  async function testAutoshotgunCanceledPlacementReturnsWarningPattern() {
    let passed = true;
    try {
      const result = await drawAutoshotgunPatternsAndGetTargets(
        { name: "CAWS", system: { aoe: { type: "cone", value: 20 } } },
        { id: "attacker-token" },
        2,
        {
          drawPattern: async (_item, _attackerToken, shellIndex) => shellIndex === 1
            ? {
                affectedTargets: [],
                hazardZone: {
                  templateUuid: "Scene.test.MeasuredTemplate.autoshotgun-empty",
                  templateId: "autoshotgun-empty",
                  type: "cone",
                  origin: { x: 0, y: 0 },
                  direction: 0,
                  angle: 45,
                  distance: 20,
                  inclusion: "intersected"
                }
              }
            : []
        }
      );

      assert.equal(result.patterns.length, 2, "autoshotgun placement preserves declared shell count");
      assert.equal(result.patterns[0].shellIndex, 1);
      assert.equal(result.patterns[0].template.templateId, "autoshotgun-empty", "empty zone keeps hazard-zone evidence");
      assert.equal(result.patterns[0].warnings, undefined, "empty but placed zone does not warn");
      assert.equal(result.patterns[1].shellIndex, 2);
      assert.equal(result.patterns[1].template, undefined, "canceled shell has no template evidence");
      assert.ok(result.patterns[1].warnings.some(warning => warning.code === "autoshotgun-pattern-canceled"), "canceled shell returns warning evidence");
    } catch (e) {
      console.error(e);
      passed = false;
    }
    results.push({ name: "template-placement: autoshotgun canceled placement returns warning pattern", passed });
  }

  await testShotgunConeTemplateIsTransient();
  await testAutoshotgunPatternsAreCollectedSequentially();
  await testAutoshotgunCanceledPlacementReturnsWarningPattern();

  return results;
}
