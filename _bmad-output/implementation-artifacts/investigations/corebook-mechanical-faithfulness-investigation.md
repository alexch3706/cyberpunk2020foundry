# Investigation: Cyberpunk2020VTT Corebook Mechanical Faithfulness

## Hand-off Brief

1. **What happened.** The user needs to know whether Cyberpunk2020VTT is mechanically faithful to the Cyberpunk 2020 core rules and whether implementation/architecture risks block correctness.
2. **Where the case stands.** Concluded for static audit; the project is mechanically partial, not currently faithful, to CP2020 core combat rules.
3. **What's needed next.** Extract a mechanics resolver layer before attempting broad UI or pack cleanup, then verify against corebook fixtures.

## Case Info

| Field | Value |
| --- | --- |
| Ticket | N/A |
| Date opened | 2026-05-24 |
| Status | Concluded |
| System | Local FoundryVTT system repository; source code, docs, PDF extraction |
| Evidence sources | `system.json`, `template.json`, `module/`, `templates/`, `packs/`, `docs/cyberpunk-2020-core-rules-extracted.md`, source PDF |

## Problem Statement

Investigate whether Cyberpunk2020VTT is mechanically faithful to the Cyberpunk 2020 core rules and identify implementation/architecture risks that could block correctness. Produce a prioritized audit with evidence from code and page references to the corebook.

## Evidence Inventory

| Source | Status | Notes |
| --- | --- | --- |
| Runtime manifest | Available | `system.json` defines Foundry package, entry module, compatibility, packs, language files. |
| Data template | Available | `template.json` defines actor/item defaults and schema-like system data. |
| Runtime code | Available | Targeted trace completed for actor, item, dice, lookup, migration, utility, and sheet paths. |
| Templates | Available | Targeted trace completed for damage and roll trigger surfaces. |
| Pack data | Partial | Manifest and sampled pack data confirm mixed sources; exhaustive per-item corebook audit still pending. |
| Corebook PDF | Available | `docs/Cyberpunk 2020 - Core Rules.pdf`, local source PDF. |
| Extracted corebook text | Partial | `docs/cyberpunk-2020-core-rules-extracted.md`; searchable but OCR/text quality varies. |
| Automated tests | Missing | No automated test harness detected. |
| Foundry runtime verification | Missing | No live Foundry runtime check has been run in this investigation. |

## Investigation Backlog

| # | Path to Explore | Priority | Status | Notes |
| - | --- | --- | --- | --- |
| 1 | Initiative and basic roll mechanics | High | Done | Solo initiative is directionally faithful; party/fast-draw semantics incomplete. |
| 2 | Wound, stun, death, and damage state mechanics | High | Done | Damage resolution pipeline is absent; actor wound effects only apply after manual damage state edit. |
| 3 | Armor and hit-location mechanics | High | Done | Armor layering/AP are missing or mechanically wrong; target actor context is insufficient. |
| 4 | Ranged combat, range DCs, full auto, three-round burst | High | Done | Range/modifier foundations exist; full-auto edge cases and suppressive fire block correctness. |
| 5 | Melee and martial arts | High | Done | Opposed melee and stateful martial actions are incomplete. |
| 6 | Cyberware humanity/EMP mechanics | Medium | Done | Formula foundation is present; item sheet roll persistence is broken. |
| 7 | Skills, role skills, and special abilities | Medium | Partial | Basic skill item system exists; exhaustive skill/source audit remains future work. |
| 8 | Architecture risks blocking correctness | High | Done | Async/direct mutation/migration risks confirmed. |

## Timeline of Events

| Time | Event | Source | Confidence |
| --- | --- | --- | --- |
| 2026-05-24 | Project context generated with implementation rules. | `_bmad-output/project-context.md` | Confirmed |
| 2026-05-24 | Brownfield documentation generated. | `docs/index.md` | Confirmed |
| 2026-05-24 | Corebook PDF extracted to searchable Markdown. | `docs/cyberpunk-2020-core-rules-extracted.md` | Confirmed |
| 2026-05-24 | Investigation opened. | this case file | Confirmed |
| 2026-05-24 | Static conformance audit produced. | `_bmad-output/implementation-artifacts/investigations/corebook-mechanical-faithfulness-audit.md` | Confirmed |

## Confirmed Findings

