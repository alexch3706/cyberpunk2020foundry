---
stepsCompleted: [1, 2, 3, 4]
inputDocuments:
  - _bmad-output/planning-artifacts/prds/prd-Cyberpunk2020VTT-2026-05-24/prd.md
  - _bmad-output/planning-artifacts/prds/prd-Cyberpunk2020VTT-2026-05-24/addendum.md
  - _bmad-output/planning-artifacts/architecture.md
  - _bmad-output/implementation-artifacts/investigations/corebook-mechanical-faithfulness-audit.md
  - _bmad-output/project-context.md
---

# Cyberpunk2020VTT - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for Cyberpunk2020VTT, decomposing the requirements from the PRD, UX Design if it exists, and Architecture requirements into implementable stories.

## Requirements Inventory

### Functional Requirements

FR1: The system must produce a structured Combat Outcome for supported combat actions, including attack total, target difficulty or opposed result, hit/miss state, Hit Location, raw damage, mitigation, final damage, ammo delta, and follow-up saves where applicable.

FR2: The system must resolve combat against Target Actors, not only target token names or IDs, and must clearly mark outcomes as manual-resolution only when no Target Actor is available.

FR3: The system must commit ammo, damage, wound, armor, and cyberware state changes through Foundry document update APIs, with damage application using preview/confirm in the first release.

FR4: The system must resolve ranged attacks using REF, relevant weapon skill, 1d10 critical behavior, range difficulty, weapon accuracy, and applicable modifiers.

FR5: The system must apply reliability/jam behavior for automatic weapons when fumble conditions require it.

FR6: The system must resolve three-round burst according to corebook burst rules, including correct close/medium attack advantage, hit count, and ammo consumption.

FR7: The system must resolve full auto against one or more targets according to corebook full-auto rules, including target-count rounding, hit caps, ammo accounting, and per-target context.

FR8: The system must implement suppressive fire as a supported automatic weapon mode with fire-zone width, rounds fired, target Athletics + REF save handling, failed-save hit counts, and locations.

FR9: The system must resolve random and aimed Hit Locations using the target's location model.

FR10: The system must calculate Effective SP for the incoming hit before BTM is applied, including proportional layered armor, hard/soft constraints, and manual cover input.

FR11: The system must support AP behavior and staged armor penetration for Corebook Fidelity Mode, with auditable staged penetration updates and an explicit setting to disable staged penetration.

FR12: The system must apply BTM after armor mitigation, enforce the corebook minimum damage behavior, and display raw damage, armor mitigation, BTM mitigation, and final applied damage.

FR13: The system must update or present Wound State outcomes after final damage is calculated, including head-hit, limb-loss, Serious, Critical, and Mortal consequences.

FR14: The system must identify required Stun/Shock and Death Saves after damage, including threshold calculation, visible pending/failed save results, and lightweight recurring Mortal wound prompting if in scope.

FR15: The system must resolve melee attacks as attacker REF + skill + 1d10 versus defender REF + applicable skill + 1d10.

FR16: The system must apply Body Type damage modifiers to melee weapon and unarmed attacks where applicable, including correction or test coverage for the known Body Type 13-14 mismatch.

FR17: The system must support the core martial/brawling actions required for faithful play: strike, kick, block/parry, dodge, disarm, throw, hold, escape, choke, sweep/trip, and grapple.

FR18: The system must represent martial arts style key technique bonuses with inspectable/testable style data, while keeping Brawling distinct from trained martial arts.

FR19: The system must provide a way to identify Core Pack Data versus Extended Pack Data without requiring physical pack splitting in MVP.

FR20: The system must make unsupported or deferred mechanics visible to maintainers and referees; exposed UI options must not silently do nothing.

FR21: The project must include fixture coverage for core mechanical examples and table interactions, including range DCs, armor, AP, BTM, wounds, saves, burst, full auto, suppressive fire, melee, martial actions, and humanity persistence.

FR22: The project must prevent known direct-mutation and un-awaited update regressions in mechanics paths, including cyberware humanity roll persistence through document update APIs.

### NonFunctional Requirements

NFR1: Mechanics in Corebook Fidelity Mode must prefer explicit manual prompts over silent simplification when full automation is not available.

NFR2: Chat output must show enough intermediate values for a referee to validate a result.

NFR3: Core mechanics should be testable without duplicating formulas across sheets and item methods.

NFR4: Existing actors/items should continue loading, and any template shape change must include a migration strategy.

NFR5: The solution must remain a FoundryVTT system package loaded through `system.json`; no standalone runtime is introduced for MVP.

NFR6: Internal development artifacts may cite local page references, but user-facing docs should avoid reproducing large copyrighted rule text.

### Additional Requirements

