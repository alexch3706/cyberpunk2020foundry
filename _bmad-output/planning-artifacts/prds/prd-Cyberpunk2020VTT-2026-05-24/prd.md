---
title: Cyberpunk2020VTT Core Combat Fidelity MVP
status: ready-for-epics
created: 2026-05-24
updated: 2026-05-24
---

# PRD: Cyberpunk2020VTT Core Combat Fidelity MVP

## 0. Document Purpose

This PRD defines a brownfield MVP for making Cyberpunk2020VTT mechanically consistent with the Cyberpunk 2020 core rules where combat correctness matters most. It is for the project owner, downstream architecture work, and implementation planning. It builds on the brownfield documentation in `docs/` and the static conformance audit in `_bmad-output/implementation-artifacts/investigations/corebook-mechanical-faithfulness-audit.md`; it does not repeat every code finding from those artifacts.

## 1. Vision

Cyberpunk2020VTT should let a FoundryVTT table resolve Cyberpunk 2020 core combat with confidence. When a player fires, bursts, sprays, strikes, grapples, or takes damage, the system should apply the same mechanical sequence the corebook expects: attack roll, hit determination, hit location, armor, armor piercing behavior, body type modifier, wounds, saves, and state updates.

The goal is not to modernize the entire Foundry package or redesign every sheet. The MVP exists to establish a trustworthy rules engine inside the existing Foundry system. Once that spine exists, UI improvements, pack cleanup, and expanded optional rules can happen without re-litigating core combat semantics.

The user value is practical: a referee can adjudicate combat faster while preserving Cyberpunk 2020's lethality and edge cases. The system should reduce manual arithmetic and hidden drift, not replace referee judgment where the corebook expects it.

## 2. Target User

### 2.1 Primary Persona

The primary user is a Cyberpunk 2020 referee running a FoundryVTT game. They know the corebook, care about mechanical fidelity, and need the VTT to support combat without silently simplifying critical outcomes.

### 2.2 Jobs To Be Done

- Resolve CP2020 combat outcomes without manually reconstructing every rule interaction.
- Trust that armor, AP, BTM, wounds, saves, and ammo are applied consistently.
- See enough evidence in chat/output to audit what happened at the table.
- Keep the existing Foundry system usable while correctness work proceeds incrementally.
- Separate corebook-faithful behavior from non-core data or optional simplifications.

### 2.3 Non-Users for MVP

- Players looking for Cyberpunk RED mechanics.
- Tables using heavily house-ruled combat as the default behavior.
- Users expecting a full Foundry v12/ApplicationV2 modernization as part of this MVP.
- Users expecting all non-core sourcebook weapons and gear to be validated in the first pass.

### 2.4 Key User Journeys

- **UJ-1. Referee resolves a firearm hit into target damage.** A character attacks a selected target with a ranged weapon. The system rolls the attack, determines whether it hits, resolves location, applies armor and BTM, updates or presents target damage, and shows a chat record that explains the result.
- **UJ-2. Referee resolves automatic fire.** A character selects burst, full auto, or suppressive fire. The system applies the correct mode rules, consumes ammunition correctly, resolves target saves or hit counts, and shows per-target outcomes.
- **UJ-3. Referee resolves melee or martial combat.** A character makes a melee or martial action against a target. The system handles opposed rolls, action-specific prerequisites or effects, and damage where applicable.
- **UJ-4. Referee audits whether content is corebook-consistent.** The referee can distinguish corebook-conformant mechanics/data from unsupported, non-core, or intentionally deferred behavior.

## 3. Glossary

- **Corebook Fidelity Mode** — The behavior mode in which Cyberpunk2020VTT resolves mechanics according to the Cyberpunk 2020 core rules unless an explicitly documented setting says otherwise.
- **Mechanics Resolver** — The internal behavior layer that receives actor, item, target, roll, and option data and returns a structured combat outcome.
- **Combat Outcome** — The complete result of a combat action: attack result, hit locations, damage before and after mitigation, armor effects, wound changes, save requirements, ammo changes, and chat evidence.
- **Target Actor** — The Foundry actor that receives attack, damage, wound, save, or state effects.
- **Attack Actor** — The Foundry actor initiating a combat action.
- **Hit Location** — The body area affected by an attack, either randomly rolled or selected through aimed-location rules.
- **Armor Layer** — A worn armor source covering a Hit Location.
- **Effective SP** — The stopping power used for a specific incoming hit after layer, cover, AP, and optional staged-penetration rules are applied.
- **BTM** — Body Type Modifier, the damage reduction derived from Body Type after armor is resolved.
- **Wound State** — The actor's health state derived from accumulated damage boxes: Light, Serious, Critical, Mortal, and Mortal levels.
- **Save Prompt** — A required Stun/Shock or Death Save caused by damage or mortal wound state.
- **Core Pack Data** — Compendium or item data that is verified against the Cyberpunk 2020 corebook.
- **Extended Pack Data** — Compendium or item data sourced from non-core books, websites, imports, or unknown origins.