### Finding 1: Runtime code is loaded directly by Foundry and central mechanics live in actor/item classes

**Evidence:** `system.json`, `module/cyberpunk2020.js`, `module/actor/actor.js`, `module/item/item.js`

**Detail:** The system uses a Foundry package manifest, registers `CyberpunkActor` and `CyberpunkItem`, and implements actor/item mechanics in those subclasses.

### Finding 2: Damage resolution is not implemented as a rules pipeline

**Evidence:** `module/item/item.js:273`, `module/item/item.js:320`, `module/item/item.js:361`, `module/actor/actor-sheet.js:201`, `module/actor/actor.js:117`, `docs/cyberpunk-2020-core-rules-extracted.md:9294`, `docs/cyberpunk-2020-core-rules-extracted.md:9606`, `docs/cyberpunk-2020-core-rules-extracted.md:9765`

**Detail:** Weapon methods roll attacks/damage/locations into chat and decrement ammo; actor damage is manually edited from the sheet. Corebook damage requires location, armor SP, BTM, wound boxes, stun saves, and death-save logic.

### Finding 3: Armor layering/AP behavior is absent or wrong

**Evidence:** `module/actor/actor.js:84`, `module/actor/actor.js:92`, `template.json:811`, `template.json:802`, `docs/cyberpunk-2020-core-rules-extracted.md:9363`, `docs/cyberpunk-2020-core-rules-extracted.md:9388`, `docs/cyberpunk-2020-core-rules-extracted.md:9534`

**Detail:** Equipped armor SP is added directly per hit location. Corebook layering uses max-layer constraints and proportional armor; AP halves armor SP and remaining damage.

### Finding 4: Suppressive fire, opposed melee, and martial arts state are incomplete

**Evidence:** `module/item/item.js:217`, `module/item/item.js:231`, `module/item/item.js:378`, `module/item/item.js:393`, `docs/cyberpunk-2020-core-rules-extracted.md:10044`, `docs/cyberpunk-2020-core-rules-extracted.md:10111`, `docs/cyberpunk-2020-core-rules-extracted.md:10645`, `docs/cyberpunk-2020-core-rules-extracted.md:10663`

**Detail:** Suppressive fire is exposed as a fire mode but not dispatched. Melee lacks defender opposed rolls. Martial actions are selectable but only partially resolved.

### Finding 5: Architecture risks can desynchronize mechanical state

**Evidence:** `module/actor/actor.js:31`, `module/item/item.js:284`, `module/item/item.js:357`, `module/item/item-sheet.js:130`, `module/migrate.js:18`, `module/migrate.js:51`, `module/migrate.js:185`

**Detail:** Several Foundry updates are un-awaited, direct mutation is used for persisted-looking data, and migration completion can be reported before asynchronous work finishes.

## Deduced Conclusions

### Deduction 1: Mechanical faithfulness depends mainly on actor preparation, item roll flows, data template, and packs

**Based on:** Finding 1.

**Reasoning:** Foundry loads these classes as the document behavior owners; actor preparation computes derived stats and item behavior computes combat rolls.

**Conclusion:** The audit should prioritize `module/actor/actor.js`, `module/item/item.js`, `template.json`, `packs/`, and relevant templates before cosmetic code quality issues.

### Deduction 2: Broad UI refactor is not the first required step

**Based on:** Findings 2-5.

**Reasoning:** The correctness failures are in mechanics resolution and state persistence, not primarily in rendering.

**Conclusion:** The next engineering step should be a testable mechanics core/resolver, with Foundry UI and chat calling into it.

## Hypothesized Paths

### Hypothesis 1: The implementation is only partially faithful to the corebook

**Status:** Confirmed

**Theory:** The code implements a subset of Cyberpunk 2020 mechanics, with simplified or incomplete combat, armor, skill, martial arts, and migration behavior.

**Supporting indicators:** Prior brownfield documentation found comments and code paths marked partial/incomplete.

**Would confirm:** Specific mismatches between code behavior and corebook rules with page references.

**Would refute:** Evidence that the implemented mechanics match the relevant corebook rules or are intentionally scoped deviations.

**Resolution:** Confirmed by the audit. The implementation has correct foundations in some formulas, but central combat outcomes are incomplete or divergent from the corebook.

### Hypothesis 2: Architecture risks block reliable mechanical correctness