- Add a new `module/combat/` resolver layer with `combat-resolver.js`, `attack-resolver.js`, `hit-location-resolver.js`, `armor-resolver.js`, `damage-resolver.js`, `save-resolver.js`, `state-planner.js`, `combat-outcome.js`, `combat-chat.js`, and `martial-arts-data.js`.
- Keep `CyberpunkItem` as the public weapon-roll entry point during migration, but make it delegate to resolver functions rather than owning combat rules directly.
- Use a structured `CombatOutcome` as the single source for chat evidence, preview UI, tests, and eventual commit.
- Split pure mechanics from Foundry adapters so mechanics modules can run without direct dependency on `game`, `ui`, `ChatMessage`, `Actor`, `Item`, or sheet classes.
- Change selected-target payloads from token name/id objects to UUID-rich token/actor references.
- Resolve target actors before combat resolution and mark outcomes as manual-resolution when actor context is unavailable.
- Implement preview/confirm damage application with a lightweight Foundry `Dialog` before persisted target damage updates.
- Use a first-class state planner that creates explicit actor, item, embedded item, and chat-status update plans before commit.
- Await Foundry update operations in deterministic order for ammo, armor/staged penetration, target damage, save tracking/prompts, and chat.
- Calculate armor at resolution time from equipped armor snapshots rather than relying on actor-prepared pre-summed SP values.
- Add Corebook Fidelity settings for `corebookFidelityMode`, `stagedPenetration`, and `combatDamageCommitMode`.
- Ensure suppressive fire is implemented before exposure in Corebook Fidelity Mode, or disabled/marked manual until implemented.
- Add fixture-first plain JavaScript mechanics tests that can run outside a live Foundry sheet/world where possible.
- Prefer actor/item snapshots over immediate `template.json` churn; add persisted fields only when mechanics require state that cannot be derived.
- If new persisted fields are added, review and update migration behavior for old-world compatibility.
- Add or derive corebook conformance labels for item data without physically splitting existing packs in MVP.
- Keep existing Foundry document classes, sheet classes, Handlebars templates, localization approach, and chat-card patterns unless a story explicitly changes them.
- Do not introduce TypeScript, bundlers, a new frontend framework, or a standalone runtime for this MVP.
- Do not include full Corebook markdown as a planning input; stories that touch rules fidelity should cite audit/corebook page references and paraphrase expected behavior rather than copying long rule text.
- Address known audit risk areas: item-centric combat coupling, actor armor pre-summing, selected targets lacking actor context, cyberware humanity direct mutation, async migration/update hazards, and underused `template.json` fields such as weapon `ap` and armor `ablation`.

### UX Design Requirements

No dedicated UX Design document was found for this MVP. UX work is limited to the interaction requirements already present in the PRD and Architecture:

UX-DR1: Provide a preview/confirm damage application dialog that displays per-target planned damage, armor changes, ammo change, wound transition, save prompts, and commit/cancel outcome.

UX-DR2: Render structured combat outcome chat cards that distinguish preview, committed, canceled, and manual-resolution states.

UX-DR3: Ensure unsupported or deferred mechanics are hidden, disabled, or clearly marked manual rather than appearing as functional no-op controls.

UX-DR4: Keep UI changes brownfield-compatible with existing Foundry ActorSheet/ItemSheet, Handlebars templates, localization keys, and jQuery-style listener patterns.

### FR Coverage Map

FR1: Epic 1 - Structured Combat Outcome foundation for auditable combat results.

FR2: Epic 2 - Target Actor context for selected targets and manual-resolution fallback.

FR3: Epic 1 and Epic 2 - State planner contract in Epic 1; preview/confirm state commit in Epic 2.

FR4: Epic 2 - Ranged attack roll support for the first end-to-end single-shot combat path.

FR5: Epic 4 - Reliability, fumble, and jam handling for automatic weapons.

FR6: Epic 4 - Three-round burst resolution and ammo use.

FR7: Epic 4 - Full-auto single-target and multi-target resolution.

FR8: Epic 4 - Suppressive fire resolution.

FR9: Epic 2 - Target-aware random and aimed hit location resolution.

FR10: Epic 3 - Effective SP, proportional layered armor, hard/soft validation, and cover input.

FR11: Epic 3 - AP and staged penetration behavior.

FR12: Epic 3 - BTM, minimum damage, and mitigation evidence.

FR13: Epic 3 - Wound state transitions and special damage cases.

FR14: Epic 3 - Stun/Shock and Death Save prompts.

FR15: Epic 5 - Opposed melee roll resolution.

FR16: Epic 5 - Melee and unarmed Body Type damage modifiers.

FR17: Epic 5 - Martial/brawling action support.

FR18: Epic 5 - Martial style key technique data.

FR19: Epic 6 - Corebook versus extended pack/data conformance labels.

