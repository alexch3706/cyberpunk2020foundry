import { rangeDCs, ranges } from "../lookups.js";
import { resolveSingleShotRangedAttack } from "./attack-resolver.js";

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
  if(options.structured === true && canResolveSingleShotRangedContext(context, roller)) {
    return resolveSingleShotRangedAttack(context, options, roller);
  }

  if (typeof context?.legacy?.fallback !== "function") {
    throw new Error("Combat resolver requires a legacy fallback during migration.");
  }

  return context.legacy.fallback({
    context,
    options,
    roller
  });
}

function isSupportedSingleShotRangedContext(context) {
  const fireMode = String(context?.action?.fireMode || "").toLowerCase();
  return context?.action?.type === "ranged"
    && (fireMode === "semiauto" || fireMode === "threeroundburst" || fireMode === "fullauto");
}

function canResolveSingleShotRangedContext(context, roller) {
  if(!isSupportedSingleShotRangedContext(context) || typeof roller !== "function") {
    return false;
  }

  const fireMode = String(context.action?.fireMode || "").toLowerCase();
  if (fireMode === "threeroundburst" || fireMode === "fullauto") {
    // 3-round burst and fullauto are only against a single target
    if (context.targets && context.targets.length > 1) {
      return false;
    }
    // Must have at least one remaining round if ammo tracking is enabled
    const shotsLeftVal = context.weapon?.snapshot?.shotsLeft;
    if (shotsLeftVal !== undefined && shotsLeftVal !== null && shotsLeftVal !== "") {
      const value = Number(shotsLeftVal);
      if (Number.isFinite(value) && value <= 0) {
        return false;
      }
    }
  }

  const range = normalizeRange(context.action?.range);
  const targetNumber = rangeDCs[range] || context.action?.targetNumber;
  return Number.isFinite(Number(targetNumber))
    && !!context.attacker?.snapshot?.stats
    && !!context.weapon?.snapshot?.attackSkill
    && Array.isArray(context.targets)
    && context.targets.length > 0;
}

function normalizeRange(range) {
  if(rangeDCs[range]) {
    return range;
  }
  return ranges[range] || range;
}
