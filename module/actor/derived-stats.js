export function applyDerivedStatOverrides(system) {
  const stats = system?.stats || {};
  applyOverride(stats.bt, "modifier", "modifierOverride");
  applyOverride(stats.bt, "carry", "carryOverride");
  applyOverride(stats.bt, "lift", "liftOverride");
  applyOverride(stats.ma, "run", "runOverride");
  applyOverride(stats.ma, "leap", "leapOverride");
  applyEmpHumanityOverride(stats.emp);
}

function applyOverride(target, valueKey, overrideKey) {
  if(!target) {
    return;
  }
  const overrideValue = normalizeOverrideValue(target[overrideKey]);
  if(overrideValue !== undefined) {
    target[valueKey] = overrideValue;
  }
}

function applyEmpHumanityOverride(emp) {
  const overrideValue = normalizeOverrideValue(emp?.humanityTotalOverride);
  if(overrideValue !== undefined && emp?.humanity) {
    emp.humanity.total = overrideValue;
  }
}

function normalizeOverrideValue(value) {
  if(value === undefined || value === null || value === "") {
    return undefined;
  }
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : undefined;
}
