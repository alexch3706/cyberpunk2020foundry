export function buildFullAutoTargetAction(action = {}, targetIndex = 0, roundsFiredPerTarget = undefined) {
  const targetAction = {
    ...clonePlainData(action),
    roundsFiredPerTarget
  };

  if(targetIndex > 0) {
    targetAction.targetArea = undefined;
    if(targetAction.options) {
      targetAction.options = {
        ...targetAction.options,
        targetArea: undefined
      };
    }
  }

  return targetAction;
}

export function buildFullAutoAttackEvidence({ modifiers = [], roundsFired = undefined, roundsFiredPerTarget = undefined, hitCount = 0 } = {}) {
  return {
    modifiers: cloneArray(modifiers),
    ...(roundsFired !== undefined ? { roundsFired } : {}),
    ...(roundsFiredPerTarget !== undefined ? { roundsFiredPerTarget } : {}),
    hitCount
  };
}

function cloneArray(value = []) {
  return Array.isArray(value) ? value.map(entry => clonePlainData(entry)) : [];
}

function clonePlainData(data) {
  if(data === undefined) {
    return undefined;
  }
  return JSON.parse(JSON.stringify(data));
}
