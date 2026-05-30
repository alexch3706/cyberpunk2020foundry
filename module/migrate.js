import { sortSkills, SortOrders } from "./actor/skill-sort.js";
import { getDefaultSkills, localize, tryLocalize } from "./utils.js";

const updateFuncs = {
    "Actor": migrateActor,
    "Item": migrateItem
}
// I know there's a lot of await in here, and I think it might be possible to not wait for the results of updating entities. But I also don't know if it would blow foundry up to get so many update requests so far.

let migrationSuccess = true;
// Handle migration of things. The shape of it nabbed from 5e
export async function migrateWorld() {
    migrationSuccess = true;
    if (!game.user.isGM) {
        ui.notifications.error("Only the GM can migrate the world");
        return;
    }

    try {
        for(const actor of game.actors.contents) {
            await migrateDocument(actor);
            for(const item of actor.items) {
                await migrateDocument(item);
            }
        }
        for(const item of game.items.contents) {
            await migrateDocument(item);
        }
        for(const compendium of game.packs.contents) {
            await migrateCompendium(compendium);
        }
        if(migrationSuccess) {
            await game.settings.set(game.system.id, "systemMigrationVersion", game.system.version);
            ui.notifications.info(`Cyberpunk2020 System Migration to version ${game.system.version} completed!`, {permanent: true});
        }
        else {
            ui.notifications.error(`Cyberpunk2020 System Migration failed :( Please see console log for details`);
        }
    } catch(err) {
        migrationSuccess = false;
        console.error(`Cyberpunk2020 migration aborted: ${err.message}`);
        ui.notifications.error(`Cyberpunk2020 System Migration failed :( Please see console log for details`);
    }

const defaultDataUse = async (document, updateData) => {
    if (!foundry.utils.isEmpty(updateData)) {
        console.log(`Total update data for document ${document.name}:`);
        console.log(updateData);
        await document.update(updateData);
    }
}
async function migrateDocument(document, withUpdataData = defaultDataUse) {
    try {
        let migrateDataFunc = updateFuncs[document.documentName];
        if(migrateDataFunc === undefined) {
            console.log(`No migrate function for document with documentName field "${document.documentName}"`);
        }
        const updateData = await migrateDataFunc(document);
        await withUpdataData(document, updateData);
    } catch(err) {
        migrationSuccess = false;
        err.message = `Failed cyberpunk system migration for ${document?.type} ${document?.name}: ${err.message}`;
        console.error(err);
        return;
    }
}

// For now, actors. We can do migrate world as a total of them all. Nabbed framework of code from 5e
/**
 * Migrate a single Actor document to incorporate latest cyberpunk2020-rilerena data model changes
 * Return an Object of updateData to be applied
 * @param {object} actor    The actor Document to update
 * @return {Object}         The updateData to apply (via `document.update`)
 */
export async function migrateActor(actor) {
    console.log(`Migrating data of ${actor.name}`);

    // No need to migrate items currently
    let actorUpdates = {}

    if(typeof(actor.system.damage) == "string") {
        console.log("Making damage a number");
        actorUpdates[`system.damage`] = 0;
    }
    if(actor.type == "character") {
        const prototypeToken = actor.prototypeToken || actor.token || {};
        const actorLink = prototypeToken.actorLink;
        const hasVision = prototypeToken.sight?.enabled ?? prototypeToken.vision;
        if(!actorLink) {
            console.log(`Making ${actor.name}'s default token be linked to the actor, and be friendly`);
            actorUpdates[`prototypeToken.actorLink`] = true;
            actorUpdates[`prototypeToken.disposition`] = 1;
        }
        if(!hasVision) {
            console.log(`Making ${actor.name}'s default token actually have vision`);
            if (prototypeToken.sight !== undefined) {
                actorUpdates[`prototypeToken.sight.enabled`] = true;
                actorUpdates[`prototypeToken.sight.range`] = 30;
            } else {
                actorUpdates[`token.vision`] = true;
                actorUpdates[`token.dimSight`] = 30;
            }
        }
    }
    
    // TODO: Test this works after v10
    // Trained skills that we keep
    let trainedSkills = [];
    if(actor.system.skills) {
        console.log(`${actor.name} still uses non-item skills. Removing.`);
        actorUpdates["system.skills"] = undefined;

        let trained = (skillData) => skillData.value > 0 || skillData.chipValue > 0;
        // Catalogue skills with points in them to keep
        trainedSkills = Object.entries(actor.system.skills)
            .reduce((acc, [name, skill]) => {
                if(trained(skill)) {
                    acc.push([name, skill]);
                }
                // Grouped skills and the pain that comes with them
                else if(skill.group) {
                    let parentName = name;
                    acc.push(...Object.entries(skill)
                        .filter(([name, subskill]) => name !== "group" && trained(subskill))
                        .map(([name, subskill]) => {
                            // Groups with subskills don't exist anymore - they introduced a lot of complexity and heck.
                            // We're including in the new name the 
                            let prefix = parentName === "MartialArts" ? "Martial Arts" : parentName;
                            // We'll be having a different name than before, so localize here
                            return [`${prefix}: ${localize("Skill"+name)}`, subskill]
                        }));
                }
                return acc;
            }, []);

        trainedSkills = trainedSkills.map(([name, skillData]) => convertOldSkill(name, skillData))
    }
    console.log("Trained skills:");
    console.log(trainedSkills);
    let skills = actor.items.filter(item => item.type === "skill");

    // Migrate from pre-item times
    if(skills.length === 0) {
        console.log(`${actor.name} does not have item skills. Adding aaaall 78 core ones`);
        console.log(`Keeping any skills you had points in: ${trainedSkills.join(", ") || "None"}`);

        // Key core skills by name so they may be overridden
        let skillsToAdd = (await getDefaultSkills()).reduce((acc, item) => {
            acc[item.name] = item.toObject();
            return acc;
        }, {});
        // Override core skills with any trained skill by the same name
        for(const trainedSkill of trainedSkills) {
            // Old skills had localization keys as names, so we'll translate these
            // Subskills have already been translated though, as we can only tell they're subskills while we were looping through them
            // This is what happens when you migrate legacy, kids, it hurts
            let localizedName = tryLocalize("Skill"+trainedSkill.name, trainedSkill.name);
            skillsToAdd[localizedName] = trainedSkill;
        }
        console.log(skillsToAdd);
        skillsToAdd = sortSkills(Object.values(skillsToAdd), SortOrders.Name);
        actorUpdates["system.skillsSortedBy"] = "Name";

        // Keep current items
        const currentItems = Array.from(actor.items).map(item => item.toObject());
        // TODO: This is repeated in a few places - centralise/refactor
        actorUpdates.items = currentItems.concat(skillsToAdd);
    }

    return actorUpdates;
} 

export function migrateItem(item) {
    console.log(`Migrating data of ${item.name}`);

    // No need to migrate items currently
    let itemUpdates = {}
    let system = item.system;
    const itemModel = game.model?.Item?.[item.type] || game.system?.template?.Item?.[item.type];
    let itemTemplates = itemModel?.templates;

    if(itemTemplates?.includes("common") && system.source === undefined) {
        console.log(`${item.name} has no source field. Giving it one.`)
        itemUpdates["system.source"] = "";
    }
    if(item.type == "weapon") {
        if(!system.rangeDamages) {
            console.log(`${item.name} has no place to put damages per range. Instantiating those.`);
            const weaponModel = game.model?.Item?.weapon || game.system?.template?.Item?.weapon;
            itemUpdates["system.rangeDamages"] = weaponModel?.rangeDamages || [0, 0, 0, 0, 0];
        }
    }
    return itemUpdates;
}

export async function migrateCompendium(compendium) {
    if(compendium.locked) {
        console.log(`Not migrating compendium ${compendium.metadata.label}, as it is locked`);
        return
    }
    console.log(`Updating entities in compendium ${compendium.metadata.label}`);
    let documentIDs = compendium.index.map(e => e.id);
    const CHUNK_SIZE = 50;
    for (let i = 0; i < documentIDs.length; i += CHUNK_SIZE) {
        const chunk = documentIDs.slice(i, i + CHUNK_SIZE);
        await Promise.all(chunk.map(async (id) => {
            try {
                let document = await compendium.getDocument(id);
                await migrateDocument(document, async (doc, updateData) => {
                    updateData._id = id; // use _id for updateDocument
                    if (!foundry.utils.isEmpty(updateData)) {
                        await compendium.updateDocument(updateData);
                    }
                });
            } catch(err) {
                console.error(`Cyberpunk2020 migration failed for document ${id} in compendium ${compendium.metadata.label}: ${err.message}`);
                migrationSuccess = false;
            }
        }));
    }
}

// Take an old hardcoded skill and translate it into data for a skill item
export function convertOldSkill(name, skillData) {
    return {name: tryLocalize("Skill"+name, name), type: "skill", data: {
        flavor: "",
        notes: "",
        level: skillData.value || 0,
        chipLevel: skillData.chipValue || 0,
        isChipped: skillData.chipped,
        ip: skillData.ip,
        diffMod: 1, // No skills have those currently.
        isRoleSkill: skillData.isSpecial || false,
        stat: skillData.stat
    }};
}