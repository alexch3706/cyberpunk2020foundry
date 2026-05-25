---
stepsCompleted: [1, 2, 3, 4, 5, 6]
includedDocuments:
  prd: _bmad-output/planning-artifacts/prds/prd-Cyberpunk2020VTT-2026-05-24/prd.md
  architecture: _bmad-output/planning-artifacts/architecture.md
  epics: _bmad-output/planning-artifacts/epics.md
  ux: null
---

# Implementation Readiness Assessment Report

**Date:** 2026-05-24
**Project:** Cyberpunk2020VTT

## Document Inventory

### PRD Files Found

**Whole Documents:**
- `_bmad-output/planning-artifacts/prds/prd-Cyberpunk2020VTT-2026-05-24/prd.md` (20271 bytes, modified May 24 13:59:38 2026)

**Sharded Documents:**
- None found

### Architecture Files Found

**Whole Documents:**
- `_bmad-output/planning-artifacts/architecture.md` (20094 bytes, modified May 24 13:55:40 2026)

**Sharded Documents:**
- None found

### Epics & Stories Files Found

**Whole Documents:**
- `_bmad-output/planning-artifacts/epics.md` (41189 bytes, modified May 24 17:12:08 2026)

**Sharded Documents:**
- None found

### UX Design Files Found

**Whole Documents:**
- None found

**Sharded Documents:**
- None found

### Discovery Issues

- No duplicate whole/sharded document conflicts found.
- No dedicated UX design document found. This is acceptable for this MVP because PRD and Architecture contain the preview/confirm, chat evidence, manual/deferred state, and brownfield UI compatibility requirements.

## PRD Analysis

### Functional Requirements

FR1: The system must produce a structured Combat Outcome for supported combat actions.

FR2: The system must resolve combat against Target Actors, not only target token names or IDs.

FR3: The system must commit ammo, damage, wound, armor, and cyberware state changes through Foundry document update APIs.

FR4: The system must resolve ranged attacks using REF, relevant weapon skill, 1d10 critical behavior, range difficulty, weapon accuracy, and applicable modifiers.

FR5: The system must apply reliability/jam behavior for automatic weapons when fumble conditions require it.

FR6: The system must resolve three-round burst according to corebook burst rules.

FR7: The system must resolve full auto against one or more targets according to corebook full-auto rules.

FR8: The system must implement suppressive fire as a supported automatic weapon mode.

FR9: The system must resolve random and aimed Hit Locations using the target's location model.

FR10: The system must calculate Effective SP for the incoming hit before BTM is applied.

FR11: The system must support AP behavior and staged armor penetration for Corebook Fidelity Mode.

FR12: The system must apply BTM after armor mitigation.

FR13: The system must update or present Wound State outcomes after final damage is calculated.

FR14: The system must identify required Stun/Shock and Death Saves after damage.

FR15: The system must resolve melee attacks as attacker REF + skill + 1d10 versus defender REF + applicable skill + 1d10.

FR16: The system must apply Body Type damage modifiers to melee weapon and unarmed attacks where applicable.

FR17: The system must support the core martial/brawling actions required for faithful play.

FR18: The system must represent martial arts style key technique bonuses.

FR19: The system must provide a way to identify Core Pack Data versus Extended Pack Data.

FR20: The system must make unsupported or deferred mechanics visible to maintainers and referees.

FR21: The project must include fixture coverage for the core mechanical examples and table interactions in this MVP.

FR22: The project must prevent known direct-mutation and un-awaited update regressions in mechanics paths.

**Total FRs:** 22

### Non-Functional Requirements

NFR1: Correctness - Mechanics in Corebook Fidelity Mode must prefer explicit manual prompts over silent simplification when full automation is not available.

NFR2: Auditability - Chat output must show enough intermediate values for a referee to validate a result.

NFR3: Maintainability - Core mechanics should be testable without duplicating formulas across sheets and item methods.

NFR4: Backward compatibility - Existing actors/items should continue loading, and any template shape change must include migration strategy.

NFR5: Foundry fit - The solution must remain a FoundryVTT system package loaded through `system.json`; no standalone runtime is introduced for MVP.