FR20: Epic 6 - Unsupported/deferred mechanics visibility.

FR21: Epic 1 and Epic 6 - Fixture baseline in Epic 1; final fixture coverage and documented Foundry verification in Epic 6.

FR22: Epic 1 and Epic 6 - State discipline contract in Epic 1; direct-mutation and un-awaited update regression closure in Epic 6.

## Epic List

### Epic 1: Combat Resolver Foundation

Maintainers can introduce the combat resolver boundary without changing combat behavior: `CombatOutcome`, resolver input snapshots, `CyberpunkItem` adapter, state planner contract, outcome-derived chat contract, and deterministic fixture baseline.

**FRs covered:** FR1, FR3, FR21, FR22

**Implementation notes:** Contract first, parity second, rule improvement third. This epic creates the spine and safety rails: pure resolver modules, Foundry adapter boundary, planned update shape, deterministic dice/RNG support, minimal fixtures, and compatibility with existing `CyberpunkItem` entry points. It must avoid broad rules changes.

### Epic 2: End-to-End Single-Shot Firearm Resolution

Referees can resolve one firearm attack against a selected Target Actor from attack roll through target-aware hit location, ammo planning, preview/confirm state application, and readable chat evidence.

**FRs covered:** FR2, FR3, FR4, FR9

**Implementation notes:** Proves the resolver on a real Foundry user flow before deep rule expansion. Includes target UUID/actor normalization, single-shot hit/ammo/chat parity, manual-resolution fallback when actor context is missing, and minimal real damage application through preview/confirm.

### Epic 3: Faithful Damage, Armor, Wounds, and Saves

Referees can trust that incoming damage is mitigated and applied according to core combat rules for armor, AP, BTM, wound state, special damage cases, and save prompts.

**FRs covered:** FR10, FR11, FR12, FR13, FR14

**Implementation notes:** Builds on Epic 2's end-to-end single-shot flow. Starts with AP/ablation/armor data plumbing, then resolver armor interaction, state-planned staged penetration/ablation, wound transitions, and save prompts. Stories touching rules behavior should cite audit/corebook page references and paraphrase expected outcomes.

### Epic 4: Automatic Fire Resolution

Referees can resolve automatic weapon modes without manual reconstruction: three-round burst, full auto across one or more targets, suppressive fire, ammunition use, and reliability/jam consequences.

**FRs covered:** FR5, FR6, FR7, FR8

**Implementation notes:** Uses the same `CombatOutcome`, state planner, preview/confirm, and combat-chat pipeline from prior epics. Migrates current burst/full-auto paths from `CyberpunkItem` into resolver-backed outcomes and either fully implements suppressive fire or prevents it from appearing as a functional no-op until complete.

### Epic 5: Opposed Melee and Martial Arts

Referees can resolve melee and martial actions as opposed combat rather than attacker-only chat rolls, including Body Type damage modifiers, martial actions, prerequisites, and key technique bonuses.

**FRs covered:** FR15, FR16, FR17, FR18

**Implementation notes:** Adds melee baseline first, then inspectable martial arts data, then opposed martial rules. Grapple-family actions should surface explicit prerequisites or pending decisions where full state automation is not yet available.

### Epic 6: Compatibility, Conformance, and Regression Closure

Referees and maintainers can tell which mechanics and items are corebook-conformant, extended, unknown, implemented, deferred, or manual, while maintainers can close remaining regression, compatibility, and state-discipline risks before MVP release.

**FRs covered:** FR19, FR20, FR21, FR22

**Implementation notes:** This is not a late quality bucket. Fixture and state discipline are cross-cutting requirements throughout Epics 1-5. This epic closes remaining gaps: core/extended labeling, deferred/manual visibility, resolver contract documentation, compatibility shim cleanup, final fixture suite, documented Foundry checks, and direct-mutation/un-awaited update audit closure.

### Cross-Cutting Definition of Done for Combat Stories

Every combat mechanics story must satisfy these guardrails unless explicitly scoped as documentation-only:

- `CyberpunkItem` remains a compatible entry point until a story explicitly removes a legacy route.
- Resolver logic is pure or pure-ish: no direct Foundry document mutation before a `CombatOutcome` is built.
- Persisted state changes are planned first, then committed through awaited Foundry document update APIs.
- Chat output is derived from `CombatOutcome` and planned/committed update state, not from already-mutated live actor/item data.
- Deterministic fixtures are introduced or updated for the rule path, actor/item state transition, and at least one relevant audited regression.
- Rules-fidelity acceptance criteria cite audit/corebook page references and paraphrase expected behavior rather than copying long rule text.
- Unsupported or deferred behavior is hidden, disabled, warned, or marked manual; it must not appear as a functional no-op.

