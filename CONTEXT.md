# Cyberpunk2020VTT

This context defines the product language for the Cyberpunk 2020 FoundryVTT system. It captures domain terms used to decide what belongs in the trusted play experience.

## Language

**Trusted MVP**:
A playable release slice where referees can run the main combat flow and trust the system's visible outcomes, state changes, and evidence. It prioritizes reliability and auditability of common play over broad coverage of rare or advanced rules.
_Avoid_: Complete rules automation, full corebook implementation, feature-complete combat

**Core Combat Loop**:
The repeated table flow of selecting an attacker, selecting one or more targets, resolving an attack, applying damage and state changes, and showing enough evidence for the referee to validate the result.
_Avoid_: Combat system, all combat rules, full combat automation

**Combat Evidence**:
The visible intermediate values and explanations that let a referee verify how an attack result, damage result, save prompt, or state update was produced.
_Avoid_: Debug output, logs, roll details

**Auditable Multi-Target Full Auto**:
A full-auto attack against more than one target where every target has enough visible attack, modifier, hit-count, damage, and state-change evidence for the referee to validate that target's result. It is part of the Core Combat Loop for the Trusted MVP.
_Avoid_: Spray UI, full-auto polish, automatic fire extras

**Tactical Environment Automation**:
System support for map objects, barriers, zones, and spatial combat context beyond selected actors and manual inputs. It is part of the post-MVP scope, specifically handling AoE templates, automated line-of-effect raycasting, and cover detection to streamline complex calculations like suppressive fire or shotgun cones.
_Avoid_: XCOM-style 3D bullet tracking, fully automated cover degradation without GM oversight.

**Transient Cover Ablation**:
A cover state that degrades automatically during a multi-hit attack (like full auto or shotgun blasts) after being initially provided by the GM, without requiring the GM to re-enter the SP for every single bullet. The final state of the cover is applied to the character's context but not persisted to the VTT canvas as a permanent object.
_Avoid_: Tracking structural damage points (SDP) of background canvas objects permanently across sessions.

**Interactive Template Trigger**:
An automated map event where moving a token into a hazardous zone (like a suppressive fire MeasuredTemplate) pauses the token's movement and prompts the user to confirm the trigger or dismiss it (e.g., for accidental token drags) before resolving the combat mechanics.
_Avoid_: Unforgiving instant-damage traps that trigger purely on cursor slips.

**Dynamic Damage Drop-off**:
Automated calculation where a weapon's damage or area of effect changes based on the exact distance to each target within an attack template, specifically implementing shotgun spread rules.
_Avoid_: Requiring the GM to manually calculate range brackets and adjust dice pools for every individual target caught in an AoE.

**Partial Cover Resolution**:
A workflow where the GM uses a visual dialog to define which specific hit locations (e.g., Head, Torso, Arms, Legs) are protected by an intervening cover object. The combat resolver then bypasses the cover's SP entirely if the randomized hit location strikes an exposed area. Automated cover evidence considers only the first relevant obstruction; layered or multiple cover objects are referee judgement.
_Avoid_: Automating 3D volumetric occlusion (guessing height and cover protection purely from 2D canvas vectors).

**Single-Target Raycast Bounds**:
Line-of-effect calculations for targeted attacks stop at the first valid token struck. Overpenetration (blowthrough) into subsequent tokens is handled narratively by the GM or via explicit multi-target attack declarations.
_Avoid_: Automated kinetic chain-reactions through multiple living tokens.

**Shared Physical Table**:
A play format where the group is sitting together offline, players may roll physical dice, and the referee controls Foundry as the shared visible table surface. The system should support this format without requiring every player to operate Foundry directly.
_Avoid_: Local play, hot-seat mode, remote VTT play

**Table-Entered Attack Die**:
A referee-entered natural d10 result for an attack roll, supplied after a player rolls a physical die. The system still calculates the rest of the attack total, modifiers, damage flow, state changes, and Combat Evidence.
_Avoid_: Manual attack resolution, override total, custom roll

**Attack Die Entry Prompt**:
A table-level attack flow where the referee chooses whether the current attack uses an automatic system d10 roll or a Table-Entered Attack Die. It supports mixed referee/NPC automation and player physical dice at the same Shared Physical Table.
_Avoid_: Manual mode, roll override, player client input