NFR6: Legal/content hygiene - The project may cite local page references for internal development, but user-facing docs should avoid reproducing large copyrighted rule text.

**Total NFRs:** 6

### Additional Requirements

- MVP scope includes mechanics resolver behavior for ranged combat, damage, armor, wounds, saves, melee, martial actions, target-aware outcomes, correct ammo/state updates, AP and armor layering, suppressive fire, critical/fumble/reliability, cyberware humanity persistence, conformance labeling, fast-draw initiative semantics, fixtures, and documented live verification checks.
- Out of scope: full Foundry v12 modernization, compendium rewrite, netrunning, vehicle combat beyond avoiding regressions, party initiative automation, scene/map cover automation, full UX redesign, Cyberpunk RED, and rebalancing.
- Resolved scope decisions include staged penetration in Corebook Fidelity Mode, preview/confirm damage application, fast-draw initiative in MVP, source/core labels without physical pack split, manual cover input, and all corebook martial arts styles/key techniques by MVP completion.

### PRD Completeness Assessment

The PRD is implementation-ready as a requirements source: it has clear user journeys, 22 functional requirements, 6 NFRs, explicit non-goals, in/out scope, success metrics, and resolved scope decisions. Minor documentation hygiene issue: the Assumptions Index still says the document remains `draft`, while frontmatter status is `ready-for-epics`; this is stale wording, not a requirements blocker.

## Epic Coverage Validation

### Coverage Matrix

| FR Number | PRD Requirement | Epic / Story Coverage | Status |
| --- | --- | --- | --- |
| FR1 | Structured Combat Outcome | Epic 1; Stories 1.1, 1.2, 1.5, 2.5, 6.3 | Covered |
| FR2 | Target Actor context | Epic 2; Stories 2.1, 2.6 | Covered |
| FR3 | Controlled state commit | Epic 1 and Epic 2; Stories 1.3, 1.5, 2.3, 2.4, 2.5, 2.6 | Covered |
| FR4 | Ranged attack roll | Epic 2; Stories 2.2, 2.3, 2.6 | Covered |
| FR5 | Reliability and jam handling | Epic 4; Stories 4.5, 4.7 | Covered |
| FR6 | Three-round burst | Epic 4; Stories 4.1, 4.7 | Covered |
| FR7 | Full auto | Epic 4; Stories 4.2, 4.3, 4.7 | Covered |
| FR8 | Suppressive fire | Epic 4; Stories 4.4, 4.7 | Covered |
| FR9 | Hit Location resolution | Epic 2; Stories 2.1, 2.2, 2.6 | Covered |
| FR10 | Armor resolution | Epic 3; Stories 3.1, 3.2, 3.7 | Covered |
| FR11 | Armor piercing and staged penetration | Epic 3; Stories 3.1, 3.3, 3.7 | Covered |
| FR12 | BTM and minimum damage | Epic 3; Stories 3.4, 3.7 | Covered |
| FR13 | Wound state and special damage cases | Epic 3; Stories 3.5, 3.7 | Covered |
| FR14 | Stun and Death Save prompts | Epic 3; Stories 3.6, 3.7 | Covered |
| FR15 | Opposed melee roll | Epic 5; Stories 5.1, 5.2, 5.7 | Covered |
| FR16 | Melee damage modifier | Epic 5; Stories 5.3, 5.7 | Covered |
| FR17 | Martial action support | Epic 5; Stories 5.1, 5.5, 5.6, 5.7 | Covered |
| FR18 | Martial style key techniques | Epic 5; Stories 5.4, 5.5, 5.7 | Covered |
| FR19 | Corebook conformance labels | Epic 6; Stories 6.1, 6.3 | Covered |
| FR20 | Rules scope visibility | Epic 4, Epic 5, Epic 6; Stories 4.4, 4.6, 5.5, 5.6, 6.2, 6.8 | Covered |
| FR21 | Core mechanics fixtures | Epic 1 and Epic 6, plus mechanic-specific fixture stories; Stories 1.1, 1.4, 2.6, 3.2-3.4, 3.6-3.7, 4.1-4.5, 4.7, 5.2-5.5, 5.7, 6.3, 6.6, 6.7 | Covered |
| FR22 | State update discipline | Epic 1 and Epic 6, plus state-sensitive mechanics stories; Stories 1.1-1.3, 2.6, 3.1, 3.3, 3.5, 3.7, 4.1-4.2, 4.7, 5.7, 6.4, 6.5, 6.8 | Covered |

