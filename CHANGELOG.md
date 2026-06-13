# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-06-13

This milestone release marks the culmination of 8 major development epics. The system has been fundamentally rebuilt from the ground up to have a strict, rule-accurate, stateless combat resolver that completely overhauls how combat is played, validated, and recorded in Foundry VTT.

### Changed
- **Total Combat Architecture Rewrite:** Weapon attacks now delegate to a new pure JS `CombatOutcome` resolver rather than mutating actor data immediately. All state changes are now previewed in a confirm dialog before commit.
- **Foundry V12/V13 Compatibility:** Refactored core system components and asynchronous `Roll.evaluate` flows to ensure verified support for Foundry V12 and forward compatibility up to V13.
- **Compendium Architecture:** Migrated all compendiums to LevelDB format for improved performance and stability.

### Added
- **Ranged Combat Overhaul:**
  - Automated three-round bursts, suppressive fire zones, and full-auto mechanics against single and multiple targets.
  - Implemented automatic fire fumbles, reliability drops, and jams.
  - Aimed multi-hit locations are now fully persisted in the combat pipeline.
  - Implemented point-blank maximum ranged damage drop-off rules.
- **Melee & Martial Arts Overhaul:**
  - Full support for Opposed Melee and Martial Arts rolls (Attacker vs Defender).
  - Melee/Unarmed now correctly applies Body Type damage modifiers.
  - 12 Martial Arts styles added as inspectable data, with support for all core actions (Strike, Kick, Block, Dodge, Disarm, Throw, Hold, Escape, Choke, Sweep, Grapple).
- **Damage & Armor Pipeline:**
  - Full support for Armor Piercing (AP) and Staged Penetration.
  - Automated calculation of Effective SP using layered armor rules.
  - Body Type Modifier (BTM) minimum damage limits enforced correctly.
  - Wound state transitions, Head-hit double damage, and Limb-loss mechanics fully integrated.
  - Automated Stun/Shock and Death save prompts.
- **UI Enhancements:**
  - **V2 Three-Pane UI Overhaul:** Introduced a modernized, persistent three-pane layout for actor sheets and the combat tab.
  - Added equipped armor repair controls and sheet overrides directly to the UI.
  - Manual attack die entry prompts added for groups playing around a shared physical table.

### Fixed
- Fixed weapon firing events within the new Combat Tab UI.
- Fixed sequential cover ablation logic and skinweave/subdermal ablation behavior.
- Fixed death save reminders triggering on dead or stabilized targets.
- Preserved full-auto damage evidence and hit modifiers in chat cards across multiple targets.
- Resolved multiple actor and item sheet registration issues across Foundry V11 and V12.

---
*For older changes prior to the `1.0.0` milestone, see the git commit history.*
