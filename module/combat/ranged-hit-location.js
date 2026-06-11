/**
 * Prepare hit-location actions for repeated ranged hits.
 *
 * Aimed multi-hit attacks keep the chosen body part for every successful hit.
 * Unaimed attacks continue to resolve each hit through the random location path.
 */
export function buildMultiHitLocationAction(action = {}, hitIndex = 0) {
  const targetArea = action.targetArea || action.options?.targetArea;
  const hitAction = {
    ...action,
    ...(targetArea ? { targetArea } : {})
  };

  if(targetArea) {
    hitAction.options = {
      ...(hitAction.options || {}),
      targetArea
    };
    return hitAction;
  }

  if(hitIndex > 0) {
    hitAction.targetArea = undefined;
    if(hitAction.options) {
      hitAction.options = {
        ...hitAction.options,
        targetArea: undefined
      };
    }
  }

  return hitAction;
}