## Epic 1: Combat Resolver Foundation

Maintainers can introduce the combat resolver boundary without changing combat behavior: `CombatOutcome`, resolver input snapshots, `CyberpunkItem` adapter, state planner contract, outcome-derived chat contract, and deterministic fixture baseline.

### Story 1.1: Define CombatOutcome and Resolver Input Contracts

**Requirements:** FR1, FR21, FR22

As a maintainer,
I want stable combat resolver input and output contracts,
So that future combat rules can be implemented without scattering state, chat, and formula logic across item methods.

**Acceptance Criteria:**

**Given** the existing item-centric combat code
**When** `module/combat/` contracts are added
**Then** `CombatOutcome`, combat context, target reference, roll metadata, planned update, warning, and manual-resolution shapes are documented in code
**And** no existing weapon roll behavior changes.

### Story 1.2: Add Resolver Shell and CyberpunkItem Adapter

**Requirements:** FR1, FR22

As a maintainer,
I want `CyberpunkItem` to delegate through a resolver shell while preserving legacy behavior,
So that migration can proceed incrementally without breaking existing sheets.

**Acceptance Criteria:**

**Given** a weapon roll launched from the current actor sheet
**When** the adapter receives actor, item, modifiers, and targets
**Then** it builds resolver input snapshots and can fall back to the current legacy roll path
**And** `CyberpunkItem` remains the public entry point.

### Story 1.3: Add State Planner Contract

**Requirements:** FR3, FR22

As a maintainer,
I want combat state changes represented as planned updates before commit,
So that ammo, damage, armor, and wound state cannot silently diverge from chat.

**Acceptance Criteria:**

**Given** a resolver outcome with state deltas
**When** the state planner receives the outcome
**Then** it returns explicit actor/item/embedded item update plans
**And** pure resolver modules do not mutate Foundry documents directly.

### Story 1.4: Add Deterministic Fixture Baseline

**Requirements:** FR21

As a maintainer,
I want deterministic combat fixtures and dice control,
So that mechanics changes can be verified without a full Foundry world where possible.

**Acceptance Criteria:**

**Given** the repo has no existing test harness
**When** fixture baseline files are added
**Then** deterministic dice/RNG, actor/item/weapon/armor snapshots, and a minimal single-shot fixture can run outside sheet UI
**And** the fixture asserts outcome shape and planned state updates.

### Story 1.5: Add Outcome-Derived Chat Contract

**Requirements:** FR1, FR3

As a maintainer,
I want chat data generated from `CombatOutcome`,
So that chat evidence and committed state use the same source of truth.

**Acceptance Criteria:**

**Given** a `CombatOutcome`
**When** chat template data is generated
**Then** preview/manual/committed/canceled statuses are representable
**And** chat data does not depend on already-mutated actor/item state.

## Epic 2: End-to-End Single-Shot Firearm Resolution

Referees can resolve one firearm attack against a selected Target Actor from attack roll through target-aware hit location, ammo planning, preview/confirm state application, and readable chat evidence.

### Story 2.1: Normalize Selected Targets to Actor-Aware References

**Requirements:** FR2, FR9

As a referee,
I want selected Foundry targets to resolve into actor-aware combat targets,
So that attacks can use target hit locations, armor, BTM, wound state, and save thresholds.

**Acceptance Criteria:**

**Given** one or more tokens are targeted in Foundry
**When** a firearm attack is initiated from the actor sheet
**Then** each selected target is represented with token UUID, actor UUID when available, and display name
**And** targets without actor context are marked for manual-resolution instead of silently using name/id only.

### Story 2.2: Resolve Single-Shot Ranged Attack Outcome

**Requirements:** FR4, FR9

As a referee,
I want a single firearm shot to produce a structured hit or miss result,
So that I can audit attack total, range difficulty, modifiers, critical/fumble metadata, and target location.

**Acceptance Criteria:**

**Given** an attacker, weapon, target, range, and attack modifiers
**When** a semi-auto/single-shot attack is resolved
**Then** the outcome includes attack total, range DC, modifier evidence, hit/miss state, natural die metadata, and hit location when applicable
**And** existing ranged modifiers remain represented.

### Story 2.3: Preserve Ammo Planning and Legacy Entry Behavior

**Requirements:** FR3, FR4

As a referee,
I want single-shot ammo use to be planned and applied consistently,
So that weapon state and chat output do not diverge.

**Acceptance Criteria:**

**Given** a weapon with available shots
**When** a single-shot attack outcome is produced
**Then** the outcome includes an ammo delta of one shot or a clear warning if ammo is insufficient
**And** ammo is not persisted until the commit path applies the planned update.

### Story 2.4: Preview and Confirm Single-Shot State Application

**Requirements:** FR3, UX-DR1

