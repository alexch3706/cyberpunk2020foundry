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
System support for map objects, barriers, zones, and spatial combat context beyond selected actors and manual inputs. It can improve table play, but it is outside the Core Combat Loop for the Trusted MVP.
_Avoid_: Cover, combat automation, battle map support

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