**Single Explosion Attack Die**:
A Cyberpunk 2020 attack die result where a natural 10 permits exactly one additional d10 result to be added. A second 10 in that additional result does not continue exploding.
_Avoid_: Open-ended exploding die, recursive crit, exploding chain

**Attack Luck Spend**:
Luck points declared before an attack roll and added to that attack's total. In the Trusted MVP, Luck is referee-managed at the table rather than tracked as a separate system resource.
_Avoid_: After-roll bonus, reroll, automatic Luck pool

**Target**:
A token explicitly clicked or selected by the user to be the direct recipient of an attack (e.g., a single-shot pistol attack).
_Avoid_: Using "Target" to describe the map area or the tokens accidentally caught in an area of effect.

**Hazard Zone**:
A spatial area on the canvas (like a MeasuredTemplate or Raycast line) that represents an area of effect attack such as a shotgun blast, suppressive fire, or an explosion. The zone itself is not a target. Hazard Zone evidence belongs only to tokens actually caught inside the zone or explicitly confirmed by the referee as affected by it. Whether the zone is transient or persistent is lifecycle evidence on the Hazard Zone, not a separate glossary concept.
_Avoid_: Treating the map template itself as a combat target.

**Affected Token**:
A token that is caught inside a Hazard Zone and must resolve damage or saving throws, despite not being explicitly selected as a Target by the attacker. A token awaiting referee confirmation is not yet an Affected Token for automated state changes; if the same token is explicitly selected as a Target and also caught inside a Hazard Zone, it remains a Target with Hazard Zone evidence rather than becoming a separate Affected Token.
_Avoid_: Calling these "Targets", which confuses explicit selection with area intersection.

**Zone-Only Attack**:
An attack flow where the referee places or confirms a Hazard Zone without explicitly selecting a Target first. Confirmed tokens caught inside the zone are Affected Tokens, and the Hazard Zone itself is not a Target. If no tokens are confirmed inside the zone, the attack still resolves as a zone placement with no automated target state changes rather than as a missing-target error. Suppressive fire uses this language for its fire corridor while keeping suppressive-fire-specific save, ammo, hit cap, overlap, and duration mechanics.
_Avoid_: Primary target, template target, targetless attack.

**Attack Resolution**:
The complete life-cycle of a combat action, from the initiation of the attack (e.g. attack roll) through hit locations, armor ablation, damage application, and state changes.
_Avoid_: "Combat Resolution" (too broad, implies resolving the whole fight), "Attack Roll" (only refers to the dice throw).

**Stopping Power (SP)**:
The armor value on a specific hit location or cover object that reduces incoming damage before it reaches the target.
_Avoid_: Armor rating, defense value.

**Armor Piercing (AP)**:
A weapon or ammunition trait that modifies how armor mitigates its damage, typically by halving the effective SP.
_Avoid_: Penetration (when referring to the weapon trait), AP damage.

**Penetrating Damage**:
The final damage amount that successfully bypasses SP (and any AP modifiers) to affect the target's Wounds or SDP.
_Avoid_: Raw damage, total damage, penetration armor.

**Armor Ablation**:
The permanent reduction of SP on a target's armor or body part as a result of taking damage.
_Avoid_: Armor degradation, SP damage (use Ablation).

**Wound State**:
The health state of a biological character on the Wound Track (e.g., Light, Serious, Mortal) which applies stat penalties and triggers saving throws.
_Avoid_: Health points, HP, SDP (when referring to biological bodies).

**SDP (Structural Damage Points)**:
The structural integrity of non-biological entities (cover, vehicles) or cybernetic body parts (FBC limbs). Damage to SDP does not directly progress the Wound Track unless specified.
_Avoid_: Wounds, HP, structural HP.

**Destroyed Part**:
The state of an FBC hit location, cover object, or vehicle part when its SDP reaches zero or below, rendering it inoperable or destroyed.
_Avoid_: Dismemberment (which applies to meat), disabled (use Destroyed for clarity on 0 SDP).

**Dismemberment**:
The loss of a biological limb due to receiving more than 8 points of Penetrating Damage to a specific limb in a single attack.
_Avoid_: Destroyed (which applies to SDP/cybernetics).
