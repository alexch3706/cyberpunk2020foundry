/**
 * @module settings-helpers — Centralized settings access for combat resolver
 */

/**
 * Check if Corebook Fidelity Mode is enabled.
 * Gracefully falls back to `true` when game.settings is unavailable (e.g. test context).
 * @param {Object} [context] Optional combat context to check for overrides in tests.
 * @returns {boolean}
 */
export function isCorebookFidelityEnabled(context = {}) {
  // Check if context has options.corebookFidelityMode or action.options.corebookFidelityMode (used in tests)
  if (context?.options?.corebookFidelityMode !== undefined) {
    return !!context.options.corebookFidelityMode;
  }
  if (context?.action?.options?.corebookFidelityMode !== undefined) {
    return !!context.action.options.corebookFidelityMode;
  }
  try {
    if (typeof game?.settings?.get === "function") {
      return !!game.settings.get("cyberpunk2020-rilerena", "corebookFidelityMode");
    }
  } catch {
    // fall through to default
  }
  return true; // default for test/standalone contexts without game
}

/**
 * Filter fire mode choices based on current settings.
 * @param {string[]} rawFireModes - Raw fire mode values from __getFireModes()
 * @param {Object} [context] Optional combat context for overrides in tests
 * @returns {string[]} Filtered fire mode values
 */
export function filterSupportedFireModes(rawFireModes = [], context = {}) {
  if (!isCorebookFidelityEnabled(context)) {
    return [...rawFireModes]; // relaxed mode — show all
  }

  return rawFireModes.filter(mode => {
    const lower = String(mode).toLowerCase();
    // Suppressive fire: resolver exists but UI doesn't collect zone inputs
    if (lower === "suppressive") return false;
    return true;
  });
}