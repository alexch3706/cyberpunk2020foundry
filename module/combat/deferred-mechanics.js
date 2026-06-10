/**
 * @module deferred-mechanics
 * Central registry of known deferred/manual mechanics surfaced to referees.
 */

/** @typedef {"wired"|"deferred"|"manual"|"partial"|"removed"} DeferredStatus */
/** @typedef {Object} DeferredMechanic
 * @property {string} id        — stable machine key
 * @property {string} label     — human-readable label
 * @property {DeferredStatus} status — current implementation status
 * @property {string} reason    — short explanation
 * @property {string=} storyRef — story ID that owns this mechanic
 * @property {string=} frRef    — FR number
 */

/** @type {DeferredMechanic[]} */
export const DEFERRED_MECHANICS = Object.freeze([
  { id: "exotic-attack-types",          label: "Exotic weapon attack rules (laser, shotgun, grenade, gas, etc.)",                                    status: "manual",   reason: "Resolver applies basic ranged attack only; special rules not implemented.",     storyRef: "6.2", frRef: "FR20" },
  { id: "autoshotgun-partial",          label: "Autoshotgun shotgun-specific mechanics (pellet count, spread, cone)",                                status: "partial",  reason: "Basic full-auto path works but shotgun-specific rules not applied.",              storyRef: "6.2", frRef: "FR20" },
  { id: "cover-sp-dialog",              label: "Manual cover SP input in modifiers dialog",                                                         status: "deferred", reason: "Armor resolver supports cover SP but ModifiersDialog does not collect it.",    storyRef: "6.2", frRef: "FR10" },
  { id: "key-technique-untrained-guard",label: "Key technique untrained-attacker guard",                                                            status: "deferred", reason: "Key technique bonus is applied even when martial art skill level is 0.",      storyRef: "5.5", frRef: "FR18" },
  { id: "initiative-tracker",           label: "Initiative roll adds to combat tracker",                                                             status: "deferred", reason: "Rolling initiative does not auto-join encounter tracker.",                  storyRef: null,  frRef: "" },
  { id: "preview-confirm-concurrency",  label: "Preview/confirm double-click guard",                                                                status: "wired",    reason: "Commit orchestration blocks duplicate confirm for the same preview token.",   storyRef: "7.4", frRef: "FR3" },
  { id: "staged-CONFIRM-stale",         label: "Staged preview/confirm staleness guard",                                                            status: "wired",    reason: "Commit re-validates preview baselines and blocks stale confirms.",            storyRef: "7.4", frRef: "FR11" },
  { id: "duplicate-woundStateLabel",    label: "Duplicate woundStateLabel function",                                                                status: "deferred", reason: "Duplicated across state-planner.js and save-resolver.js.",                   storyRef: null,  frRef: "" },
  { id: "duplicate-normalizeDamage",    label: "Duplicate normalizeDamageValue function",                                                           status: "deferred", reason: "Duplicated across state-planner.js and save-resolver.js.",                   storyRef: null,  frRef: "" },
  { id: "cover-as-standard-armor",      label: "Cover resolved as standard armor layer",                                                           status: "deferred", reason: "Temporary cover participates in proportional layering instead of sequential resolution.", storyRef: null, frRef: "FR10" },
  { id: "ablation-cover-vs-armor",      label: "Cover ablation not separated from armor",                                                          status: "deferred", reason: "When cover is bypassed, ablation updates target personal armor instead of cover.", storyRef: null, frRef: "FR11" },
  { id: "hardcoded-limb-keys",          label: "Hardcoded limb key set misses hands/feet",                                                          status: "deferred", reason: "LIMB_LOCATION_KEYS does not include hands or feet for severing/crushing warnings.", storyRef: null, frRef: "FR13" },
  { id: "death-save-dead-check",        label: "Death saves for already-dead targets",                                                              status: "wired",    reason: "Death Save prompts are suppressed for failed/dead state and Mortal 7+ dead/manual state.", storyRef: "7.5", frRef: "FR14" },
  { id: "mortal-stabilized-check",      label: "Mortal reminder ignores stabilized status",                                                        status: "wired",    reason: "Recurring turn-start reminders and attack-time Death prompts are suppressed for stabilized actors.", storyRef: "7.5", frRef: "FR14" },
  { id: "mortal-over-6-death",          label: "Mortal 7+ auto-death not enforced",                                                                status: "partial",  reason: "Mortal 7+ suppresses new save prompts as dead/manual state; no persisted dead-state automation is added.", storyRef: "7.5", frRef: "FR14" },
  { id: "death-save-bound-to-attack",   label: "Death save reminders bound to attacks, not turns",                                                 status: "wired",    reason: "Recurring Death Save reminders are emitted from the combat turn hook on the active actor's turn.", storyRef: "7.5", frRef: "FR14" },
]);

export function getDeferredMechanic(id) {
  return DEFERRED_MECHANICS.find(m => m.id === id) || null;
}

export function getDeferredByStatus(status) {
  return DEFERRED_MECHANICS.filter(m => m.status === status);
}
