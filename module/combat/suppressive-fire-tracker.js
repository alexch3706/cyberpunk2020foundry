/**
 * Suppressive Fire Tracker
 * Implements persistent hazard functionality for suppressive fire templates.
 */
import { resolveSuppressiveFireDamageOutcome } from "./attack-resolver.js";
import { buildActorCombatSnapshot, buildWeaponCombatSnapshot } from "./combat-snapshot.js";
import { buildCombatPreviewData, previewAndApplyCombatOutcome } from "./combat-commit.js";

/**
 * Calculates the Save DC for a Suppressive Fire zone.
 * @param {number} bulletsFired - Total number of bullets fired.
 * @param {number} zoneWidth - Width of the zone in meters (minimum 2).
 * @returns {number} The calculated Save DC.
 */
export function calculateSuppressiveFireSaveDC(bulletsFired, zoneWidth) {
    if (zoneWidth < 2) zoneWidth = 2; // minimum width check just in case
    return Math.floor(bulletsFired / zoneWidth);
}

/**
 * Builds the data object for a new Suppressive Fire MeasuredTemplate.
 */
export function buildSuppressiveFireTemplateData(params) {
    const {
        attackerTokenId,
        attackerActorId,
        weaponItemId,
        damageFormula,
        bulletsFired,
        zoneWidth,
        maxDistance,
        origin,
        combatRound,
        combatTurn,
        combatId
    } = params;

    const saveDC = calculateSuppressiveFireSaveDC(bulletsFired, zoneWidth);

    return {
        t: "ray",
        distance: maxDistance || 10,
        width: zoneWidth,
        x: origin.x,
        y: origin.y,
        flags: {
            cyberpunk2020: {
                suppressiveFire: {
                    shooterActorId: attackerActorId,
                    shooterTokenId: attackerTokenId,
                    weaponItemId,
                    damageFormula,
                    bulletsFired,
                    remainingHitCap: bulletsFired,
                    saveDC,
                    zoneWidth,
                    createdCombatId: combatId,
                    createdRound: combatRound,
                    createdTurn: combatTurn,
                    expiresAtRound: combatRound + 1, // Will be refined later
                    expiresAtTurn: combatTurn,
                    resolvedTokenIds: []
                }
            }
        }
    };
}

/**
 * Hook registration for Suppressive Fire
 */
export function registerSuppressiveFireHooks() {
    // Only GM handles the resolution to avoid duplicate resolution from multiple clients
    Hooks.on("updateToken", (tokenDocument, change, options, userId) => {
        if (!game.user.isGM) return;
        if (change.x === undefined && change.y === undefined) return;
        handleTokenMovement(tokenDocument);
    });

    // In V13+ we can use moveToken
    Hooks.on("moveToken", (tokenDocument, change, options, userId) => {
        if (!game.user.isGM) return;
        handleTokenMovement(tokenDocument);
    });

    Hooks.on("combatTurn", (combat, updateData, updateOptions) => {
        if (!game.user.isGM) return;
        handleSuppressiveFireCombatTurn(combat, updateData);
    });

    Hooks.on("renderChatMessage", (message, html, data) => {
        html.find(".roll-suppressive-hits").click(async (ev) => {
            ev.preventDefault();
            const templateId = ev.currentTarget.dataset.templateId;
            const actorId = ev.currentTarget.dataset.actorId;
            
            const templateDoc = canvas.scene.templates.get(templateId);
            if (!templateDoc) return ui.notifications?.warn("Suppressive fire template no longer exists.");

            const flags = templateDoc.flags.cyberpunk2020?.suppressiveFire;
            if (!flags) return;

            if (flags.remainingHitCap <= 0) return ui.notifications?.warn("This suppressive fire zone is depleted.");

            // Roll 1d6
            const roll = await new Roll("1d6").evaluate();
            
            // Capped by remaining hits
            const hits = Math.min(roll.total, flags.remainingHitCap);
            
            // Deduct hits
            const newCap = flags.remainingHitCap - hits;
            await templateDoc.update({ "flags.cyberpunk2020.suppressiveFire.remainingHitCap": newCap });
            
            const actor = game.actors.get(actorId);

            let chatData = {
                user: game.user.id,
                speaker: ChatMessage.getSpeaker({ actor: actor }),
                content: `
                    <div class="cyberpunk2020-chat-card">
                        <header class="card-header flexrow">
                            <h3>Suppressive Fire Hits</h3>
                        </header>
                        <div class="card-content">
                            <p><strong>${actor ? actor.name : 'Target'}</strong> takes <strong>${hits}</strong> hits from the suppressive fire zone!</p>
                            <p>Remaining hits in zone: ${newCap}</p>
                            <button class="roll-damage" data-formula="${flags.damageFormula}" data-hits="${hits}" data-template-id="${templateId}" data-actor-id="${actorId}">Roll Damage</button>
                        </div>
                    </div>
                `
            };
            
            await ChatMessage.create(chatData);
        });

        html.find(".roll-damage").click(async (ev) => {
            ev.preventDefault();
            const hits = parseInt(ev.currentTarget.dataset.hits);
            const templateId = ev.currentTarget.dataset.templateId;
            const actorId = ev.currentTarget.dataset.actorId;
            if (!templateId || !actorId || !hits) return;

            await resolveSuppressiveFireDamageFromChat({ templateId, actorId, hits });
        });
    });
}