As a referee,
I want to preview and confirm single-shot damage/state changes,
So that I can apply or cancel target updates before the actor document changes.

**Acceptance Criteria:**

**Given** a single-shot outcome with planned ammo and target updates
**When** the preview dialog is shown
**Then** it displays target, hit/miss, location, damage/update summary, ammo change, warnings, and commit/cancel actions
**And** confirming awaits Foundry document updates while canceling leaves actor/item state unchanged.

### Story 2.5: Render Single-Shot Combat Evidence in Chat

**Requirements:** FR1, FR3, UX-DR2

As a referee,
I want single-shot combat chat to show the resolved evidence and commit status,
So that table participants can audit what happened without reading source code.

**Acceptance Criteria:**

**Given** a single-shot `CombatOutcome`
**When** chat data is rendered
**Then** the card shows attack total, range DC, modifiers, target, hit location, ammo delta, manual/preview/committed/canceled status, and warnings
**And** chat evidence is derived from the outcome and commit status.

### Story 2.6: Add Single-Shot Fixtures and Foundry Manual Checks

**Requirements:** FR2, FR3, FR4, FR9, FR21, UX-DR4

As a maintainer,
I want fixtures and documented manual checks for the first end-to-end firearm flow,
So that future combat resolver changes do not break target context, hit resolution, ammo planning, preview/confirm, or chat evidence.

**Acceptance Criteria:**

**Given** deterministic fixtures from Epic 1
**When** single-shot fixtures are run
**Then** they verify target normalization, hit/miss outcome shape, hit location, ammo planned update, and manual-resolution fallback
**And** a documented Foundry check covers actor sheet attack launch, target selection, preview dialog, confirm/cancel, and chat rendering.

## Epic 3: Faithful Damage, Armor, Wounds, and Saves

Referees can trust that incoming damage is mitigated and applied according to core combat rules for armor, AP, BTM, wound state, special damage cases, and save prompts.

### Story 3.1: Add Armor and AP Snapshot Plumbing

**Requirements:** FR10, FR11, FR22

As a maintainer,
I want weapon AP and target armor data available to the resolver as snapshots,
So that damage rules can use existing item data without immediately reshaping `template.json`.

**Acceptance Criteria:**

**Given** a target actor with equipped armor and a weapon with `system.ap`
**When** resolver snapshots are built
**Then** weapon AP, armor coverage, stopping power, ablation, equipped state, source, and item IDs are available to `armor-resolver`
**And** actor-prepared pre-summed SP is not used as the rules source of truth.

### Story 3.2: Resolve Effective Armor SP with Layering and Cover

**Requirements:** FR10, FR21

As a referee,
I want the system to calculate effective armor protection at the hit location,
So that armor mitigation matches core combat expectations instead of straight additive SP.

**Acceptance Criteria:**

**Given** incoming damage at a target hit location
**When** armor resolution runs
**Then** the outcome includes armor layers considered, effective SP, manual cover SP when provided, and any hard/soft layer warnings
**And** proportional/layered armor behavior is fixture-covered with audit/corebook references.

### Story 3.3: Apply Armor Piercing and Staged Penetration

**Requirements:** FR11, FR21, FR22

As a referee,
I want AP and staged penetration effects to be applied explicitly,
So that penetrating hits produce correct damage and auditable armor state changes.

**Acceptance Criteria:**

**Given** an AP weapon hits armored target coverage
**When** damage penetrates armor
**Then** AP armor handling, penetrating damage handling, and staged penetration/ablation planned updates are represented in the outcome
**And** staged penetration can be disabled by setting while remaining visible in chat evidence.

### Story 3.4: Resolve BTM and Minimum Damage

**Requirements:** FR12, FR21

As a referee,
I want BTM applied after armor with the correct minimum damage behavior,
So that final applied damage is mechanically faithful and explainable.

**Acceptance Criteria:**

**Given** damage remains after armor mitigation
**When** BTM resolution runs
**Then** the outcome shows raw damage, armor mitigation, BTM mitigation, final damage, and minimum damage enforcement
**And** fixtures cover full stop, BTM reduction, and minimum damage cases.

### Story 3.5: Apply Wound State and Special Damage Cases

**Requirements:** FR13, FR22

As a referee,
I want confirmed damage to update wound state and surface special cases,
So that head hits, limb consequences, Serious/Critical/Mortal transitions, and penalties are not manually reconstructed.

**Acceptance Criteria:**

**Given** confirmed final damage against a Target Actor
**When** state planning runs
**Then** planned updates advance wound boxes and report old/new wound state
**And** head-hit and limb-loss/severing special cases are surfaced as outcome warnings or follow-up requirements.

### Story 3.6: Generate Stun and Death Save Prompts

**Requirements:** FR14, FR21

