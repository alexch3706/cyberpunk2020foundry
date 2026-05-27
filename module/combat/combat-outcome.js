/**
 * Contract definitions for the combat resolver boundary.
 *
 * This module intentionally contains plain data contracts only. Resolver modules
 * may import these constants and typedefs, but this file must not import Foundry
 * document classes, create chat messages, or persist actor/item updates.
 */

export const COMBAT_CHAT_STATUS = Object.freeze({
  preview: "preview",
  committed: "committed",
  canceled: "canceled",
  manual: "manual"
});

export const COMBAT_WARNING_SEVERITY = Object.freeze({
  info: "info",
  warning: "warning",
  error: "error"
});

export const MANUAL_RESOLUTION_REASON = Object.freeze({
  missingTargetActor: "missing-target-actor",
  unsupportedAction: "unsupported-action",
  missingRuleData: "missing-rule-data",
  pendingUserDecision: "pending-user-decision"
});

/**
 * @typedef {Object} CombatActionContext
 * @property {string} type Combat action family, such as "ranged", "melee", or "martial".
 * @property {string=} fireMode Ranged fire mode when applicable.
 * @property {string=} meleeAction Melee or martial action when applicable.
 * @property {string=} range Range bracket or range option selected for the action.
 * @property {string=} targetArea Aimed hit location request, when supplied.
 * @property {Object<string, *>} [options] Action-specific options from dialogs or adapters.
 * @property {Object<string, *>} [modifiers] Named modifier evidence used by the resolver.
 * @property {string=} source Entry point or adapter that created the context.
 */

/**
 * @typedef {Object} CombatActorRef
 * @property {string=} actorUuid Stable Foundry actor UUID, when an actor is available.
 * @property {string=} tokenUuid Stable Foundry token UUID, when a token initiated or received the action.
 * @property {string} name Display name used for chat evidence and warnings.
 */

/**
 * @typedef {Object} ActorCombatSnapshot
 * @property {Object<string, *>} [stats] Actor stat data required by the resolver.
 * @property {Object<string, *>} [skills] Actor skill data required by the resolver.
 * @property {number=} damage Current wound-box damage or equivalent damage state.
 * @property {Object<string, *>} [hitLocations] Target-specific hit-location model.
 * @property {Array<Object<string, *>>} [equippedArmor] Equipped armor snapshots.
 * @property {Array<Object<string, *>>} [equippedCyberware] Equipped cyberware snapshots.
 */

/**
 * @typedef {Object} WeaponCombatSnapshot
 * @property {string=} damage Damage formula or already-normalized damage expression.
 * @property {boolean=} ap Whether the attack uses armor-piercing behavior.
 * @property {number=} shotsLeft Current ammunition count before the action.
 * @property {number=} rof Rate of fire for automatic modes.
 * @property {string=} reliability Weapon reliability category.
 * @property {number=} range Weapon range value.
 * @property {number=} accuracy Weapon accuracy modifier.
 * @property {string=} attackType Weapon attack type from item data.
 * @property {string=} attackSkill Skill name or key used for the attack roll.
 */

/**
 * @typedef {Object} CombatWeaponRef
 * @property {string=} itemUuid Stable Foundry item UUID for the attacking weapon.
 * @property {string} name Weapon display name.
 * @property {WeaponCombatSnapshot} snapshot Plain weapon data captured before resolution.
 */

/**
 * @typedef {Object} CombatTargetRef
 * @property {string=} tokenUuid Stable Foundry token UUID for the target.
 * @property {string=} actorUuid Stable Foundry actor UUID for the target.
 * @property {string} name Target display name.
 * @property {ActorCombatSnapshot=} snapshot Plain target data captured before resolution.
 */

/**
 * @typedef {Object} RollDieMetadata
 * @property {number=} faces Die faces, such as 10 for Cyberpunk d10 rolls.
 * @property {number=} natural First natural result before modifiers, when available.
 * @property {Array<number>=} results All natural die results when exploding or multi-die rolls are inspected.
 * @property {boolean=} exploded Whether any die exploded.
 */

/**
 * @typedef {Object} RollMetadata
 * @property {string=} formula Roll formula used to produce the result.
 * @property {Array<string|number>=} terms Formula terms or named modifier terms.
 * @property {number=} total Final roll total after modifiers.
 * @property {RollDieMetadata=} die Natural die evidence for critical/fumble checks.
 * @property {boolean=} isCritical Whether the roll triggered critical behavior.
 * @property {boolean=} isFumble Whether the roll triggered fumble behavior.
 * @property {boolean=} isJam Whether reliability or fumble handling produced a jam.
 * @property {string=} seed Deterministic fixture seed or roll id, when supplied by tests.
 */

/**
 * @typedef {Object} CombatWarning
 * @property {string} code Stable machine-readable warning code.
 * @property {"info"|"warning"|"error"} severity Warning severity.
 * @property {string=} message Human-readable fallback message.
 * @property {string=} localizationKey Optional localization key for later UI/chat rendering.
 * @property {string=} source Artifact, audit, or rules reference that explains the warning.
 */

/**
 * @typedef {Object} ManualResolution
 * @property {boolean} required Whether automation must stop and hand the result to the referee.
 * @property {string=} reason Stable reason code, preferably from MANUAL_RESOLUTION_REASON.
 * @property {string=} message Human-readable fallback explanation.
 * @property {Array<string>=} blockedUpdateCategories State categories that must not be committed automatically.
 */

