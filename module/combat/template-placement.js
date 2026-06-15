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
  return new Promise(async (resolve) => {
    if (!globalThis.canvas?.ready) {
      ui.notifications?.warn("Canvas is not ready. Cannot place template.");
      return resolve([]);
    }

    // Handle both Token Document and Token placeable
    const origin = attackerToken?.center || attackerToken?.object?.center || attackerToken?.bounds?.center;
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
    
    // Draw preview manually to avoid missing API
    await template.draw();
    if (template.layer?.preview) {
      template.layer.preview.addChild(template);
    } else if (canvas.templates?.preview) {
      canvas.templates.preview.addChild(template);
    }

    let isResolved = false;

    const cleanup = () => {
      isResolved = true;
      if (template.parent) template.parent.removeChild(template);
      template.destroy();
      canvas.stage.off("pointermove", onMove);
      canvas.stage.off("pointerdown", onConfirm);
      canvas.app.view.removeEventListener("contextmenu", onCancel, { capture: true });
    };

    const onMove = (event) => {
      event.stopPropagation();
      const pos = event.data.getLocalPosition(canvas.tokens);
      const ray = new Ray(origin, pos);
      template.document.updateSource({ direction: Math.normalizeDegrees(Math.toDegrees(ray.angle)) });
      template.refresh();
    };

    const onCancel = (event) => {
      event.preventDefault();
      event.stopPropagation();
      cleanup();
      resolve([]);
    };

    const onConfirm = async (event) => {
      event.stopPropagation();
      cleanup();
      
      const createdDocs = await canvas.scene.createEmbeddedDocuments("MeasuredTemplate", [template.document.toObject()]);
      if (!createdDocs || createdDocs.length === 0) return resolve([]);
      
      const createdDoc = createdDocs[0];
      
      // Wait for object to be instantiated
      setTimeout(() => {
        const templateObj = createdDoc.object;
        if (!templateObj) return resolve([]);

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
      }, 100);
    };

    canvas.stage.on("pointermove", onMove);
    canvas.stage.on("pointerdown", onConfirm);
    canvas.app.view.addEventListener("contextmenu", onCancel, { capture: true, once: true });
  });
}
