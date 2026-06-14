/**
 * Build JSON-safe combat snapshots from Foundry-like documents.
 *
 * Resolver modules consume plain data only. This module is the seam where live
 * actor/item documents are converted into that resolver interface.
 */

export function buildActorCombatSnapshot(actor, options = {}) {
  if(options.existingSnapshot) {
    return clonePlainData(options.existingSnapshot);
  }
  if(!actor?.system) {
    return undefined;
  }

  const skills = buildSkillSnapshot(actor, {
    includeEmpty: options.includeEmptySkills === true
  });

  return compactPlainObject({
    stats: clonePlainData(actor.system.stats),
    skills,
    damage: clonePlainData(actor.system.damage),
    hitLocations: clonePlainData(actor.system.hitLocations),
    ...(options.includeEquipment === true ? {
      equippedArmor: normalizeEquippedItemSnapshots(actor.itemTypes?.armor || []),
      equippedCyberware: normalizeEquippedItemSnapshots(actor.itemTypes?.cyberware || [])
    } : {})
  });
}

export function buildWeaponCombatSnapshot(item) {
  const system = item?.system || {};
  return {
    damage: system.damage,
    ap: system.ap,
    shotsLeft: system.shotsLeft,
    rof: system.rof,
    reliability: system.reliability,
    range: system.range,
    accuracy: system.accuracy,
    attackType: system.attackType,
    attackSkill: system.attackSkill,
    rangeDamages: system.rangeDamages ? clonePlainData(system.rangeDamages) : undefined
  };
}

export function buildSkillSnapshot(actor, options = {}) {
  if(!actor?.system) {
    return options.includeEmpty === true ? {} : undefined;
  }

  const skills = clonePlainData(actor.system.skills?.skills || actor.system.skills || {}) || {};

  if(Array.isArray(actor.itemTypes?.skill)) {
    for(const skill of actor.itemTypes.skill) {
      const level = typeof actor.getSkillVal === "function"
        ? actor.getSkillVal(skill.name)
        : (skill.system?.level || skill.system?.value || 0);
      skills[skill.name] = {
        ...(clonePlainData(skill.system || {}) || {}),
        level
      };
    }
  }

  if(Object.keys(skills).length === 0 && options.includeEmpty !== true) {
    return undefined;
  }

  return skills;
}

export function normalizeEquippedItemSnapshots(items = []) {
  return Array.from(items || [])
    .filter(item => item?.system?.equipped === true)
    .map(item => compactPlainObject({
      id: item.id,
      name: item.name,
      type: item.type,
      system: clonePlainData(item.system)
    }));
}

export function clonePlainData(data) {
  if(data === undefined) {
    return undefined;
  }
  if(data === null) {
    return null;
  }
  try {
    return JSON.parse(JSON.stringify(data));
  }
  catch {
    return undefined;
  }
}

export function compactPlainObject(data = {}) {
  return Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== undefined)
  );
}
