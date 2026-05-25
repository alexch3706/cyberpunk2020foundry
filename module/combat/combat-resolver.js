/**
 * Top-level combat resolver shell.
 *
 * This migration step establishes the resolver boundary while preserving legacy
 * item-centric behavior. Real mechanics resolution will replace the legacy
 * fallback incrementally in later stories.
 */

/**
 * Resolve a combat action through the current migration shell.
 *
 * @param {Object} context Plain combat context built by a Foundry adapter.
 * @param {Object} [options] Resolver options reserved for future mechanics.
 * @param {Function} [roller] Optional deterministic roller hook reserved for tests.
 * @returns {*} The legacy fallback result for current combat paths.
 */
export function resolveCombatAction(context, options = {}, roller = undefined) {
  if (typeof context?.legacy?.fallback !== "function") {
    throw new Error("Combat resolver requires a legacy fallback during migration.");
  }

  return context.legacy.fallback({
    context,
    options,
    roller
  });
}
