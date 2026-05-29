import { rangeDCs, ranges } from "../lookups.js";
import { resolveSingleShotRangedAttack, resolveSuppressiveFire, normalizeAmmoState, resolveMeleeAction } from "./attack-resolver.js";
import { isCorebookFidelityEnabled } from "./settings-helpers.js";

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
  if(options.structured === true) {
    if(canResolveSuppressiveFireContext(context, roller)) {
      return resolveSuppressiveFire(context, options, roller);
    }
    if(canResolveSingleShotRangedContext(context, roller)) {
      return resolveSingleShotRangedAttack(context, options, roller);
    }
    if(canResolveMeleeContext(context, roller)) {
      return resolveMeleeAction(context, options, roller);
    }
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

function canResolveSuppressiveFireContext(context, roller) {
  const fireMode = String(context?.action?.fireMode || "").toLowerCase();
  const isValidMode = context?.action?.type === "ranged"
    && (fireMode === "suppressive" || fireMode === "suppressivefire")
    && Array.isArray(context.targets)
    && typeof roller === "function";

  if (!isValidMode) return false;

  if (isCorebookFidelityEnabled(context)) {
    const fireZoneWidth = context.action?.fireZoneWidth ?? context.action?.options?.fireZoneWidth;
    const roundsFired = context.action?.roundsFired ?? context.action?.options?.roundsFired;

    if (fireZoneWidth === undefined || fireZoneWidth === null || roundsFired === undefined || roundsFired === null) {
      return false;
    }
  }

  return true;
}

function canResolveMeleeContext(context, roller) {
  const actionType = context?.action?.type || "";
  if(actionType !== "melee" && actionType !== "martial") {
    return false;
  }
  if(typeof roller !== "function") {
    return false;
  }
  if(!context?.attacker?.snapshot?.stats) {
    return false;
  }
  if(!Array.isArray(context.targets) || context.targets.length === 0) {
    return false;
  }

  if(actionType === "melee") {
    // Melee weapons always have attackSkill (Melee, Fencing, Brawling, etc.)
    if(!context?.weapon?.snapshot?.attackSkill) {
      return false;
    }
  }
  else if(actionType === "martial") {
    // Martial requires an action choice (Strike, Kick, etc.); skill comes from martial art
    if(!context?.action?.meleeAction) {
      return false;
    }
  }

  return true;
}

function canResolveSingleShotRangedContext(context, roller) {
  if(!isSupportedSingleShotRangedContext(context) || typeof roller !== "function") {
    return false;
  }

  const fireMode = String(context.action?.fireMode || "").toLowerCase();
  if (fireMode === "threeroundburst" || fireMode === "fullauto") {
    // 3-round burst is only against a single target
    if (fireMode === "threeroundburst" && context.targets && context.targets.length > 1) {
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
    // Full auto must have at least 1 round per target
    if (fireMode === "fullauto" && context.targets && context.targets.length > 1) {
      const rawShotsLeft = normalizeAmmoState(shotsLeftVal);
      const rof = Math.max(0, Number(context.weapon?.snapshot?.rof) || 0);
      const maxRoundsFired = rawShotsLeft.valid ? Math.min(rawShotsLeft.value, rof) : rof;
      const finalMaxRoundsFired = (maxRoundsFired <= 0 && rawShotsLeft.valid) ? 0 : maxRoundsFired;
      const targetCount = context.targets.length;
      const roundsFiredPerTarget = Math.floor(finalMaxRoundsFired / targetCount);
      if (roundsFiredPerTarget < 1) {
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