### Missing Requirements

No uncovered PRD functional requirements found.

### Coverage Statistics

- Total PRD FRs: 22
- FRs covered in epics/stories: 22
- Coverage percentage: 100%

## UX Alignment Assessment

### UX Document Status

No dedicated UX design document was found.

### Alignment Issues

No blocking UX alignment issues found. The MVP intentionally avoids a full UX redesign and keeps brownfield Foundry ActorSheet/ItemSheet, Handlebars, localization, and chat-card patterns. The user-facing UX work required for the MVP is captured in PRD, Architecture, and Epics as focused interaction requirements:

- Preview/confirm damage application dialog.
- Structured combat outcome chat cards.
- Visible manual/deferred/disabled states for unsupported mechanics.
- Brownfield-compatible Foundry sheet and template integration.

### Warnings

- Because there is no dedicated UX spec, visual layout, exact dialog copy, and chat-card presentation details remain under-specified. This is acceptable for the Core Combat Fidelity MVP if implementation stories keep UI changes minimal and follow existing Foundry/Handlebars patterns.
- UX requirements extracted into `epics.md` are covered by stories: UX-DR1 by Story 2.4, UX-DR2 by Story 2.5, UX-DR3 by Stories 4.4, 4.6, 5.5, 6.2, and UX-DR4 by Stories 2.6 and 6.7.

## Epic Quality Review

### Executive Quality Finding

The epics and stories are generally ready for implementation planning. The main best-practice exception is intentional: Epic 1 is a technical foundation epic. This violates the pure "user-value-only epic" heuristic, but it is justified for this brownfield FoundryVTT resolver migration because later user-facing combat outcomes require a safe resolver boundary, state planner, and deterministic fixture baseline before rules behavior changes.

### Critical Violations

No critical violations found.

- No forward dependency requiring a future epic to make an earlier epic function.
- No epic-sized story that obviously exceeds a single dev agent's likely context.
- No missing FR coverage.
- No database/entity upfront setup issue; this is a Foundry system package, not a greenfield database application.
- No starter-template requirement exists in Architecture.

### Major Issues

#### Major Issue 1: Epic 1 Is a Technical Enabler, Not Direct Referee Value

**Finding:** Epic 1, "Combat Resolver Foundation", is maintainer-focused and technical. This is a deliberate exception made after Party Mode review to prevent unsafe changes in `module/item/item.js`, state updates, and chat output.

**Impact:** If implemented as abstract infrastructure with no parity checks, it could drift into architecture work that does not prove user value.

**Recommendation:** Sprint planning should enforce Story 1.2, Story 1.4, and Story 1.5 as parity/verification outcomes. Epic 1 should not be accepted unless existing weapon roll entry behavior remains compatible and the fixture baseline proves resolver contracts produce planned state and chat shapes.

#### Major Issue 2: Corebook Alignment Is Mediated by Audit References, Not Revalidated Directly in Readiness

**Finding:** The readiness documents intentionally do not load the full Corebook markdown. Alignment flows through audit, PRD, architecture, and rule-reference requirements in stories.

**Impact:** A future implementation story could accidentally encode a rule from memory unless the story validates its specific rule reference before development.

**Recommendation:** Keep the cross-cutting DoD in `epics.md`: every rules-fidelity story must cite audit/corebook page references and use deterministic fixtures for expected outcomes. Story validation should fail stories that lack rule references for mechanics behavior.

### Minor Concerns

#### Minor Concern 1: PRD Assumptions Index Has Stale Status Wording

**Finding:** PRD frontmatter says `ready-for-epics`, but the Assumptions Index still says the document remains `draft` pending architecture feasibility review and story slicing.

**Impact:** Documentation inconsistency only; no requirement ambiguity.

**Recommendation:** Update the Assumptions Index text before final planning archive or sprint planning.

#### Minor Concern 2: UX Copy and Layout Are Under-Specified

**Finding:** Preview dialog and chat card UX are specified functionally but not visually.

