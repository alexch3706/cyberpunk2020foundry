# Combat Mechanics Audit: Corebook vs Foundry VTT

This document serves as an audit of the current `module/combat/` implementation compared to the original Cyberpunk 2020 Corebook (Friday Night Firefight) rules.

## 1. Implemented Mechanics (Corebook Adherence)
The system currently implements a robust set of the Corebook mechanics within the standalone, Foundry-agnostic JavaScript modules (`attack-resolver.js`, `armor-resolver.js`, `damage-resolver.js`, `save-resolver.js`, `state-planner.js`).

**Ranged Combat:**
- **Single Shots:** Fully supported, including modifiers and hit locations.
- **Suppressive Fire:** Implemented, resolving saves against the generated DC for targets in the zone.
- **Fumbles & Jams:** Properly calculated based on reliability ratings.
- **Ammo Consumption:** Accurately tracked and normalized via the `combat-commit` phase.

**Melee & Hand-to-Hand:**
- **Melee Attacks:** Fully supported, resolving opposed rolls.
- **Martial Arts & Brawling:** Implemented with mapped `MARTIAL_STYLES` and `MARTIAL_ACTIONS`.
- **Grappling:** Prerequisites and mechanics are correctly checked before execution.

**Damage & Armor (SP / BTM):**
- **Hit Locations:** Target locations are rolled or manually aimed, tracking limb sever thresholds (double damage for head hits).
- **Body Type Modifier (BTM):** Fully integrated into damage calculation.
- **Armor Calculation:** Staged penetration is implemented. Armor piercing (AP) rounds correctly reduce SP and modify penetrating damage.
- **Proportional Layering:** Implemented proportional layering for multiple equipped armors, following corebook subtraction math.

**Saves & Wound States:**
- **Stun/Shock Saves:** Properly triggered based on incoming damage and current wound state.
- **Death Saves:** Triggered upon entering mortal states, dynamically calculating penalties.
- **Wound Track Transition:** Smooth transition through Light, Critical, Mortal states.

## 2. Simplifications & Architecture Adjustments
To integrate seamlessly with a Virtual Tabletop environment, several rules have been simplified or adapted:

- **State Planner Architecture:** Instead of directly modifying character sheets, all attack results are collected into a `CombatOutcome` object, then run through a `state-planner` to create a Preview/Confirm dialog. This ensures a "single source of truth" and allows the GM/Player to intervene.
- **Cover as Standard Armor:** Currently, cover is mathematically treated as a proportional standard armor layer rather than resolving sequentially before personal armor (noted as deferred in FR10).
- **Death Saves Bound to Attacks:** Rather than keeping track of time/turns (which is complex in a VTT), Death Save reminders are triggered organically by attack events.

## 3. Missing Mechanics & Gaps (Deferred)
According to the `deferred-mechanics.js` registry and codebase scans, the following mechanics are missing, deferred, or partially implemented:

**Weapons & Exotic Attacks:**
- **Exotic Attacks:** Lasers, shotguns (pellet counts, cones, spreads), grenades, gas, explosives, and flamethrowers are not automated. They fall back to `manual` resolution.
- **Autoshotguns:** Basic full-auto path works, but shotgun-specific rules are not applied.

**Armor & Cover:**
- **Cover Modifiers:** The armor resolver supports cover SP, but the Modifiers Dialog does not currently collect manual cover SP input.
- **Ablation Routing:** When cover is bypassed, ablation updates target personal armor instead of the cover itself.
- **Subdermal/Skinweave Ablation:** Cyberware items with inherent stopping power are currently skipped during staged ablation.

**Combat Tracking & Flow:**
- **Initiative Automation:** Rolling initiative does not automatically add the token to the Foundry encounter combat tracker.

**Health & Status Tracking:**
- **Key Techniques (Martial Arts):** Bonus is incorrectly applied even when the martial art skill level is 0.
- **Death Save Logic:** 
  - Save prompts are generated for already-dead targets.
  - Recurring death save reminders are created even when the target is stabilized.
  - Targets taking Mortal 7+ damage should automatically be deceased, but saves are still generated.
- **Hardcoded Limbs:** The system's limb location keys do not currently include hands or feet for specific crushing/severing warnings.

## Conclusion
The current Combat Resolver accurately models the majority of essential Friday Night Firefight mechanics (single target/burst attacks, basic armor layering, BTM, wounds). Future development should prioritize the deferred mechanics—particularly the precise handling of Death Saves and Shotgun/Area of Effect rules—to achieve complete Corebook fidelity.
