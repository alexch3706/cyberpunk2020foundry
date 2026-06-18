/**
 * Suppressive Fire Tracker
 * Implements persistent hazard functionality for suppressive fire templates.
 */

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
                            <button class="roll-damage" data-formula="${flags.damageFormula}" data-hits="${hits}">Roll Damage</button>
                        </div>
                    </div>
                `
            };
            
            await ChatMessage.create(chatData);
        });

        html.find(".roll-damage").click(async (ev) => {
            ev.preventDefault();
            const formula = ev.currentTarget.dataset.formula;
            const hits = parseInt(ev.currentTarget.dataset.hits);
            if (!formula || !hits) return;

            // Simple multiple damage rolls or 1 multiplied formula
            const roll = await new Roll(`${hits} * (${formula})`).evaluate();
            roll.toMessage({ speaker: ChatMessage.getSpeaker() });
        });
    });
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

