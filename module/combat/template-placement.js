import { buildActorCombatSnapshot } from "./combat-snapshot.js";

export async function promptUseAoETemplate(item) {
  const aoeType = item?.system?.aoe?.type;
  const name = aoeType ? `${aoeType} Template` : "Cone Template";

  return new Promise((resolve) => {
    new Dialog({
      title: "Area of Effect Attack",
      content: `<p>Do you want to draw a ${name.toLowerCase()} for this attack or roll normally against selected targets?</p>`,
      buttons: {
        template: {
          label: `Draw ${name}`,
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

export const promptUseShotgunTemplate = promptUseAoETemplate;

export async function promptAutoshotgunShellCount(item, maxShells) {
  const boundedMax = Math.max(0, Math.floor(Number(maxShells) || 0));
  if(boundedMax <= 0) {
    ui.notifications?.warn("Autoshotgun has no available shells to fire.");
    return null;
  }

  return new Promise((resolve) => {
    new Dialog({
      title: "Autoshotgun Full Auto",
      content: `
        <form>
          <div class="form-group">
            <label>Shells Fired (Max ${boundedMax}):</label>
            <input type="number" id="autoshotgunShells" value="${boundedMax}" min="1" max="${boundedMax}" />
          </div>
        </form>
      `,
      buttons: {
        confirm: {
          label: "Place Patterns",
          callback: (html) => {
            const rawValue = parseInt(html.find("#autoshotgunShells").val(), 10);
            const shellCount = Math.max(1, Math.min(boundedMax, Number.isFinite(rawValue) ? rawValue : boundedMax));
            resolve(shellCount);
          }
        },
        cancel: {
          label: "Cancel",
          callback: () => resolve(null)
        }
      },
      default: "confirm",
      close: () => resolve(null)
    }).render(true);
  });
}

export async function drawAutoshotgunPatternsAndGetTargets(item, attackerToken, shellCount, options = {}) {
  const drawPattern = typeof options.drawPattern === "function"
    ? options.drawPattern
    : (patternItem, patternAttackerToken) => drawAoETemplateAndGetTargets(patternItem, patternAttackerToken);
  const patterns = [];
  const count = Math.max(0, Math.floor(Number(shellCount) || 0));

  for(let index = 0; index < count; index++) {
    const shellIndex = index + 1;
    const placement = await drawPattern(item, attackerToken, shellIndex);
    const affectedTargets = Array.isArray(placement)
      ? placement
      : placement?.affectedTargets || [];
    const template = extractAutoshotgunTemplateEvidence(placement, affectedTargets);

    patterns.push({
      shellIndex,
      template,
      affectedTargets: affectedTargets.map(target => buildAutoshotgunTargetEvidence(target)),
      ...(!template ? {
        warnings: [{
          code: "autoshotgun-pattern-canceled",
          severity: "warning",
          message: `Autoshotgun shell ${shellIndex} has no template evidence; resolve this shell manually.`
        }]
      } : {})
    });
  }

  return { patterns };
}

export function buildAoETemplateTargetingOptions({ selectedTargets = [], affectedTargets = [], hazardZone = undefined } = {}) {
  const selected = Array.from(selectedTargets || []).map(target => markShotgunTargetSelection(target, true));
  const affected = Array.from(affectedTargets || []).map(target => markShotgunAffectedToken(target));
  const template = buildShotgunTemplateContext(affected, selected);
  const raycastTargets = mergeShotgunRaycastTargets(selected, affected);

  return {
    targets: selected,
    template,
    hazardZone: buildAoEHazardZone(hazardZone || template, affected.length),
    raycastTargets
  };
}

export const buildShotgunTemplateTargetingOptions = buildAoETemplateTargetingOptions;

function extractAutoshotgunTemplateEvidence(placement, affectedTargets = []) {
  const affectedTemplate = affectedTargets.find(target => target?.tactical?.template)?.tactical?.template;
  if(affectedTemplate) {
    return clonePlainData(affectedTemplate);
  }
  const hazardZone = placement?.hazardZone;
  if(!hazardZone) {
    return undefined;
  }
  return clonePlainData({
    templateUuid: hazardZone.templateUuid,
    templateId: hazardZone.templateId,
    type: hazardZone.type,
    origin: hazardZone.origin,
    direction: hazardZone.direction,
    angle: hazardZone.angle,
    width: hazardZone.width,
    distance: hazardZone.distance,
    inclusion: hazardZone.inclusion
  });
}

function buildAutoshotgunTargetEvidence(target) {
  const actor = target?.actor || target?.document?.actor;
  const tactical = compactPlainObject({
    template: clonePlainData(target?.tactical?.template),
    cover: clonePlainData(target?.tactical?.cover),
    raycast: clonePlainData(target?.tactical?.raycast)
  });

  return compactPlainObject({
    id: target?.id,
    uuid: target?.uuid,
    tokenUuid: target?.tokenUuid || target?.document?.uuid || target?.uuid,
    actorUuid: target?.actorUuid || actor?.uuid,
    name: target?.name,
    center: clonePlainData(target?.center),
    bounds: clonePlainData(target?.bounds),
    snapshot: clonePlainData(target?.snapshot) || buildActorCombatSnapshot(actor, { includeEquipment: true }),
    distance: clonePlainData(target?.distance),
    tactical: Object.keys(tactical).length > 0 ? tactical : undefined,
    pendingDecisions: clonePlainData(target?.pendingDecisions),
    manualResolution: clonePlainData(target?.manualResolution),
    warnings: clonePlainData(target?.warnings)
  });
}

function markShotgunTargetSelection(target, selected) {
  return {
    document: target?.document,
    actor: target?.actor,
    actorUuid: target?.actorUuid || target?.actor?.uuid,
    tokenUuid: target?.tokenUuid || target?.document?.uuid,
    id: target?.id,
    uuid: target?.uuid,
    name: target?.name,
    center: target?.center,
    bounds: target?.bounds,
    snapshot: target?.snapshot,
    ...(target || {}),
    selected,
    tactical: {
      ...(target?.tactical || {}),
      selected
    }
  };
}

function markShotgunAffectedToken(target) {
  const affected = markShotgunTargetSelection(target, false);
  const templateDistance = target?.tactical?.template?.targetDistance;
  if(Number.isFinite(Number(templateDistance)) && !affected.distance) {
    affected.distance = {
      value: Number(templateDistance),
      units: "m",
      source: "template"
    };
  }
  return affected;
}

function buildShotgunTemplateContext(affectedTargets, selectedTargets = []) {
  const templateEvidence = affectedTargets.find(target => target?.tactical?.template)?.tactical?.template;
  if(!templateEvidence) {
    return undefined;
  }
  const {
    targetDistance,
    ...template
  } = templateEvidence;
  return {
    ...template,
    affectedTargets: affectedTargets.map(target => stripSelectedOverlapDistance(target, selectedTargets))
  };
}

function buildAoEHazardZone(template, affectedTokenCount = 0) {
  if(!template) {
    return undefined;
  }
  return {
    kind: template.type === "cone" ? "shotgun-cone" : template.type,
    templateUuid: template.templateUuid,
    templateId: template.templateId,
    type: template.type,
    origin: clonePlainData(template.origin),
    direction: template.direction,
    angle: template.angle,
    width: template.width,
    distance: template.distance,
    inclusion: template.inclusion,
    affectedTokenCount,
    lifecycle: template.lifecycle || "transient"
  };
}

function clonePlainData(value) {
  if(value === undefined || value === null) {
    return value;
  }
  try {
    return JSON.parse(JSON.stringify(value));
  }
  catch {
    return undefined;
  }
}

function compactPlainObject(data = {}) {
  return Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== undefined)
  );
}

function stripSelectedOverlapDistance(target, selectedTargets) {
  const key = shotgunTargetKey(target);
  if(!key || !target?.distance || !selectedTargets.some(selected => shotgunTargetKey(selected) === key)) {
    return target;
  }
  const {
    distance,
    ...targetWithoutDistance
  } = target;
  return {
    ...targetWithoutDistance,
    tactical: {
      ...(targetWithoutDistance.tactical || {}),
      templateDistance: distance
    }
  };
}

function mergeShotgunRaycastTargets(selectedTargets, affectedTargets) {
  const merged = [];
  const seen = new Set();
  for(const target of [...selectedTargets, ...affectedTargets]) {
    const key = shotgunTargetKey(target);
    if(key && seen.has(key)) {
      const existingIndex = merged.findIndex(existing => shotgunTargetKey(existing) === key);
      if(existingIndex >= 0) {
        merged[existingIndex] = mergeShotgunTargetEvidence(merged[existingIndex], target);
      }
      continue;
    }
    if(key) {
      seen.add(key);
    }
    merged.push(target);
  }
  return merged;
}

function mergeShotgunTargetEvidence(selectedTarget, affectedTarget) {
  const affectedTemplate = affectedTarget?.tactical?.template;
  if(!affectedTemplate) {
    return selectedTarget;
  }
  return {
    ...selectedTarget,
    tactical: {
      ...(selectedTarget?.tactical || {}),
      template: affectedTemplate,
      selected: true
    }
  };
}

function shotgunTargetKey(target = {}) {
  return target.id || target.tokenUuid || target.actorUuid || target.uuid || target.document?.uuid || target.actor?.uuid;
}

export async function drawAoETemplateAndGetTargets(item, attackerToken) {
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

    const aoeType = item?.system?.aoe?.type || "cone";
    const aoeDistance = Number(item?.system?.aoe?.value) || 10;

    const templateData = {
      t: aoeType,
      user: game.user.id,
      distance: aoeDistance,
      direction: 0,
      x: origin.x,
      y: origin.y,
      fillColor: game.user.color || "#ff0000"
    };

    if (aoeType === "cone") {
      templateData.angle = 45;
    }

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
      const hazardZone = buildAoEHazardZone({
        templateUuid: createdDoc.uuid,
        templateId: createdDoc.id,
        type: aoeType,
        origin: { x: createdDoc.x, y: createdDoc.y },
        direction: createdDoc.direction,
        angle: createdDoc.angle,
        width: createdDoc.distance,
        distance: createdDoc.distance,
        inclusion: "intersected"
      }, 0);
      
      // Wait for object to be instantiated
      setTimeout(async () => {
        const templateObj = createdDoc.object;
        if (!templateObj) {
          await deleteTransientTemplateDocument(createdDoc);
          return resolve({ affectedTargets: [], hazardZone });
        }

        const tokens = canvas.tokens.placeables.filter(t => {
          // Exclude the attacker from directional AoEs like cones and rays, as they emanate outward.
          // Circular/rectangular templates like grenades can legitimately hit the attacker if dropped nearby.
          if ((aoeType === "cone" || aoeType === "ray") && t.id === attackerToken.id) {
            return false;
          }

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
            type: aoeType,
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

        await deleteTransientTemplateDocument(createdDoc);
        resolve({
          affectedTargets: augmentedTokens,
          hazardZone: {
            ...hazardZone,
            affectedTokenCount: augmentedTokens.length
          }
        });
      }, 100);
    };

    canvas.stage.on("pointermove", onMove);
    canvas.stage.on("pointerdown", onConfirm);
    canvas.app.view.addEventListener("contextmenu", onCancel, { capture: true, once: true });
  });
}

async function deleteTransientTemplateDocument(templateDocument) {
  if (typeof templateDocument?.delete !== "function") {
    return;
  }
  try {
    await templateDocument.delete();
  } catch (error) {
    console.warn("Failed to delete transient AoE template:", error);
  }
}

export async function promptUseSuppressiveFireTemplate(weapon, maxRounds) {
  return new Promise((resolve) => {
    let content = `
      <form>
        <div class="form-group">
          <label>Rounds Fired (Max ${maxRounds}):</label>
          <input type="number" id="suppressiveRounds" value="${maxRounds}" min="1" max="${maxRounds}" />
        </div>
        <div class="form-group">
          <label>Zone Width (meters):</label>
          <input type="number" id="suppressiveWidth" value="2" min="1" />
        </div>
      </form>
    `;

    new Dialog({
      title: "Suppressive Fire",
      content: content,
      buttons: {
        template: {
          label: "Draw Corridor Template",
          callback: (html) => {
            const roundsFired = parseInt(html.find('#suppressiveRounds').val(), 10) || maxRounds;
            const zoneWidth = parseInt(html.find('#suppressiveWidth').val(), 10) || 2;
            resolve({ roundsFired, zoneWidth });
          }
        },
        cancel: {
          label: "Cancel",
          callback: () => resolve(null)
        }
      },
      default: "template",
      close: () => resolve(null)
    }).render(true);
  });
}

export async function placePersistentSuppressiveFireTemplate(attackerToken, weaponItem, bulletsFired, zoneWidth, maxDistance) {
  return new Promise(async (resolve) => {
    if (!globalThis.canvas?.ready) {
      ui.notifications?.warn("Canvas is not ready. Cannot place template.");
      return resolve(false);
    }

    const origin = attackerToken?.center || attackerToken?.object?.center || attackerToken?.bounds?.center;
    if (!origin) {
      ui.notifications?.warn("Attacker token origin not found.");
      return resolve(false);
    }

    const gridDistance = canvas.scene.grid.distance;

    // Use the builder from suppressive-fire-tracker
    const { buildSuppressiveFireTemplateData } = await import("./suppressive-fire-tracker.js");
    
    let damageFormula = weaponItem.system?.damage || "1d6";
    // Usually suppressive fire deals 1D6 hits per failed save, and the damage of the weapon is per hit.
    // The tracker will handle rolling hits vs weapon damage.

    const templateData = buildSuppressiveFireTemplateData({
        attackerTokenId: attackerToken.id,
        attackerActorId: attackerToken.actor?.id,
        weaponItemId: weaponItem.id,
        damageFormula: damageFormula,
        bulletsFired: bulletsFired,
        zoneWidth: zoneWidth,
        maxDistance: maxDistance,
        origin: origin,
        combatRound: game.combat?.round || 0,
        combatTurn: game.combat?.turn || 0,
        combatId: game.combat?.id || ""
    });

    // Add UI fields
    templateData.user = game.user.id;
    templateData.direction = 0;
    templateData.fillColor = game.user.color || "#ff0000";

    const doc = new CONFIG.MeasuredTemplate.documentClass(templateData, { parent: canvas.scene });
    let template = new CONFIG.MeasuredTemplate.objectClass(doc);
    
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
      template.document.updateSource({ 
        direction: Math.normalizeDegrees(Math.toDegrees(ray.angle))
      });
      template.refresh();
    };

    const onCancel = (event) => {
      event.preventDefault();
      event.stopPropagation();
      cleanup();
      resolve(false);
    };

    const onConfirm = async (event) => {
      event.stopPropagation();
      cleanup();
      
      const createdDocs = await canvas.scene.createEmbeddedDocuments("MeasuredTemplate", [template.document.toObject()]);
      if (!createdDocs || createdDocs.length === 0) return resolve(false);
      
      resolve(true);
    };

    canvas.stage.on("pointermove", onMove);
    canvas.stage.on("pointerdown", onConfirm);
    canvas.app.view.addEventListener("contextmenu", onCancel, { capture: true, once: true });
  });
}