export async function resolveSuppressiveFireDamageFromChat({ templateId, actorId, hits }, options = {}) {
    const templateDoc = canvas.scene.templates.get(templateId);
    if (!templateDoc) {
        ui.notifications?.warn("Suppressive fire template no longer exists.");
        return { status: "missing-template" };
    }

    const flags = templateDoc.flags.cyberpunk2020?.suppressiveFire;
    if (!flags) {
        return { status: "missing-suppressive-fire-flags" };
    }

    const targetActor = game.actors.get(actorId);
    const shooterActor = game.actors.get(flags.shooterActorId);
    const weaponItem = shooterActor?.items?.get(flags.weaponItemId)
        || shooterActor?.itemTypes?.weapon?.find(item => item.id === flags.weaponItemId);

    if (!targetActor || !shooterActor || !weaponItem) {
        ui.notifications?.warn("Suppressive fire damage could not resolve actor or weapon data.");
        return { status: "missing-combat-document" };
    }

    const outcome = await resolveSuppressiveFireDamageOutcome({
        action: {
            type: "ranged",
            fireMode: "Suppressive",
            source: "Suppressive Fire Zone",
            hazardZone: {
                kind: "suppressive-fire",
                templateUuid: templateDoc.uuid,
                templateId: templateDoc.id,
                type: templateDoc.t,
                origin: { x: templateDoc.x, y: templateDoc.y },
                direction: templateDoc.direction,
                width: flags.zoneWidth,
                distance: templateDoc.distance,
                lifecycle: "persistent"
            }
        },
        attacker: {
            actorUuid: shooterActor.uuid,
            name: shooterActor.name,
            snapshot: buildActorCombatSnapshot(shooterActor, { includeEmptySkills: true })
        },
        weapon: {
            itemUuid: weaponItem.uuid,
            name: weaponItem.name,
            snapshot: buildWeaponCombatSnapshot(weaponItem)
        },
        target: {
            actorUuid: targetActor.uuid,
            name: targetActor.name,
            snapshot: buildActorCombatSnapshot(targetActor, { includeEquipment: true })
        },
        hitCount: hits
    }, options.resolverOptions || {}, options.roller || activeSuppressiveFireRoller);

    const commitKey = options.commitKey || buildSuppressiveFireCommitKey({ templateId, actorId });
    return await previewAndConfirmSuppressiveFireOutcome(outcome, { ...options, commitKey });
}