As a referee,
I want damage outcomes to identify required Stun/Shock and Death Saves,
So that follow-up saves are visible immediately after damage resolution.

**Acceptance Criteria:**

**Given** final damage changes or confirms a wound state that requires saves
**When** save resolution runs
**Then** the outcome includes Stun/Shock threshold, Death Save threshold when applicable, pending save prompts, and recurring Mortal reminder if in scope
**And** fixtures cover Serious, Critical, Mortal, stun threshold, and death threshold transitions.

### Story 3.7: Add Damage Pipeline Fixtures and Foundry Checks

**Requirements:** FR10, FR11, FR12, FR13, FR14, FR21, FR22

As a maintainer,
I want deterministic fixtures and manual checks for armor/AP/BTM/wound/save behavior,
So that future changes cannot silently regress core combat outcomes.

**Acceptance Criteria:**

**Given** Epic 3 resolver behavior
**When** fixtures run
**Then** they cover unarmored hit, fully stopped armor hit, AP shot, BTM minimum damage, head hit, limb threshold, wound transitions, Stun Save, Death Save, and staged penetration setting behavior
**And** a Foundry manual check verifies preview/confirm persists damage and armor changes without chat/state divergence.

## Epic 4: Automatic Fire Resolution

Referees can resolve automatic weapon modes without manual reconstruction: three-round burst, full auto across one or more targets, suppressive fire, ammunition use, and reliability/jam consequences.

### Story 4.1: Migrate Three-Round Burst to Resolver Outcome

**Requirements:** FR6, FR21, FR22

As a referee,
I want three-round burst to resolve through the combat resolver,
So that burst hit count, modifiers, damage hits, ammo, and chat evidence use the same pipeline as single-shot attacks.

**Acceptance Criteria:**

**Given** an automatic weapon with at least one remaining round
**When** three-round burst is selected
**Then** the resolver applies burst fire mode, close/medium attack advantage, rounds fired as three or remaining ammo, and hit count on success
**And** ammo is planned once through state planner, not mutated inside the item roll loop.

### Story 4.2: Resolve Full Auto Against One Target

**Requirements:** FR7, FR21, FR22

As a referee,
I want full auto against one target to calculate hits and ammo consistently,
So that automatic fire does not require manual hit counting or duplicate state updates.

**Acceptance Criteria:**

**Given** an automatic weapon and one Target Actor
**When** full auto is resolved
**Then** rounds fired, range modifier, attack total, hit count capped by rounds fired and success margin, hit locations, damage entries, and ammo delta are represented in the outcome
**And** all state changes use the shared state planner and preview/confirm flow.

### Story 4.3: Resolve Full Auto Across Multiple Targets

**Requirements:** FR7, FR21

As a referee,
I want full auto across multiple targets to preserve per-target context,
So that ROF division, target rounding, range, hit count, and damage are auditable per target.

**Acceptance Criteria:**

**Given** an automatic weapon and multiple selected targets
**When** full auto is resolved
**Then** ROF is divided by target count and rounded down per core rule reference
**And** each target outcome preserves target actor context, rounds fired, hit count, locations, damage, warnings, and manual-resolution fallback.

### Story 4.4: Implement Suppressive Fire Resolver

**Requirements:** FR8, FR20, FR21, UX-DR3

As a referee,
I want suppressive fire to be a real supported fire mode,
So that exposed automatic weapon options do not silently do nothing.

**Acceptance Criteria:**

**Given** suppressive fire is selected
**When** fire-zone width and rounds fired are provided
**Then** the resolver calculates target save difficulty, prompts or rolls Athletics + REF + 1d10, identifies failed targets, assigns failed-save hit counts and locations, and plans ammo once
**And** if required inputs are missing, the outcome is marked manual/incomplete rather than producing a false resolved result.

### Story 4.5: Add Reliability, Fumble, and Jam Handling

**Requirements:** FR5, FR21

As a referee,
I want automatic weapon fumbles to surface reliability and jam outcomes,
So that automatic fire includes the risk behavior expected by the core rules.

**Acceptance Criteria:**

**Given** an automatic weapon attack produces a fumble condition
**When** reliability handling runs
**Then** the outcome distinguishes automatic weapon jams from non-automatic fumbles
**And** jam state or unjam instruction is visible in chat evidence and fixture-covered.

### Story 4.6: Disable or Mark Unsupported Automatic Modes Until Complete

**Requirements:** FR20, UX-DR3

As a referee,
I want unsupported automatic fire options hidden, disabled, or clearly marked manual,
So that I do not select a no-op mechanic believing it is implemented.

**Acceptance Criteria:**

**Given** Corebook Fidelity Mode is enabled
**When** an automatic fire mode is not fully supported
**Then** the UI or outcome marks it disabled/manual/incomplete
**And** no exposed mode silently exits without a resolver outcome or warning.

