/**
 * Pure data module defining all Cyberpunk 2020 corebook martial arts styles,
 * their key technique bonuses, and action prerequisites.
 *
 * This module has zero Foundry dependencies — it can be imported and tested
 * outside a live game session.
 *
 * @module martial-arts-data
 */

/**
 * List of all supported martial/brawling action keys.
 * Single source of truth — matches the keys in `module/lookups.js` martialActions.
 * @type {string[]}
 */
export const MARTIAL_ACTIONS = [
  "dodge",
  "blockParry",
  "strike",
  "kick",
  "disarm",
  "sweepTrip",
  "grapple",
  "hold",
  "choke",
  "throw",
  "escape"
];

/**
 * @typedef {Object} MartialStyleDef
 * @property {string} name                       Standard name of the martial art.
 * @property {string} displayKey                 Foundry localization key.
 * @property {Object<string,number>} keyTechniques  Action → bonus map. Only key techniques are listed.
 * @property {Object<string,string[]>} requiresPrerequisite  Action → [prior actions] map.
 *                                Array elements represent an "OR" relationship (any one satisfies).
 */

/** @type {Object<string, MartialStyleDef>} */
const rawStyles = Object.create(null);
Object.assign(rawStyles, {
  brawling: {
    name: "Brawling",
    displayKey: "CYBERPUNK.SkillBrawling",
    keyTechniques: {
      dodge: 0,
      blockParry: 0,
      strike: 0,
      kick: 0,
      disarm: 0,
      sweepTrip: 0,
      grapple: 0,
      hold: 0,
      choke: 0,
      throw: 0,
      escape: 0
    },
    requiresPrerequisite: {}
  },
  aikido: {
    name: "Aikido",
    displayKey: "CYBERPUNK.SkillMartial Arts: Aikido",
    keyTechniques: {
      strike: 1,
      blockParry: 0,
      disarm: 1,
      hold: 1,
      throw: 1
    },
    requiresPrerequisite: {
      throw: ["grapple", "blockParry", "dodge"],
      disarm: ["blockParry", "dodge"],
      hold: ["grapple", "blockParry", "dodge"]
    }
  },
  animalkungfu: {
    name: "Animal Kung Fu",
    displayKey: "CYBERPUNK.SkillMartial Arts: AnimalKungFu",
    keyTechniques: {
      strike: 1,
      kick: 1,
      blockParry: 0,
      dodge: 1,
      grapple: 1
    },
    requiresPrerequisite: {}
  },
  boxing: {
    name: "Boxing",
    displayKey: "CYBERPUNK.SkillMartial Arts: Boxing",
    keyTechniques: {
      strike: 2,
      blockParry: 1,
      dodge: 0
    },
    requiresPrerequisite: {}
  },
  capoeira: {
    name: "Capoeira",
    displayKey: "CYBERPUNK.SkillMartial Arts: Capoeira",
    keyTechniques: {
      strike: 0,
      kick: 2,
      dodge: 1,
      sweepTrip: 1
    },
    requiresPrerequisite: {}
  },
  choilifut: {
    name: "Choi Li Fut",
    displayKey: "CYBERPUNK.SkillMartial Arts: ChoiLiFut",
    keyTechniques: {
      strike: 2,
      kick: 0,
      blockParry: 1,
      grapple: 1
    },
    requiresPrerequisite: {}
  },
  judo: {
    name: "Judo",
    displayKey: "CYBERPUNK.SkillMartial Arts: Judo",
    keyTechniques: {
      strike: 0,
      disarm: 1,
      hold: 1,
      throw: 2,
      escape: 1
    },
    requiresPrerequisite: {
      throw: ["grapple"],
      hold: ["grapple"]
    }
  },
  karate: {
    name: "Karate",
    displayKey: "CYBERPUNK.SkillMartial Arts: Karate",
    keyTechniques: {
      strike: 2,
      kick: 1,
      blockParry: 1,
      dodge: 0
    },
    requiresPrerequisite: {}
  },
  savate: {
    name: "Savate",
    displayKey: "CYBERPUNK.SkillMartial Arts: Savate",
    keyTechniques: {
      strike: 1,
      kick: 2,
      blockParry: 0,
      dodge: 1
    },
    requiresPrerequisite: {}
  },
  taekwondo: {
    name: "Tae Kwon Do",
    displayKey: "CYBERPUNK.SkillMartial Arts: TaeKwonDo",
    keyTechniques: {
      strike: 2,
      kick: 2,
      blockParry: 0
    },
    requiresPrerequisite: {}
  },
  thaikickboxing: {
    name: "Thai Kickboxing",
    displayKey: "CYBERPUNK.SkillMartial Arts: ThaiKickBoxing",
    keyTechniques: {
      strike: 1,
      kick: 2,
      blockParry: 0,
      grapple: 1
    },
    requiresPrerequisite: {}
  },
  wrestling: {
    name: "Wrestling",
    displayKey: "CYBERPUNK.SkillMartial Arts: Wrestling",
    keyTechniques: {
      strike: 0,
      grapple: 2,
      hold: 1,
      escape: 1
    },
    requiresPrerequisite: {
      hold: ["grapple"]
    }
  }
});

