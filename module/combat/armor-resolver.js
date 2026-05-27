/**
 * Armor resolver for Cyberpunk 2020 combat.
 * Calculates effective stopping power (SP) at hit locations from equipped items.
 */

const ARMOR_WARNING_SEVERITY = "warning";
const LAYER_ORDER = Object.freeze({
  cyberware: 0,
  armor: 1,
  cover: 2
});

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
        layer: getCyberwareLayer(item, system),
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
 * @param {Object} [options] Armor resolution options.
 * @param {Object} [options.cover] Manually supplied temporary cover layer.
 * @returns {Object} Resolution details with layers, warnings, and effectiveStoppingPower.
 */
export function resolveArmor(weaponAP, targetSnapshot, location, options = {}) {
  const layers = orderArmorLayers([
    ...getEquippedArmorForLocation(targetSnapshot, location),
    ...getManualCoverLayers(options.cover)
  ]);
  const warnings = buildArmorWarnings(layers);
  const rawSP = calculateProportionalStoppingPower(layers);

  const effectiveStoppingPower = weaponAP ? Math.floor(rawSP / 2) : rawSP;

  return {
    layers,
    rawStoppingPower: rawSP,
    effectiveStoppingPower,
    armorPiercing: !!weaponAP,
    warnings
  };
}

function calculateProportionalStoppingPower(layers) {
  if(layers.length === 0) {
    return 0;
  }

  let effectiveSP = normalizeStoppingPower(layers[0].stoppingPower);
  for(const layer of layers.slice(1)) {
    const layerSP = normalizeStoppingPower(layer.stoppingPower);
    const largerSP = Math.max(effectiveSP, layerSP);
    const smallerSP = Math.min(effectiveSP, layerSP);
    effectiveSP = largerSP + getProportionalArmorBonus(largerSP - smallerSP);
  }
  return effectiveSP;
}

function getProportionalArmorBonus(difference) {
  if(difference <= 4) {
    return 5;
  }
  if(difference <= 8) {
    return 4;
  }
  if(difference <= 14) {
    return 3;
  }
  if(difference <= 20) {
    return 2;
  }
  if(difference <= 26) {
    return 1;
  }
  return 0;
}

function orderArmorLayers(layers) {
  return layers
    .map((layer, index) => ({ layer, index }))
    .sort((left, right) => {
      const leftOrder = LAYER_ORDER[left.layer.type] ?? LAYER_ORDER.armor;
      const rightOrder = LAYER_ORDER[right.layer.type] ?? LAYER_ORDER.armor;
      return leftOrder - rightOrder || left.index - right.index;
    })
    .map(entry => entry.layer);
}

function getManualCoverLayers(cover) {
  const coverSP = normalizeStoppingPower(cover?.stoppingPower ?? cover?.sp);
  if(coverSP <= 0) {
    return [];
  }
  return [
    {
      id: cover.id || "cover",
      name: cover.name || "Cover",
      type: "cover",
      stoppingPower: coverSP,
      ablation: Number(cover.ablation || 0),
      layer: cover.layer || "hard",
      equipped: true,
      source: cover.source || "manual cover",
      manual: true
    }
  ];
}

function buildArmorWarnings(layers) {
  const warnings = [];
  if(layers.length > 3) {
    warnings.push(armorWarning(
      "armor-too-many-layers",
      "More than three armor or cover layers protect this hit location; verify the referee-approved layers.",
      "Cyberpunk 2020 core rules, Maximum Armor"
    ));
  }

  const hardLayers = layers.filter(layer => String(layer.layer || "").toLowerCase() === "hard");
  if(hardLayers.length > 1) {
    warnings.push(armorWarning(
      "armor-multiple-hard-layers",
      "More than one hard armor or cover layer protects this hit location; verify hard armor layering.",
      "Cyberpunk 2020 core rules, Maximum Armor"
    ));
  }
  return warnings;
}

function armorWarning(code, message, source) {
  return {
    code,
    severity: ARMOR_WARNING_SEVERITY,
    message,
    source
  };
}

function normalizeStoppingPower(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : 0;
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

function getCyberwareLayer(item, system) {
  if(system.layer) {
    return system.layer;
  }
  const searchText = getCyberwareSearchText(item, system);
  if (/\b(skin\s*weave|skinweave)\b/i.test(searchText)) {
    return "soft";
  }
  return "hard";
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
