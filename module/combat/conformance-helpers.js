/**
 * Conformance classification helpers.
 *
 * Derives a classification label (corebook / extended / unknown) from
 * an item's `system.source` value using prefix-based matching.
 *
 * No persisted data changes — all classification is derived at display time.
 */

/**
 * Known extended-source prefixes (lowercased).
 * These cover all observed source values from packs-src/ plus common
 * supplement and URL variants.
 */
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

/**
 * Known corebook prefixes (lowercased).
 */
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