## 4. Features

### 4.1 Combat Resolution Spine

**Description:** The system must resolve combat as a structured sequence instead of independent chat rolls. This feature realizes UJ-1, UJ-2, and UJ-3.

#### FR-1: Structured Combat Outcome

The system must produce a structured Combat Outcome for supported combat actions.

**Consequences:**
- Combat Outcome includes attack total, target difficulty or opposed result, hit/miss state, Hit Location, raw damage, mitigation, final damage, ammo delta, and follow-up saves where applicable.
- Combat Outcome can be rendered to chat without losing the underlying structured values.
- Combat Outcome can be tested without opening a Foundry sheet.

#### FR-2: Target Actor Context

The system must resolve combat against Target Actors, not only target token names or IDs.

**Consequences:**
- Hit Location lookup can use the target's own location schema.
- Armor, BTM, Wound State, and save thresholds come from the Target Actor.
- If no Target Actor is available, the system must clearly mark the outcome as manual-resolution only.

#### FR-3: Controlled State Commit

The system must commit ammo, damage, wound, armor, and cyberware state changes through Foundry document update APIs.

**Consequences:**
- State-changing updates are awaited when later mechanics depend on them.
- Chat output and persisted actor/item state cannot silently diverge.
- Damage application to a Target Actor uses a preview/confirm step in the first release.
- Direct mutation is allowed only for derived transient data in preparation flows.

### 4.2 Ranged Combat Fidelity

**Description:** Ranged weapon attacks must match corebook hit numbers, attack modifiers, critical/fumble behavior, fire modes, ammo usage, and damage handoff. This feature realizes UJ-1 and UJ-2.

#### FR-4: Ranged Attack Roll

The system must resolve ranged attacks using REF, relevant weapon skill, 1d10 critical behavior, range difficulty, weapon accuracy, and applicable modifiers.

**Consequences:**
- Point blank, close, medium, long, and extreme hit numbers match the corebook.
- Aimed location, aiming rounds, ambush, blinded, dual wielding, fast draw, hipfire, ricochet, running, and turning modifiers remain represented.
- Natural 10 critical behavior and natural 1 fumble behavior are observable in the Combat Outcome.

#### FR-5: Reliability and Jam Handling

The system must apply reliability/jam behavior for automatic weapons when fumble conditions require it.

**Consequences:**
- Weapon reliability affects jam outcome.
- Jam state or required unjam information is surfaced to the referee.
- Non-automatic fumbles remain distinguishable from automatic weapon jams.

#### FR-6: Three-Round Burst

The system must resolve three-round burst according to corebook burst rules.

**Consequences:**
- Burst uses one action.
- Burst applies the correct close/medium attack advantage.
- Burst resolves the correct number of hit rounds on success.
- Ammo consumption is exactly three or the remaining available rounds, whichever is lower.

#### FR-7: Full Auto

The system must resolve full auto against one or more targets according to corebook full-auto rules.

**Consequences:**
- ROF is divided by target count and rounded down for multi-target fire.
- Attack modifiers are based on the rounds fired at the relevant range.
- Number of hits is capped by rounds fired and success margin.
- Ammo is decremented once using a correct total delta.
- Per-target range and target context are preserved where available.

#### FR-8: Suppressive Fire

The system must implement suppressive fire as a supported automatic weapon mode.

**Consequences:**
- Referee can enter or select fire-zone width and rounds fired.
- Target save difficulty is derived from rounds fired divided by zone width.
- Affected targets roll or are prompted for Athletics + REF + 1d10.
- Failed saves receive the correct random round count and Hit Locations.

### 4.3 Damage, Armor, and Wounds

**Description:** Damage must be resolved through corebook armor, AP, BTM, and wound rules. This feature realizes UJ-1 and UJ-2.

#### FR-9: Hit Location Resolution

The system must resolve random and aimed Hit Locations using the target's location model.

**Consequences:**
- Aimed locations apply the correct attack penalty before hit resolution.
- Random locations use target-specific hit-location lookup when available.
- Head and limb special cases are represented in the Combat Outcome.

#### FR-10: Armor Resolution

The system must calculate Effective SP for the incoming hit before BTM is applied.