**Status:** Confirmed

**Theory:** Direct mutation, un-awaited Foundry updates, and tightly coupled combat roll flows can produce incorrect or inconsistent runtime state even where formulas are nominally correct.

**Supporting indicators:** Prior source scan observed direct `system` mutation and un-awaited update patterns.

**Would confirm:** Cited code paths where state changes or rolls can race, bypass persistence, or diverge from sheet state.

**Would refute:** Evidence that each risky path is derived-only, intentionally transient, or safely sequenced.

**Resolution:** Confirmed by un-awaited updates, direct mutation, item-centric chat roll logic, and target data that lacks actor context.

## Missing Evidence

| Gap | Impact | How to Obtain |
| --- | --- | --- |
| Live Foundry runtime behavior | Cannot confirm UI/runtime side effects or persistence behavior. | Run targeted manual Foundry checks after static audit. |
| Exact OCR accuracy for every rule page | Extracted Markdown may contain OCR errors. | Use extracted text for navigation; verify exact page in PDF for final decisions. |
| Intended project scope/deviations | Some simplifications may be intentional. | Mark deviations as "unconfirmed intent" unless README/code documents intent. |

## Source Code Trace

| Element | Detail |
| --- | --- |
| Error origin | N/A; exploration case, not a single runtime error. |
| Trigger | User requested mechanical faithfulness and architecture correctness investigation. |
| Condition | Existing Foundry system has unknown authorship and no automated test harness. |
| Related files | `module/actor/actor.js`, `module/item/item.js`, `module/dice.js`, `module/lookups.js`, `template.json`, `packs/*.db`, `docs/cyberpunk-2020-core-rules-extracted.md` |

## Conclusion

**Confidence:** High

Static investigation is concluded. Cyberpunk2020VTT is mechanically partial, not currently faithful to CP2020 core combat rules. The prioritized audit is in `_bmad-output/implementation-artifacts/investigations/corebook-mechanical-faithfulness-audit.md`.

## Recommended Next Steps

### Fix direction

Extract a mechanics resolver layer before broad UI refactor. Highest priority: damage resolution, armor/AP/layering, target-aware hit locations, suppressive fire, opposed melee/martial state, and state-persistence cleanup.

### Diagnostic

Verify the audit findings in a live Foundry world after adding focused fixtures. The static audit did not run Foundry.

## Reproduction Plan

Use fixture scenarios from the audit verification plan: single shot into armor, AP shot, layered armor, head hit, limb-loss damage, full-auto multi-target rounding, suppressive fire zone, opposed melee, martial grapple/throw/choke, and cyberware humanity roll persistence.

## Side Findings

- `git status` could not be run because the workspace is not currently inside a Git repository root.

## Follow-up: 2026-05-24

### New Evidence

- Targeted code scan completed for `module/actor/actor.js`, `module/item/item.js`, `module/lookups.js`, `module/utils.js`, `module/item/item-sheet.js`, `module/actor/actor-sheet.js`, `module/migrate.js`, `template.json`, and `system.json`.
- Targeted corebook references collected from extracted pages 101, 103, 105-111, 115-116, and 77-79.
- Audit artifact created at `_bmad-output/implementation-artifacts/investigations/corebook-mechanical-faithfulness-audit.md`.

### Additional Findings

- P0: Damage resolution pipeline is absent.
- P0: Armor layering/AP are missing or mechanically wrong.
- P0: Suppressive fire is exposed but not implemented.
- P0: Melee/martial arts lack complete opposed and stateful rules.
- P1: Full auto has rounding/ammo/target-context defects.
- P1: Critical/fumble/reliability jam behavior is incomplete.
- P1: Humanity formula is mostly aligned, but roll persistence is broken.
- P2: Async/direct mutation/migration patterns threaten mechanical state correctness.

### Updated Hypotheses

- Hypothesis 1 confirmed.
- Hypothesis 2 confirmed.

### Backlog Changes

- Static audit backlog is complete except exhaustive pack-by-pack data conformance and live Foundry verification.

### Updated Conclusion

The project can be made faithful without throwing away the whole Foundry system, but correctness requires a focused mechanics-core refactor. Patching individual chat cards or sheets will not be enough because target state, armor, damage, saves, and ammo must be resolved as one transaction.