async function previewAndConfirmSuppressiveFireOutcome(outcome, options = {}) {
    const commitMode = resolveDamageCommitMode();
    if (commitMode === "direct" || options.decision === "confirm") {
        return await previewAndApplyCombatOutcome(outcome, { decision: "confirm", adapter: options.adapter, commitKey: options.commitKey });
    }

    const previewResult = await previewAndApplyCombatOutcome(outcome, { adapter: options.adapter, commitKey: options.commitKey });
    if (typeof Dialog !== "function") {
        return previewResult;
    }

    return new Promise((resolve) => {
        let resolved = false;
        const preview = buildCombatPreviewData(outcome);
        const targetSummary = (preview.targets || []).map(target => {
            const name = target.target?.name || "Unknown";
            const hitInfo = target.hits ? `${target.hits.length} hit(s)` : "no hits";
            return `${name}: ${hitInfo}`;
        }).join("<br>");

        const dialog = new Dialog({
            title: "Suppressive Fire Damage",
            content: `
              <p><strong>Review suppressive fire damage:</strong></p>
              <p>${targetSummary}</p>
              ${preview.warnings.length > 0 ? `<p style="color:#b88a00">${preview.warnings.map(w => w.message).join("; ")}</p>` : ""}
            `,
            buttons: {
                confirm: {
                    label: "Apply",
                    callback: async () => {
                        if (resolved) return;
                        resolved = true;
                        resolve(await previewAndApplyCombatOutcome(outcome, {
                            decision: "confirm",
                            messageId: previewResult.messageId,
                            plannedUpdates: previewResult.preview?.plan || previewResult.preview?.plannedUpdates,
                            adapter: options.adapter,
                            commitKey: options.commitKey
                        }));
                    }
                },
                cancel: {
                    label: "Cancel",
                    callback: async () => {
                        if (resolved) return;
                        resolved = true;
                        resolve(await previewAndApplyCombatOutcome(outcome, {
                            decision: "cancel",
                            messageId: previewResult.messageId,
                            plannedUpdates: previewResult.preview?.plan || previewResult.preview?.plannedUpdates,
                            adapter: options.adapter,
                            commitKey: options.commitKey
                        }));
                    }
                }
            },
            default: "confirm",
            close: () => {
                if (!resolved) {
                    resolved = true;
                    previewAndApplyCombatOutcome(outcome, {
                        decision: "cancel",
                        messageId: previewResult.messageId,
                        plannedUpdates: previewResult.preview?.plan || previewResult.preview?.plannedUpdates,
                        adapter: options.adapter,
                        commitKey: options.commitKey
                    }).then(resolve);
                }
            }
        });
        dialog.render(true);
    });
}

function buildSuppressiveFireCommitKey({ templateId, actorId }) {
    const combat = game?.combat;
    return [
        "suppressive-fire",
        templateId,
        actorId,
        combat?.id || "no-combat",
        combat?.round ?? "no-round",
        combat?.turn ?? "no-turn"
    ].join(":");
}

function resolveDamageCommitMode() {
    try {
        if (typeof game?.settings?.get === "function") {
            return game.settings.get(game.system.id, "combatDamageCommitMode");
        }
    } catch {
        return "previewConfirm";
    }
    return "previewConfirm";
}

async function activeSuppressiveFireRoller(request = {}) {
    if (typeof Roll !== "function") {
        throw new Error("Suppressive fire damage resolution requires Foundry Roll.");
    }
    const formula = String(request.formula || "1d10").replace(/\s+hit\s+location$/i, "");
    const roll = await new Roll(formula).evaluate();
    const firstDie = roll.dice && roll.dice.length > 0 ? roll.dice[0] : null;
    return {
        id: request.id,
        formula: request.formula,
        total: roll.total,
        die: {
            faces: firstDie ? firstDie.faces : 10,
            natural: firstDie?.results?.[0]?.result ?? roll.total,
            results: firstDie?.results ? firstDie.results.map(result => result.result) : [roll.total],
            exploded: firstDie?.results ? firstDie.results.some(result => result.active === false) : false
        }
    };
}

function getActiveSuppressiveFireTemplates() {
    if (!canvas || !canvas.templates) return [];
    return canvas.templates.placeables.filter(t => 
        t.document.flags?.cyberpunk2020?.suppressiveFire &&
        t.document.flags.cyberpunk2020.suppressiveFire.remainingHitCap > 0
    );
}

async function handleTokenMovement(tokenDocument) {
    if (!tokenDocument.object) return;
    const templates = getActiveSuppressiveFireTemplates();
    for (const template of templates) {
        await checkAndResolveIntersection(tokenDocument, template);
    }
}

