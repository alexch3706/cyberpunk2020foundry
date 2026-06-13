import {
  getCyberwareSearchText,
  getCyberwareStoppingPower,
  isArmorCyberware
} from "./armor-resolver.js";

export function getCyberwareArmorStatus(item) {
  const system = item?.system || item || {};
  const baseStoppingPower = getCyberwareStoppingPower(item || {}, system);
  const hasExplicitArmorValue = system.stoppingPower !== undefined || system.sp !== undefined || system.coverage !== undefined;
  const isArmor = baseStoppingPower > 0 && (hasExplicitArmorValue || isArmorCyberware(getCyberwareSearchText(item || {}, system)));
  const ablation = normalizeAblation(system.ablation);
  const currentStoppingPower = Math.max(0, baseStoppingPower - ablation);

  return {
    isArmor,
    baseStoppingPower,
    ablation,
    currentStoppingPower,
    repairable: isArmor && ablation > 0
  };
}

export function getArmorItemStatus(item) {
  const system = item?.system || item || {};
  const coverage = system.coverage || {};
  let baseStoppingPower = 0;
  let ablation = 0;

  for(const segment of Object.values(coverage)) {
    baseStoppingPower += normalizeStoppingPower(segment?.stoppingPower ?? segment?.sp);
    ablation += normalizeAblation(segment?.ablation);
  }

  return {
    isArmor: item?.type === "armor" || Object.keys(coverage).length > 0,
    baseStoppingPower,
    ablation,
    currentStoppingPower: Math.max(0, baseStoppingPower - ablation),
    repairable: ablation > 0
  };
}

export function buildArmorRepairUpdate(item) {
  if(item?.type === "armor" || item?.system?.coverage) {
    return buildArmorItemRepairUpdate(item);
  }

  const status = getCyberwareArmorStatus(item);
  if(!status.isArmor) {
    return undefined;
  }
  return {
    "system.ablation": 0
  };
}

function buildArmorItemRepairUpdate(item) {
  const coverage = item?.system?.coverage || {};
  const update = {};
  for(const [coverageKey, segment] of Object.entries(coverage)) {
    if(normalizeAblation(segment?.ablation) > 0) {
      update[`system.coverage.${coverageKey}.ablation`] = 0;
    }
  }
  return Object.keys(update).length > 0 ? update : undefined;
}

function normalizeStoppingPower(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : 0;
}

function normalizeAblation(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : 0;
}