**Consequences:**
- Armor SP subtracts from damage at the hit location.
- Layered armor uses proportional armor rules, not straight additive SP.
- Hard/soft layer constraints are enforced or clearly flagged as invalid in Corebook Fidelity Mode.
- Cover can be represented as a manually entered temporary armor source if included in the attack context.
- Scene/map object cover automation is not required for MVP.

#### FR-11: Armor Piercing and Staged Penetration

The system must support AP behavior and staged armor penetration for Corebook Fidelity Mode.

**Consequences:**
- AP halves applicable armor SP before mitigation.
- AP halves remaining penetrating damage according to corebook behavior.
- Staged penetration reduces armor SP only when the attack penetrates and only for the affected armor/location.
- Staged penetration updates are explicit and auditable.
- Staged penetration can be disabled through an explicit setting for compatibility or referee preference.

#### FR-12: BTM and Minimum Damage

The system must apply BTM after armor mitigation.

**Consequences:**
- BTM reduces penetrating damage according to Body Type.
- BTM cannot reduce penetrating damage below the corebook minimum.
- The Combat Outcome displays raw damage, armor mitigation, BTM mitigation, and final applied damage.

#### FR-13: Wound State and Special Damage Cases

The system must update or present Wound State outcomes after final damage is calculated.

**Consequences:**
- Damage advances wound boxes consistently.
- Serious, Critical, and Mortal penalties derive from Wound State.
- Head-hit and limb-loss special cases are surfaced.
- Mortal wound levels trigger Death Save requirements.

#### FR-14: Stun and Death Save Prompts

The system must identify required Stun/Shock and Death Saves after damage.

**Consequences:**
- Stun save threshold is calculated from Body Type and current Wound State.
- Death save threshold is calculated from Body Type and Mortal level.
- Failed or pending save results are visible in the Combat Outcome.
- Recurring Death Saves for untreated Mortal wounds are tracked or clearly prompted; lightweight tracking is acceptable for MVP.

### 4.4 Melee and Martial Arts Fidelity

**Description:** Melee and martial arts must resolve opposed rolls and action-specific effects rather than attacker-only chat output. This feature realizes UJ-3.

#### FR-15: Opposed Melee Roll

The system must resolve melee attacks as attacker REF + skill + 1d10 versus defender REF + applicable skill + 1d10.

**Consequences:**
- Defender skill choice can be selected or inferred from configured options.
- Success/failure is based on the opposed result.
- Damage is applied only when the opposed outcome permits it.

#### FR-16: Melee Damage Modifier

The system must apply Body Type damage modifiers to melee weapon and unarmed attacks where applicable.

**Consequences:**
- Strength damage bonus table matches the corebook.
- Known mismatch for Body Type 13-14 is corrected or explicitly tested before release.

#### FR-17: Martial Action Support

The system must support the core martial/brawling actions required for faithful play.

**Consequences:**
- Strike, kick, block/parry, dodge, disarm, throw, hold, escape, choke, sweep/trip, and grapple have distinct outcomes.
- Grapple prerequisites are enforced for throw, hold, and choke.
- Dodge and parry create the appropriate attack/action consequences.
- Martial arts skill adds damage where the corebook requires.

#### FR-18: Martial Style Key Techniques

The system must represent martial arts style key technique bonuses.

**Consequences:**
- Key technique bonus is not hard-coded to zero.
- Style data is inspectable and testable.
- Brawling remains distinguishable from trained martial arts.
- All corebook martial arts styles and key techniques are represented by MVP completion.
- Style data modeling and table population can be separate implementation stories.

### 4.5 Corebook Conformance and Data Boundaries

**Description:** The project must distinguish corebook-conformant behavior/data from extended or unverified content. This feature realizes UJ-4.

#### FR-19: Corebook Conformance Labels

The system must provide a way to identify Core Pack Data versus Extended Pack Data.

**Consequences:**
- Corebook-conformant items can be audited separately from non-core items.
- Non-core source items can remain available without being mistaken for corebook evidence.
- Unknown or external-source items are flagged for later review.
- MVP must normalize source/core labels and provide core vs extended visibility or filtering.
- MVP does not require physically splitting existing packs into separate core and extended pack files.

#### FR-20: Rules Scope Visibility

The system must make unsupported or deferred mechanics visible to maintainers and referees.

**Consequences:**
- Exposed UI options must not silently do nothing.
- If a mechanic is deferred, it is hidden, disabled, or marked as manual.
- Known scope deviations are documented in release notes or project docs.

### 4.6 Regression Safety

**Description:** The MVP must create enough automated or fixture-based verification to support future refactor work.

#### FR-21: Core Mechanics Fixtures

The project must include fixture coverage for the core mechanical examples and table interactions in this MVP.