/**
 * @typedef {Object} CombatAttackOutcome
 * @property {RollMetadata=} roll Attack roll metadata.
 * @property {number=} targetNumber Fixed range DC or target number, when applicable.
 * @property {RollMetadata=} opposedRoll Defender roll metadata for opposed actions.
 * @property {boolean} hit Whether the attack hit this target.
 * @property {number=} margin Success or failure margin.
 * @property {Array<CombatWarning>=} warnings Attack-specific warnings.
 */

/**
 * @typedef {Object} CombatHitRecord
 * @property {string=} location Hit location label or key.
 * @property {RollMetadata=} locationRoll Hit-location roll evidence.
 * @property {RollMetadata=} damageRoll Raw damage roll evidence.
 * @property {number=} rawDamage Raw damage before mitigation.
 * @property {number=} effectiveStoppingPower Armor SP used at this hit location.
 * @property {boolean=} armorPiercing Whether AP behavior applied to this hit.
 * @property {number=} armorMitigation Damage removed by armor.
 * @property {number=} penetratingDamage Damage after armor and AP penetrating-damage behavior, before BTM.
 * @property {Object<string, *>=} armorPiercingEvidence AP armor and penetrating-damage evidence.
 * @property {Object<string, *>=} armor Armor resolver evidence including layers and warnings.
 * @property {Object<string, *>=} stagedPenetration Staged penetration evidence and planned ablation outcome.
 * @property {number=} bodyTypeMitigation Damage removed by BTM.
 * @property {number=} finalDamage Damage planned for application after all mitigation.
 * @property {Object<string, *>=} woundTransition Previous and next wound state evidence.
 * @property {Array<CombatWarning>=} warnings Hit-specific warnings.
 */

/**
 * @typedef {Object} CombatSavePrompt
 * @property {string} type Save type, such as "stun" or "death".
 * @property {number=} targetNumber Save target number or threshold.
 * @property {RollMetadata=} roll Save roll metadata when the save is rolled immediately.
 * @property {"pending"|"passed"|"failed"} status Save status.
 * @property {string=} reason Why the save is required.
 */

/**
 * @typedef {Object} ActorUpdatePlan
 * @property {string} actorUuid Actor UUID to update during commit.
 * @property {Object<string, *>} update Foundry update payload, keyed by document paths.
 */

/**
 * @typedef {Object} ItemUpdatePlan
 * @property {string} itemUuid Item UUID to update during commit.
 * @property {Object<string, *>} update Foundry update payload, keyed by document paths.
 */

/**
 * @typedef {Object} EmbeddedItemUpdatePlan
 * @property {string} actorUuid Owner actor UUID.
 * @property {string} type Embedded document type, expected to be "Item" for armor/cyberware updates.
 * @property {Array<Object<string, *>>} updates Embedded document update payloads.
 */

/**
 * Planned state changes produced before any Foundry document is mutated.
 * Commit code in later stories should apply these operations with awaited Foundry APIs
 * in this order: attacker item ammo, target armor, target damage/wounds, save state,
 * then chat create/update.
 *
 * @typedef {Object} PlannedCombatUpdates
 * @property {Array<ActorUpdatePlan>} [actorUpdates]
 * @property {Array<ItemUpdatePlan>} [itemUpdates]
 * @property {Array<EmbeddedItemUpdatePlan>} [embeddedItemUpdates]
 * @property {"preview"|"committed"|"canceled"|"manual"} chatStatus
 */

/**
 * @typedef {Object} CombatTargetOutcome
 * @property {CombatTargetRef} target Target reference and optional snapshot.
 * @property {CombatAttackOutcome=} attack Attack or opposed-action result for this target.
 * @property {Array<CombatHitRecord>} [hits] One record per resolved hit.
 * @property {Object<string, *>=} damage Aggregated target-level damage evidence.
 * @property {Array<CombatSavePrompt>} [saves] Save prompts or save results caused by the action.
 * @property {PlannedCombatUpdates=} plannedUpdates Target-specific planned updates.
 * @property {ManualResolution=} manualResolution Target-specific manual-resolution state.
 * @property {Array<CombatWarning>} [warnings] Target-specific warnings.
 */

/**
 * Complete resolver result for one combat action.
 *
 * Example shape:
 * {
 *   action: { type: "ranged", fireMode: "semiAuto", range: "medium" },
 *   attacker: { actorUuid: "Actor.abc", tokenUuid: "Scene.s.Token.t", name: "Solo" },
 *   weapon: { itemUuid: "Actor.abc.Item.weapon", name: "Heavy Pistol", snapshot: {} },
 *   targets: [{ target: { actorUuid: "Actor.def", tokenUuid: "Scene.s.Token.u", name: "Guard" } }],
 *   ammo: { before: 8, delta: -1, after: 7 },
 *   pendingDecisions: [],
 *   manualResolution: { required: false },
 *   chat: { status: "preview" }
 * }
 *
 * @typedef {Object} CombatOutcome
 * @property {CombatActionContext} action Action context selected by the user or adapter.
 * @property {CombatActorRef & {snapshot?: ActorCombatSnapshot}} attacker Attacker reference and optional snapshot.
 * @property {CombatWeaponRef} weapon Weapon reference and snapshot.
 * @property {Array<CombatTargetOutcome>} targets Per-target outcomes.
 * @property {Object<string, *>=} ammo Action-level ammunition evidence and delta.
 * @property {Array<Object<string, *>>} [pendingDecisions] Referee choices required before commit.
 * @property {ManualResolution=} manualResolution Action-level manual-resolution state.
 * @property {Object<string, *>=} chat Structured chat evidence derived from the outcome.
 * @property {Array<CombatWarning>} [warnings] Action-level warnings.
 */
