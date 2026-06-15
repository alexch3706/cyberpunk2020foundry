export async function promptUseShotgunTemplate() {
  return new Promise((resolve) => {
    new Dialog({
      title: "Shotgun Attack",
      content: "<p>Do you want to draw a cone template for this shotgun attack or roll normally against selected targets?</p>",
      buttons: {
        template: {
          label: "Draw Cone Template",
          callback: () => resolve(true)
        },
        normal: {
          label: "Skip / Normal Roll",
          callback: () => resolve(false)
        }
      },
      default: "template",
      close: () => resolve(false)
    }).render(true);
  });
}

export async function drawShotgunTemplateAndGetTargets(attackerToken) {
  return new Promise((resolve) => {
    if (!globalThis.canvas?.ready) {
      ui.notifications?.warn("Canvas is not ready. Cannot place template.");
      return resolve([]);
    }

    const origin = attackerToken?.center || attackerToken?.bounds?.center;
    if (!origin) {
      ui.notifications?.warn("Attacker token origin not found.");
      return resolve([]);
    }

    const gridDistance = canvas.scene.grid.distance;

    const templateData = {
      t: "cone",
      user: game.user.id,
      distance: 10,
      direction: 0,
      x: origin.x,
      y: origin.y,
      angle: 45,
      fillColor: game.user.color || "#ff0000"
    };

    const doc = new CONFIG.MeasuredTemplate.documentClass(templateData, { parent: canvas.scene });
    let template = new CONFIG.MeasuredTemplate.objectClass(doc);
    
    let isResolved = false;

    const cleanup = () => {
      Hooks.off("createMeasuredTemplate", onTemplateCreated);
      canvas.app.view.removeEventListener("contextmenu", onCancel, { capture: true });
    };

    const onCancel = () => {
      if (isResolved) return;
      isResolved = true;
      cleanup();
      resolve([]);
    };

    const onTemplateCreated = (createdDoc, options, userId) => {
      if (userId !== game.user.id || isResolved) return;
      isResolved = true;
      cleanup();

      const templateObj = createdDoc.object;
      if (!templateObj) {
        return resolve([]);
      }

      const tokens = canvas.tokens.placeables.filter(t => {
        const tCenter = t.center || { x: t.x + (t.w/2), y: t.y + (t.h/2) };
        return templateObj.shape.contains(tCenter.x - templateObj.document.x, tCenter.y - templateObj.document.y);
      });
      
      const augmentedTokens = tokens.map(t => {
        const tCenter = t.center || { x: t.x + (t.w/2), y: t.y + (t.h/2) };
        const ray = new Ray(origin, tCenter);
        const distancePx = ray.distance;
        const distanceMeters = (distancePx / canvas.grid.size) * gridDistance;

        t.tactical = t.tactical || {};
        t.tactical.template = {
          templateUuid: createdDoc.uuid,
          templateId: createdDoc.id,
          type: "cone",
          origin: { x: createdDoc.x, y: createdDoc.y },
          direction: createdDoc.direction,
          angle: createdDoc.angle,
          width: createdDoc.distance,
          distance: createdDoc.distance,
          targetDistance: distanceMeters,
          inclusion: "intersected"
        };
        return t;
      });

      resolve(augmentedTokens);
    };

    Hooks.on("createMeasuredTemplate", onTemplateCreated);
    canvas.app.view.addEventListener("contextmenu", onCancel, { capture: true, once: true });
    
    template.drawPreview();
  });
}
