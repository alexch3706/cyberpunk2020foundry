import assert from "node:assert/strict";

import { drawAoETemplateAndGetTargets } from "../../module/combat/template-placement.js";

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

  await testShotgunConeTemplateIsTransient();

  return results;
}