**Impact:** Acceptable for MVP if implementation follows existing Foundry patterns, but individual stories may need small copy/layout decisions during development.

**Recommendation:** Keep UI changes minimal, localized, and aligned with existing Handlebars/Foundry sheet patterns. Do not introduce a broader UX redesign.

### Epic Independence Assessment

| Epic | Independence Assessment | Result |
| --- | --- | --- |
| Epic 1 | Stands alone as a brownfield safety/enabler slice; no future dependencies. | Pass with justified technical-epic exception |
| Epic 2 | Uses Epic 1 contracts to deliver the first referee-visible single-shot flow; does not require Epic 3. | Pass |
| Epic 3 | Uses Epic 2 single-shot flow to deepen damage/armor/wound fidelity; does not require automatic fire or melee. | Pass |
| Epic 4 | Uses prior outcome/state/chat pipeline for automatic fire; does not require Epic 5 or Epic 6. | Pass |
| Epic 5 | Uses prior resolver/state concepts but defines a distinct opposed combat branch; does not require Epic 6. | Pass |
| Epic 6 | Closes compatibility, conformance, and regression risks after mechanics are present. | Pass |

### Story Quality Assessment

- All stories include `As a / I want / So that` format.
- All stories include story-level `Requirements:` traceability.
- All stories include Given/When/Then/And acceptance criteria.
- Stories are generally sized as single dev-agent tasks.
- Cross-cutting Definition of Done appropriately prevents unsafe direct mutation, outcome/chat divergence, missing fixtures, and silent no-op mechanics.

### Dependency Assessment

No forward dependencies found. Dependencies flow naturally:

1. Resolver contracts and fixture baseline.
2. Single-shot Foundry flow.
3. Damage/armor/wounds/saves.
4. Automatic fire.
5. Opposed melee/martial.
6. Compatibility/conformance/regression closure.

### File Churn Assessment

Multiple epics will touch `module/item/item.js`, `module/actor/actor-sheet.js`, chat templates, and new `module/combat/` modules. This overlap is significant but justified because each epic is a distinct vertical behavior branch over the same resolver spine. The Party Mode revision explicitly rejected a late quality bucket and added cross-cutting DoD to reduce repeated unsafe rewrites.

## Summary and Recommendations

### Overall Readiness Status

READY, with sprint-planning guardrails.

The artifacts are sufficiently complete and aligned to proceed to sprint planning. There are no critical blockers. The two major issues are manageable if sprint planning and story validation explicitly enforce the documented guardrails.

### Critical Issues Requiring Immediate Action

No critical issues require immediate action before sprint planning.

### Major Issues to Carry into Sprint Planning

1. **Technical foundation exception must stay bounded.** Epic 1 is a justified technical enabler, but it must prove parity and verification outcomes. Do not let it become open-ended architecture work.
2. **Corebook alignment must be enforced per implementation story.** Readiness relies on audit/corebook references captured in planning artifacts. Each rules-fidelity story must validate its specific rule reference before development and include deterministic fixture expectations.

### Minor Cleanup Before or During Sprint Planning

1. Update the stale PRD Assumptions Index wording that still says the PRD remains `draft`.
2. Keep preview dialog and chat-card UX minimal and Foundry-native unless a later story explicitly expands UX scope.

### Recommended Next Steps

1. Run `bmad-sprint-planning` using PRD, Architecture, and Epics as inputs.
2. Start sprint planning with Epic 1 Story 1.1 through Story 1.5, preserving the sequence: contract first, parity second, rule improvement later.
3. Add a sprint-level Definition of Done: rules-fidelity stories must cite audit/corebook references, include or update deterministic fixtures, and avoid direct persisted state mutation outside planned/awaited Foundry document updates.
4. Before starting development on each story, use `bmad-create-story` and validate the story context against the relevant audit/corebook references.

### Final Note

This assessment identified 0 critical blockers, 2 major implementation-planning risks, and 2 minor cleanup items across requirements coverage, UX alignment, epic quality, and dependency structure. The planning package is ready for sprint planning if the major risks are carried forward as explicit planning guardrails.

**Assessor:** BMad Implementation Readiness workflow
