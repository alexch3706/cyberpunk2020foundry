/**
 * Conformance classification helpers.
 *
 * Derives a classification label (corebook / extended / unknown) from
 * an item's `system.source` value using prefix-based matching.
 *
 * No persisted data changes — all classification is derived at display time.
 */

/** Known extended-source prefixes (lowercased). */
export const knownExtendedPrefixes = [
  "chromebook",
  "chrome",
  "blackhand",
  "blackhammer",
  "corpbook",
  "corporate",
  "deep space",
  "eurosource",
  "eurotour",
  "firestorm",
  "home of the brave",
  "interface",
  "listen up",
  "neo tribes",
  "pacific rim",
  "protect & serve",
  "rockerboy",
  "rough guide",
  "solo of fortune",
  "when gravity fails",
  "wildside",
  "http://",
  "https://",
];

/** Attack types with full resolver coverage. */
export const SUPPORTED_ATTACK_TYPES = Object.freeze(["auto"]);

/** Attack types where a basic resolver path exists but special rules are not applied. */
export const PARTIAL_ATTACK_TYPES = Object.freeze(["autoshotgun"]);

/** Attack types whose special rules are not implemented — manual resolution required. */
export const MANUAL_ATTACK_TYPES = Object.freeze([
  "laser", "microwave", "gas", "grenade", "flamethrow",
  "shotgun", "landmine", "claymore", "rpg", "missile", "explosivecharge",
  "paint", "drugs", "acid", "taser", "dart", "squirt",
  "archer", "throwable"
]);

/**
 * Classify a ranged attack type for Corebook Fidelity Mode.
 * Normalizes using `.toLowerCase().trim()` before matching.
 * @param {string=} attackType — raw system.attackType value (e.g. "Laser", "Auto")
 * @returns {"supported"|"partial"|"manual"|"unknown"}
 */
export function classifyAttackTypeSupport(attackType) {
  const normalized = String(attackType || "").toLowerCase().trim();
  if (SUPPORTED_ATTACK_TYPES.includes(normalized)) return "supported";
  if (PARTIAL_ATTACK_TYPES.includes(normalized)) return "partial";
  if (MANUAL_ATTACK_TYPES.includes(normalized)) return "manual";
  return "unknown";
}

/** Known corebook prefixes (lowercased). */
const corebookPrefixes = [
  "cyberpunk 2020",
  "cyberpunk2020",
  "cp2020",
  "cyberpunk 2nd",
];

/**
 * Classify an item's conformance scope from its system.source value.
 *
 * @param {string|undefined} source - The item's `system.source` value.
 * @returns {"corebook"|"extended"|"unknown"} Derived classification.
 */
export function classifyConformance(source) {
  if (source === undefined || source === null) return "unknown";
  if (typeof source !== "string") return "unknown";

  const cleaned = source.trim().toLowerCase();

  if (cleaned === "" || cleaned === "undefined") return "unknown";

  for (const prefix of corebookPrefixes) {
    if (cleaned.startsWith(prefix)) return "corebook";
  }

  for (const prefix of knownExtendedPrefixes) {
    if (cleaned.startsWith(prefix)) return "extended";
  }

  return "unknown";
}