/**
 * Recursively deep-freeze an object and all its nested objects/arrays.
 * @param {Object} obj
 * @returns {Object} The passed object, now frozen.
 */
function deepFreeze(obj) {
  Object.freeze(obj);
  Object.keys(obj).forEach(key => {
    const val = obj[key];
    if (val !== null && typeof val === "object" && !Object.isFrozen(val)) {
      deepFreeze(val);
    }
  });
  return obj;
}

/**
 * Map of all martial styles by lowercase key.
 * Deeply frozen to prevent accidental runtime mutations.
 * @type {Readonly<Object<string, Readonly<MartialStyleDef>>>}
 */
export const MARTIAL_STYLES = deepFreeze(rawStyles);

/**
 * Get the key technique bonus for a given style + action combination.
 *
 * Inputs are normalized to lowercase and trimmed.
 * Returns 0 if the action is not a key technique for the given style,
 * or if the style or action key is invalid/unknown.
 *
 * @param {string} style  - Style key (e.g. "karate", "brawling").
 * @param {string} action - Action key (e.g. "strike", "dodge").
 * @returns {number} The technique bonus (0 if not a key technique or unknown).
 */
export function getKeyTechniqueBonus(style, action) {
  const s = String(style || "").toLowerCase().trim();
  const a = String(action || "").toLowerCase().trim();
  const styleDef = MARTIAL_STYLES[s];
  if (!styleDef) return 0;

  // Case-insensitive lookup of action key in the style definition
  const matchedKey = Object.keys(styleDef.keyTechniques).find(k => k.toLowerCase() === a);
  return matchedKey ? styleDef.keyTechniques[matchedKey] : 0;
}

/**
 * Returns `true` if the style is a trained martial art (not Brawling).
 * Inputs are normalized to lowercase and trimmed.
 * Returns `false` for invalid/nonexistent styles.
 *
 * @param {string} style - Style key.
 * @returns {boolean}
 */
export function isTrainedMartial(style) {
  const s = String(style || "").toLowerCase().trim();
  if (!Object.prototype.hasOwnProperty.call(MARTIAL_STYLES, s)) return false;
  return s !== "brawling";
}

/**
 * Get prerequisite actions that must be satisfied before a given action
 * can be attempted with a given style.
 *
 * Merges generic rules (Choke requires Hold, Escape requires Grapple/Hold)
 * with style-specific prerequisites.
 *
 * Inputs are normalized to lowercase and trimmed.
 * Returns `null` if no prerequisite exists, or for invalid inputs.
 *
 * @param {string} style  - Style key.
 * @param {string} action - Action key.
 * @returns {string[]|null} Array of prerequisite action keys (OR relationship),
 *                           or null if none required or invalid.
 */
export function getRequiresPrerequisite(style, action) {
  const s = String(style || "").toLowerCase().trim();
  const a = String(action || "").toLowerCase().trim();

  const styleDef = MARTIAL_STYLES[s];
  const normalizedAction = MARTIAL_ACTIONS.find(act => act.toLowerCase() === a);
  if (!styleDef || !normalizedAction) {
    return null;
  }

  // Generic/general rules that apply to all styles (including Brawling)
  if (normalizedAction === "choke") {
    return ["hold"];
  }
  if (normalizedAction === "escape") {
    return ["grapple", "hold"];
  }

  // Style-specific prerequisites
  const matchedKey = Object.keys(styleDef.requiresPrerequisite).find(k => k.toLowerCase() === a);
  return matchedKey ? styleDef.requiresPrerequisite[matchedKey] : null;
}

/**
 * List all martial style keys (lowercase).
 * @returns {string[]} Array of lowercase style keys.
 */
export function getMartialStyleNames() {
  return Object.keys(MARTIAL_STYLES);
}