### Story 4.7: Add Automatic Fire Fixtures and Foundry Checks

**Requirements:** FR5, FR6, FR7, FR8, FR21, FR22

As a maintainer,
I want automatic fire fixtures and manual checks,
So that burst, full auto, suppressive fire, ammo, and jam behavior do not regress.

**Acceptance Criteria:**

**Given** Epic 4 automatic fire behavior
**When** fixtures run
**Then** they cover three-round burst hit count and ammo, full-auto one target, full-auto multi-target rounding, suppressive fire save difficulty and failed-save hit count, and reliability/jam outcomes
**And** Foundry checks verify selected-target handling, preview/confirm, and chat evidence for automatic fire.

## Epic 5: Opposed Melee and Martial Arts

Referees can resolve melee and martial actions as opposed combat rather than attacker-only chat rolls, including Body Type damage modifiers, martial actions, prerequisites, and key technique bonuses.

### Story 5.1: Normalize Defender Context for Melee Resolution

**Requirements:** FR15, FR17

As a referee,
I want melee targets to resolve into defender actor context,
So that opposed rolls can use defender skills, stats, and target-specific hit locations.

**Acceptance Criteria:**

**Given** a melee or martial action is launched with a selected target
**When** target normalization runs
**Then** the defender actor UUID, token UUID, relevant skills/stats, and hit location model are available to the melee resolver
**And** missing defender actor context produces a manual-resolution outcome with warning.

### Story 5.2: Resolve Baseline Opposed Melee Attacks

**Requirements:** FR15, FR21

As a referee,
I want melee attacks to resolve as opposed rolls,
So that melee success and failure are not based only on the attacker roll.

**Acceptance Criteria:**

**Given** an attacker, defender, melee weapon, and selected defender response skill
**When** melee resolution runs
**Then** the outcome includes attacker roll, defender roll, opposed result, success/failure, hit location on success, and damage only when the opposed result permits it
**And** fixtures cover attacker win, defender win, and tie/edge behavior as defined by the accepted rule reference.

### Story 5.3: Apply Melee Body Type Damage Modifiers

**Requirements:** FR16, FR21

As a referee,
I want melee and unarmed damage to include the correct Body Type damage modifier,
So that melee damage matches the corebook strength/body table.

**Acceptance Criteria:**

**Given** a successful melee or unarmed attack
**When** damage is resolved
**Then** Body Type damage modifier is included in the outcome with source evidence
**And** the known Body Type 13-14 mismatch is corrected or explicitly fixture-tested before release.

### Story 5.4: Add Martial Arts Data Module

**Requirements:** FR18, FR21

As a maintainer,
I want martial arts styles and key techniques represented as inspectable data,
So that martial bonuses are not hard-coded or silently zero.

**Acceptance Criteria:**

**Given** core martial art style data is needed by the resolver
**When** `martial-arts-data.js` is added
**Then** Brawling and trained martial arts remain distinguishable
**And** style key techniques can be inspected, tested, and used by the martial resolver.

### Story 5.5: Resolve Martial and Brawling Actions

**Requirements:** FR17, FR18, FR20, UX-DR3

As a referee,
I want martial and brawling actions to produce action-specific outcomes,
So that strike, kick, block/parry, dodge, disarm, sweep/trip, grapple, hold, choke, throw, and escape are not generic attacker-only rolls.

**Acceptance Criteria:**

**Given** a martial/brawling action is selected
**When** martial resolution runs
**Then** the outcome identifies the action, opposed roll inputs, key technique bonus if applicable, success/failure, damage or non-damage effect, and pending decisions/prerequisites
**And** unsupported or stateful action parts are marked manual/pending rather than silently ignored.

### Story 5.6: Enforce Grapple-Family Prerequisites and Pending State

**Requirements:** FR17, FR20

As a referee,
I want throw, hold, choke, and escape to respect grapple state/prerequisites,
So that martial outcomes do not imply illegal action chains.

**Acceptance Criteria:**

**Given** a grapple-family action is selected
**When** resolver prerequisites are checked
**Then** missing grapple/hold state produces warning or manual pending decision
**And** valid prerequisite state allows the action to produce an auditable outcome.

### Story 5.7: Add Melee and Martial Fixtures and Foundry Checks

**Requirements:** FR15, FR16, FR17, FR18, FR21, FR22

As a maintainer,
I want fixtures and manual checks for opposed melee and martial actions,
So that melee/martial combat fidelity does not regress.

**Acceptance Criteria:**

**Given** Epic 5 melee/martial behavior
**When** fixtures run
**Then** they cover opposed melee hit/miss, Body Type modifier, martial key technique bonus, strike/kick damage, and grapple-family prerequisite path
**And** Foundry checks verify action selection, target/defender context, preview/confirm where damage applies, and chat evidence.