export async function handleSuppressiveFireCombatTurn(combat, updateData = {}) {
    const currentCombatant = getUpdatedCombatant(combat, updateData);
    if (!currentCombatant || !currentCombatant.tokenId) return;

    const templates = getActiveSuppressiveFireTemplates();
    for (const template of templates) {
        const flags = template.document.flags.cyberpunk2020.suppressiveFire;
        
        // 1. If the current combatant is the shooter, expire their templates
        if (flags.shooterTokenId === currentCombatant.tokenId) {
            await expireSuppressiveFireTemplate(template);
            continue;
        }

        // 2. Check if the current combatant starts their turn inside the zone
        const tokenDocument = canvas.tokens.get(currentCombatant.tokenId)?.document;
        if (tokenDocument) {
            await checkAndResolveIntersection(tokenDocument, template);
        }
    }
}

function getUpdatedCombatant(combat, updateData = {}) {
    const turn = Number(updateData.turn);
    if (Number.isInteger(turn) && Array.isArray(combat?.turns)) {
        return combat.turns[turn] || combat.combatant;
    }
    return combat?.combatant;
}

async function expireSuppressiveFireTemplate(template) {
    // Depending on world setting, delete or deactivate
    // For now, we will delete it as requested initially, or mark it depleted
    await template.document.delete();
}

export async function checkAndResolveIntersection(tokenDocument, template) {
    const flags = template.document.flags.cyberpunk2020.suppressiveFire;
    if (flags.remainingHitCap <= 0) return false; // Depleted

    // Check if token already resolved this turn/movement
    const combatId = globalThis.game?.combat?.id || "none";
    const combatRound = globalThis.game?.combat?.round || 0;
    const combatTurn = globalThis.game?.combat?.turn || 0;
    const resolutionId = `${combatId}-${combatRound}-${combatTurn}`;

    const resolvedTokens = flags.resolvedTokenIds || [];
    const tokenResolutionRecord = resolvedTokens.find(r => r.id === tokenDocument.id && r.resolutionId === resolutionId);
    
    if (tokenResolutionRecord) {
        return false; // Already resolved for this event
    }

    // Check geometric intersection
    const tCenter = tokenDocument.object?.center || { 
        x: tokenDocument.x + (tokenDocument.width * (globalThis.canvas?.grid?.size || 100) / 2), 
        y: tokenDocument.y + (tokenDocument.height * (globalThis.canvas?.grid?.size || 100) / 2) 
    };
    const intersects = template.shape?.contains(tCenter.x - template.document.x, tCenter.y - template.document.y);

    if (intersects) {
        // Mark as resolved first to prevent loops
        const newResolved = [...resolvedTokens, { id: tokenDocument.id, resolutionId }];
        await template.document.update({ "flags.cyberpunk2020.suppressiveFire.resolvedTokenIds": newResolved });

        // Prompt the save dialog
        await promptSuppressiveFireSave(tokenDocument, template);
        return true;
    }
    return false;
}

export async function promptSuppressiveFireSave(tokenDocument, template) {
    const flags = template.document.flags.cyberpunk2020.suppressiveFire;
    const actor = tokenDocument.actor;
    if (!actor) return;

    // Dispatch a chat message asking for the save
    let chatData = {
        user: globalThis.game?.user?.id || "test",
        speaker: globalThis.ChatMessage?.getSpeaker({ actor: actor }) || { alias: actor.name },
        content: `
            <div class="cyberpunk2020-chat-card">
                <header class="card-header flexrow">
                    <h3>Suppressive Fire Zone!</h3>
                </header>
                <div class="card-content">
                    <p><strong>${actor.name}</strong> has entered a suppressive fire zone.</p>
                    <p><strong>Save DC:</strong> ${flags.saveDC}</p>
                    <p><strong>Remaining Hits in Zone:</strong> ${flags.remainingHitCap}</p>
                    <p><i>Roll REF + Athletics + 1D10 vs ${flags.saveDC}.</i></p>
                    <hr>
                    <button class="roll-suppressive-hits" data-template-id="${template.document.id}" data-actor-id="${actor.id}">Failed Save! Roll 1D6 Hits</button>
                </div>
            </div>
        `
    };
    
    if (globalThis.ChatMessage) {
        await globalThis.ChatMessage.create(chatData);
    }
}
