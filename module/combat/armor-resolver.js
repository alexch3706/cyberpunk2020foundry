/**
 * Armor resolver for Cyberpunk 2020 combat.
 * Calculates effective stopping power (SP) at hit locations from equipped items.
 */

/**
 * Extract equipped armor and cyberware layers covering a specific hit location.
 *
 * @param {Object} targetSnapshot Target actor snapshot.
 * @param {string} location Hit location name.
 * @returns {Array<Object>} Active armor layer snapshots.
 */
export function getEquippedArmorForLocation(targetSnapshot, location) {
  const layers = [];
  if (!targetSnapshot || !location) {
    return layers;
  }

  const targetKey = String(location).toLowerCase();

  // 1. Process equipped armor items
  for (const item of targetSnapshot.equippedArmor || []) {
    const system = item.system || item;
    if (system.equipped === false || item.equipped === false) {
      continue;
    }
    const coverage = getArmorCoverageForLocation(system, targetKey);
    if (coverage) {
      const sp = Number(coverage.stoppingPower !== undefined ? coverage.stoppingPower : coverage.sp || 0);
      if (sp > 0) {
        layers.push({
          id: item.id,
          name: item.name,
          type: "armor",
          stoppingPower: sp,
          ablation: Number(coverage.ablation || 0),
          layer: coverage.layer || "soft",
          equipped: true,
          source: system.source || ""
        });
      }
    }
  }

  // 2. Process equipped cyberware items (e.g., Subdermal Armor / Skin Weave)
  for (const item of targetSnapshot.equippedCyberware || []) {
    const system = item.system || item;
    if (system.equipped === false || item.equipped === false) {
      continue;
    }
    if (!cyberwareCoversLocation(item, system, targetKey)) {
      continue;
    }
    const sp = getCyberwareStoppingPower(item, system);
    if (sp > 0) {
      layers.push({
        id: item.id,
        name: item.name,
        type: "cyberware",
        stoppingPower: sp,
        ablation: Number(system.ablation || 0),
        layer: system.layer || "hard",
        equipped: true,
        source: system.source || ""
      });
    }
  }

  return layers;
}

/**
 * Resolve effective stopping power and return all layers considered.
 *
 * @param {boolean} weaponAP Whether the attacking weapon is armor-piercing.
 * @param {Object} targetSnapshot Target actor snapshot.
 * @param {string} location Hit location name.
 * @returns {Object} Resolution details with layers and effectiveStoppingPower.
 */
export function resolveArmor(weaponAP, targetSnapshot, location) {
  const layers = getEquippedArmorForLocation(targetSnapshot, location);

  // Basic resolve: maximum SP of any active layer (layering logic will be completed in 3.2)
  let rawSP = 0;
  for (const layer of layers) {
    if (layer.stoppingPower > rawSP) {
      rawSP = layer.stoppingPower;
    }
  }

  // Apply basic AP halving if weapon is armor-piercing
  const effectiveStoppingPower = weaponAP ? Math.floor(rawSP / 2) : rawSP;

  return {
    layers,
    effectiveStoppingPower,
    armorPiercing: !!weaponAP
  };
}

/**
 * Find the coverage entry in the armor's system block matching the target location case-insensitively.
 */
function getArmorCoverageForLocation(armorSystem, targetKey) {
  if (!armorSystem || !armorSystem.coverage) {
    return null;
  }
  const entry = Object.entries(armorSystem.coverage).find(([key]) => key.toLowerCase() === targetKey);
  return entry ? entry[1] : null;
}

function getCyberwareStoppingPower(item, system) {
  const explicitSP = system.stoppingPower !== undefined ? system.stoppingPower : system.sp;
  const numericSP = Number(explicitSP);
  if (Number.isFinite(numericSP) && numericSP > 0) {
    return numericSP;
  }

  const match = getCyberwareSearchText(item, system).match(/\bsp\s*([0-9]+)/i);
  return match ? Number(match[1]) : 0;
}

function cyberwareCoversLocation(item, system, targetKey) {
  if (system.coverage) {
    return !!getArmorCoverageForLocation(system, targetKey);
  }

  const searchText = getCyberwareSearchText(item, system);
  if (!isArmorCyberware(searchText)) {
    return false;
  }
  if (/\b(skin\s*weave|skinweave)\b/i.test(searchText)) {
    return true;
  }
  if (/\b(skull|head)\b/i.test(searchText)) {
    return targetKey === "head";
  }
  if (/\btorso\b/i.test(searchText)) {
    return targetKey === "torso";
  }
  return true;
}

function isArmorCyberware(searchText) {
  return /\b(subdermal\s+armor|skin\s*weave|skinweave|body\s+plating)\b/i.test(searchText);
}

function getCyberwareSearchText(item, system) {
  return [
    item.name,
    system.name,
    system.flavor,
    system.notes,
    system.cyberwareSubtype,
    system.cyberwareType
  ].filter(Boolean).join(" ");
}
