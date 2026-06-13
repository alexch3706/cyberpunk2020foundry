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

export function buildArmorRepairUpdate(item) {
  const status = getCyberwareArmorStatus(item);
  if(!status.isArmor) {
    return undefined;
  }
  return {
    "system.ablation": 0
  };
}

function normalizeAblation(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : 0;
}