## Epic 6: Compatibility, Conformance, and Regression Closure

Referees and maintainers can tell which mechanics and items are corebook-conformant, extended, unknown, implemented, deferred, or manual, while maintainers can close remaining regression, compatibility, and state-discipline risks before MVP release.

### Story 6.1: Add Corebook Conformance Labels or Derived Classification

**Requirements:** FR19

As a referee,
I want items and mechanics to identify corebook, extended, or unknown scope,
So that non-core data is not mistaken for corebook-faithful evidence.

**Acceptance Criteria:**

**Given** existing item `source` data and mixed pack content
**When** conformance classification runs
**Then** items are classified as corebook, extended, or unknown through persisted labels or derived mapping
**And** the approach does not require physically splitting existing packs for MVP.

### Story 6.2: Surface Deferred and Manual Mechanics Clearly

**Requirements:** FR20, UX-DR3

As a referee,
I want unsupported or deferred mechanics to be visible as manual or unavailable,
So that I do not rely on controls that silently simplify or do nothing.

**Acceptance Criteria:**

**Given** Corebook Fidelity Mode is enabled
**When** a mechanic is incomplete, unsupported, or requires referee decision
**Then** the UI or outcome clearly marks it manual/deferred/disabled
**And** no known P0 combat option remains exposed as a silent no-op.

### Story 6.3: Document Resolver Contracts and Rule Reference Policy

**Requirements:** FR1, FR19, FR21

As a maintainer,
I want resolver contracts and rule-reference policy documented,
So that future stories cite rules consistently without copying large rule text.

**Acceptance Criteria:**

**Given** resolver modules and combat stories exist
**When** documentation is updated
**Then** it explains `CombatOutcome`, resolver input snapshots, planned updates, commit flow, fixture expectations, and chat derivation
**And** it states that rule behavior should cite audit/corebook page references and paraphrase expected behavior.

### Story 6.4: Close Direct-Mutation and Awaited-Update Audit Findings

**Requirements:** FR22

As a maintainer,
I want remaining touched combat-adjacent state updates to use awaited document APIs,
So that persisted actor/item state cannot drift from chat or sheet display.

**Acceptance Criteria:**

**Given** known audit risk areas in actor, item, item sheet, and migration code
**When** the closure audit runs
**Then** touched combat paths avoid direct persisted `system` mutation and un-awaited updates
**And** any intentionally deferred mutation/update risks are documented with owner and follow-up story.

### Story 6.5: Fix Cyberware Humanity Roll Persistence

**Requirements:** FR22

As a referee,
I want rolled cyberware humanity loss to persist correctly,
So that EMP/humanity derived state reflects actual cyberware data.

**Acceptance Criteria:**

**Given** a cyberware item sheet humanity roll
**When** the user rolls or sets humanity loss
**Then** the value persists through Foundry document update APIs
**And** actor EMP/humanity derived values update consistently after sheet refresh.

### Story 6.6: Complete MVP Regression Fixture Suite

**Requirements:** FR21

As a maintainer,
I want a complete fixture suite covering MVP combat mechanics,
So that core combat fidelity remains stable across future refactors.

**Acceptance Criteria:**

**Given** fixtures added throughout Epics 1-5
**When** the final suite runs
**Then** it covers range DCs, armor, AP, BTM, wounds, saves, burst, full auto, suppressive fire, melee, martial actions, and humanity persistence
**And** each fixture records the rule/audit reference it verifies.

### Story 6.7: Document Foundry MVP Verification Checklist

**Requirements:** FR21, UX-DR4

As a maintainer,
I want a Foundry manual verification checklist for the combat MVP,
So that runtime behavior is verified where pure fixtures cannot cover Foundry UI/document behavior.

**Acceptance Criteria:**

**Given** MVP mechanics are implemented
**When** the verification checklist is completed
**Then** it covers actor sheet attack launch, target selection, preview/confirm, chat rendering, damage persistence, armor/staged penetration persistence, ammo persistence, automatic fire, melee/martial actions, and humanity persistence
**And** unresolved manual verification gaps are documented before readiness review.

### Story 6.8: Remove or Fence Legacy Combat Paths

**Requirements:** FR20, FR22

As a maintainer,
I want legacy combat paths either removed, fenced, or explicitly retained,
So that old item-centric code cannot bypass the resolver and corrupt state.

**Acceptance Criteria:**

**Given** resolver-backed combat paths are available
**When** legacy roll methods are reviewed
**Then** each legacy method is removed, redirected to resolver, fenced behind compatibility/manual mode, or documented as intentionally retained
**And** no supported MVP combat action bypasses `CombatOutcome` and state planner.