**Consequences:**
- Fixtures cover range DCs, armor, AP, BTM, wounds, saves, burst, full auto, suppressive fire, melee, martial actions, and humanity persistence.
- Fixture results can be reviewed without running a full Foundry world where possible.
- Live Foundry checks are documented for behavior that cannot be tested outside Foundry.

#### FR-22: State Update Discipline

The project must prevent known direct-mutation and un-awaited update regressions in mechanics paths.

**Consequences:**
- Mechanics paths use awaited Foundry updates for persisted state.
- Cyberware humanity roll persists through document update APIs.
- Migration behavior is not considered part of the combat MVP unless template changes require it, but any touched migration path must be await-safe.

## 5. Non-Goals

- Rewriting the Foundry system in TypeScript.
- Migrating to ApplicationV2/DataModel as part of this MVP.
- Replacing Handlebars sheets or adding React/Vue/Svelte.
- Validating every non-core sourcebook, website, or imported pack item in the first pass.
- Automating every environmental/map-dependent rule such as line of sight or cover geometry.
- Implementing Cyberpunk RED rules.
- Rebalancing Cyberpunk 2020 mechanics.

## 6. MVP Scope

### 6.1 In Scope

- Mechanics Resolver behavior for ranged combat, damage, armor, wounds, saves, melee, and martial actions.
- Target Actor-aware combat outcomes.
- Correct ammo and state updates for supported attacks.
- AP and armor layering behavior.
- Suppressive fire support.
- Critical/fumble/reliability handling for ranged attacks.
- Cyberware humanity roll persistence fix.
- Corebook conformance labeling and core-vs-extended visibility/filtering for pack data.
- Fast-draw initiative semantics.
- Test fixtures and documented live verification checks.

### 6.2 Out of Scope for MVP

- Full Foundry v12 modernization.
- Full compendium content rewrite.
- Netrunning mechanics.
- Vehicle combat beyond avoiding regressions in existing vehicle item behavior.
- Automation of party initiative.
- Scene/map object cover automation.
- Full UX redesign of actor/item sheets.

## 7. Cross-Cutting NFRs

- **Correctness:** Mechanics in Corebook Fidelity Mode must prefer explicit manual prompts over silent simplification when full automation is not available.
- **Auditability:** Chat output must show enough intermediate values for a referee to validate a result.
- **Maintainability:** Core mechanics should be testable without duplicating formulas across sheets and item methods.
- **Backward compatibility:** Existing actors/items should continue loading. Any template shape change must include migration strategy.
- **Foundry fit:** The solution must remain a FoundryVTT system package loaded through `system.json`; no standalone runtime is introduced for MVP.
- **Legal/content hygiene:** The project may cite local page references for internal development, but user-facing docs should avoid reproducing large copyrighted rule text.

## 8. Success Metrics

**Primary**

- **SM-1:** P0 audit closure — all P0 findings in the corebook mechanical faithfulness audit are either implemented, hidden from UI, or explicitly marked manual. Validates FR-1 through FR-18.
- **SM-2:** Fixture pass rate — all MVP core mechanics fixtures pass in the local verification suite or documented manual check. Validates FR-21.
- **SM-3:** State consistency — ammo, damage, humanity, armor ablation/staged penetration, and wound state do not diverge between chat output and persisted Foundry documents in supported flows. Validates FR-3 and FR-22.

**Secondary**

- **SM-4:** Referee auditability — a referee can inspect a Combat Outcome and identify attack total, mitigation, final damage, saves, and state changes without reading source code. Validates FR-1, FR-12, FR-14.
- **SM-5:** Scope clarity — unsupported combat modes are not exposed as functional controls. Validates FR-20.

**Counter-metrics**

- **SM-C1:** Do not optimize for broad modernization. A larger rewrite with no additional corebook fixture coverage is a negative outcome.
- **SM-C2:** Do not optimize for fewer prompts if that hides referee-required decisions.

## 9. Resolved Scope Decisions

1. Staged penetration is included in Corebook Fidelity Mode and is explicitly toggleable.
2. Damage application uses preview/confirm before updating Target Actor state in the first release.
3. Fast-draw initiative semantics are in MVP; party initiative automation is deferred.
4. Pack conformance uses source/core labels and core-vs-extended visibility/filtering; existing packs are not physically split in MVP.
5. Cover is manual input in MVP; scene/map object cover automation is deferred.
6. All corebook martial arts styles and key techniques are required by MVP completion; data modeling and table population can be separate stories.

## 10. Assumptions Index

- No unresolved assumptions remain from the initial scope questions. The document remains `draft` pending architecture feasibility review and story slicing.
