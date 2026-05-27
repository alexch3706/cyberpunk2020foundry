# Story 3.3: Apply Armor Piercing and Staged Penetration

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a referee,
I want AP and staged penetration effects to be applied explicitly,
so that penetrating hits produce correct damage and auditable armor state changes.

## Acceptance Criteria

1. Given an AP weapon hits armored target coverage
   When armor and damage resolution runs
   Then the outcome explicitly shows raw armor SP, AP-adjusted effective SP, AP penetrating-damage reduction, and final post-armor damage evidence.
2. Given damage penetrates item-backed armor coverage
   When staged penetration is enabled
   Then the outcome includes auditable staged penetration/ablation planned updates for only the affected armor item and hit location.
3. Given damage does not penetrate armor, the affected layer is manual cover only, or no item-backed coverage update path can be derived
   When staged penetration is evaluated
   Then no invalid persisted armor update is planned and the outcome still includes clear evidence or warnings for referee review.
4. Given staged penetration is disabled through the explicit setting/input
   When damage penetrates armor
   Then damage resolution still works, no staged penetration item update is planned, and chat/test evidence shows that staged penetration was disabled.
5. Given fixture checks are run
   When `node tests/run-combat-fixtures.mjs` executes
   Then AP armor behavior, AP penetrating-damage halving, staged penetration enabled, staged penetration disabled, and no-update edge cases are covered.

## Tasks / Subtasks

- [x] Make AP behavior explicit in armor and hit evidence. (AC: 1)
  - [x] Update `module/combat/armor-resolver.js` so `resolveArmor()` returns stable AP evidence beyond the existing boolean, including raw proportional SP and AP-adjusted effective SP.
  - [x] Preserve the current AP rule already wired in `module/combat/attack-resolver.js`: AP halves applicable armor SP before mitigation and halves remaining penetrating damage after mitigation. Do not double-apply the penetrating-damage halving.
  - [x] Prefer explicit fields such as `rawStoppingPower`, `effectiveStoppingPower`, `armorPiercing`, and a post-armor/AP damage evidence object or scalar that tests and chat can inspect.
  - [x] Keep Story 3.2 proportional armor, manual cover, Skinweave soft classification, and warning behavior intact.
- [x] Implement staged penetration planning from item-backed armor coverage. (AC: 2, 3)
  - [x] Extend armor layer snapshots with enough metadata to plan an embedded item update: item id, original coverage key, current ablation/staged penetration value, and update path.
  - [x] Preserve case-insensitive location matching, but do not lose the original coverage key. Existing actor/item data may use keys such as `Torso`, while fixtures may use `torso`.
  - [x] Account for existing ablation/staged penetration when calculating usable layer SP. If the persisted model stores base SP plus `coverage.<location>.ablation`, effective layer SP should not ignore that accumulated reduction.
  - [x] When the attack penetrates and staged penetration is enabled, plan a single +1 ablation/staged penetration update for the affected item-backed armor location.
  - [x] Do not plan item updates for manual cover layers. If cyberware armor lacks a reliable persisted coverage path, represent the limitation as warning/evidence rather than inventing an unsafe update path.
  - [x] Ensure updates use the existing planner/commit contract: `embeddedItemUpdates: [{ actorUuid, type: "Item", updates: [{ _id, "system.coverage.<locationKey>.ablation": nextValue }] }]`.
- [x] Add and consume the staged penetration setting. (AC: 4)
  - [x] Add `stagedPenetration` to `module/settings.js` as a world setting with default `true`, following Architecture AD-8.
  - [x] Keep resolver code Foundry-independent. The attack orchestration layer may read/pass the setting, but `armor-resolver.js` must work from plain options for fixture tests.
  - [x] Support deterministic fixture input, for example an action/resolver option that overrides staged penetration enabled/disabled without requiring Foundry globals.
  - [x] Add localization keys for user-visible setting name/hint in `lang/en.json`, `lang/es.json`, and `lang/it.json`.
- [x] Wire staged penetration evidence into the single-shot outcome. (AC: 1, 2, 3, 4)
  - [x] Update `module/combat/attack-resolver.js` so penetrating hits include staged penetration evidence on the hit and planned updates on the target outcome or existing planned-update surface.
  - [x] Ensure `planCombatUpdates()` collects the generated embedded item update without direct document mutation.
  - [x] Keep commit order compatible with `module/combat/combat-commit.js`: ammo/source item updates, target embedded armor updates, target actor updates, then chat.
  - [x] Preserve preview/confirm behavior. This story plans updates; it must not directly call Foundry `update()` or `updateEmbeddedDocuments()` from the resolver path.
- [x] Keep adjacent damage stories out of scope. (AC: 1)
  - [x] Do not complete BTM/minimum damage correctness here; Story 3.4 owns it.
  - [x] Do not implement wound state, special damage cases, stun saves, or death saves here; Stories 3.5 and 3.6 own those behaviors.
  - [x] Do not change automatic fire, melee, or suppressive fire behavior.
- [x] Add fixture and direct unit coverage. (AC: 5)
  - [x] Extend `tests/combat/combat-fixtures.test.js` direct resolver assertions for AP evidence, existing ablation reducing usable SP, original coverage key preservation, and manual cover no-update behavior.
  - [x] Add or extend fixture cases under `tests/combat/fixtures/` for AP penetration with staged penetration enabled and disabled.
  - [x] Assert planned embedded item update shape and update path exactly, including `_id` and `system.coverage.<originalLocationKey>.ablation`.
  - [x] Assert no staged update is planned when damage fails to penetrate.
  - [x] Run `node tests/run-combat-fixtures.mjs` and record the result in the Dev Agent Record.

### Review Findings

- [x] [Review][Decision] Clarify which armor layer receives staged penetration in layered armor — Resolved: staged penetration ablates the outer item-backed armor layer first; manual cover does not receive persisted ablation.
- [x] [Review][Patch] Resolver reads Foundry setting directly [module/combat/attack-resolver.js:314]
- [x] [Review][Defer] Multiple penetrations against the same armor item can collapse to one ablation [module/combat/attack-resolver.js:393] — deferred, future multi-hit outcomes should plan cumulative armor ablation instead of repeated absolute `before + 1` updates from one snapshot.
- [x] [Review][Defer] Stale preview can overwrite newer armor ablation on confirm [module/combat/attack-resolver.js:395] — deferred, broader preview/confirm concurrency needs a current-value check, version guard, or delta-style update for armor ablation.

## Dev Notes

- Story 3.2 is complete in commit `5d6e895 Resolve effective armor layering and cover`. Start from that behavior, not from the older Story 3.2 story text that described AP and staged penetration as future work.
- Current `resolveArmor(weaponAP, targetSnapshot, location, options = {})` already returns `layers`, `rawStoppingPower`, `effectiveStoppingPower`, `armorPiercing`, and `warnings`.
- Current `attack-resolver.js` already halves AP penetrating damage after armor mitigation:
  `if(armor.armorPiercing && penetratingDamage > 0) penetratingDamage = Math.floor(penetratingDamage / 2);`
  Story 3.3 should make this auditable and fixture-covered, not apply the reduction a second time.
- Current `getArmorCoverageForLocation()` returns only the coverage value. Staged penetration needs the matched key as well as the value so update paths preserve persisted data shape.
- The existing item coverage model stores `stoppingPower` and `ablation`. Treat `ablation` as accumulated staged penetration loss unless implementation discovers a stronger local schema convention.
- `state-planner.js` already collects `plannedUpdates.embeddedItemUpdates` and `embeddedItemDeltas`; prefer using that contract instead of adding another planner surface.
- `combat-commit.js` already applies embedded item updates with awaited Foundry APIs. Do not bypass it.
- `module/settings.js` currently has only `systemMigrationVersion` and `trainedSkillsFirst`; Architecture AD-8 expects combat fidelity settings to be added here.
- This project has no package manager setup for combat fixtures. Keep tests plain Node and do not add `package.json`, npm scripts, TypeScript, Jest, or new dependencies.
- All runtime resolver data must remain JSON-serializable plain data because fixtures and state planning clone/compare plain objects.

### Current Files To Read Before Editing

- `module/combat/armor-resolver.js`
  - Current state: resolves equipped armor/cyberware/manual cover layers, proportional SP, AP-adjusted effective SP, and layer warnings.
  - Change for this story: expose AP/post-armor damage evidence and layer metadata needed for staged penetration update planning.
  - Preserve: no Foundry globals, proportional armor table, cover as temporary layer, warning codes, pack-style cyberware SP parsing, Skinweave soft default.
- `module/combat/attack-resolver.js`
  - Current state: rolls damage, calls `resolveArmor()`, applies armor mitigation, halves AP penetrating damage, applies temporary BTM/final damage calculation, and stores armor evidence on `hitDetail`.
  - Change for this story: pass staged penetration options/settings, add explicit AP evidence, and attach staged penetration evidence/planned updates.
  - Preserve: deterministic roller contract, manual hit location support, ammo planning, preview/confirm flow, Story 3.4 BTM scope boundary.
- `module/combat/state-planner.js`
  - Current state: merges `plannedUpdates.embeddedItemUpdates` and `embeddedItemDeltas` into planned combat updates.
  - Change for this story: likely none unless generated updates reveal an unsupported shape.
- `module/combat/combat-commit.js`
  - Current state: applies embedded item updates before actor updates.
  - Change for this story: likely none; verify staged penetration update batches are compatible.
- `module/combat/combat-chat.js`
  - Current state: derives chat data from outcome/hit evidence.
  - Change for this story: surface AP/staged penetration evidence if current generic hit evidence is insufficient.
- `module/settings.js`
  - Current state: registers migration and trained-skills settings only.
  - Change for this story: add `stagedPenetration` world setting defaulting to `true`.
- `lang/en.json`, `lang/es.json`, `lang/it.json`
  - Current state: localization for settings and UI labels.
  - Change for this story: add setting labels/hints if the setting is user-visible.
- `tests/combat/combat-fixtures.test.js`
  - Current state: direct combat resolver tests and fixture runner.
  - Change for this story: add AP/staged penetration direct assertions and fixture expectations.
- `tests/combat/fixtures/ranged-single-shot.json`
  - Current state: baseline single-shot fixture with armor evidence.
  - Change for this story: extend carefully or add a separate fixture if the new staged penetration case would make the baseline hard to read.

### Project Structure Notes

- Pure mechanics stay in `module/combat/`.
- Foundry-specific setting reads and document updates must stay outside pure resolver functions.
- Do not rely on `CyberpunkActor.prepareData()` display-only `system.hitLocations[area].stoppingPower` for rules correctness.
- Do not edit compendium `.db` files for this story.
- Do not edit `template.json` unless implementation proves a persisted field is unavoidable. If it changes, document migration impact.
- Do not mutate item or actor documents during resolution. Generate planned updates and let the preview/confirm commit path apply them.

### Previous Story Intelligence

- Story 3.1 created armor/AP snapshot plumbing and cyberware armor extraction.
- Story 3.2 replaced max-SP armor with proportional armor, added manual cover, and added warning evidence for too many layers and multiple hard layers.
- Review of Story 3.2 fixed pack-style `Skinweave SP12` being classified as hard armor. Preserve this regression test.
- Existing fixture warnings may include `armor-too-many-layers` and `armor-multiple-hard-layers`; staged penetration evidence should not remove those warnings.
- Current AP behavior exists but is under-tested and not sufficiently explicit in outcome/chat evidence. This story should turn it into a first-class, auditable behavior.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.3]
- [Source: _bmad-output/planning-artifacts/prds/prd-Cyberpunk2020VTT-2026-05-24/prd.md#FR-11 Armor Piercing and Staged Penetration]
- [Source: _bmad-output/planning-artifacts/architecture.md#AD-7 Armor Is Calculated at Resolution Time]
- [Source: _bmad-output/planning-artifacts/architecture.md#AD-8 Corebook Fidelity Settings]
- [Source: _bmad-output/planning-artifacts/architecture.md#AD-9 Tests Use Fixture-First Plain JS]
- [Source: _bmad-output/implementation-artifacts/investigations/corebook-mechanical-faithfulness-audit.md#P0 - Armor Layering and AP Are Mechanically Wrong or Missing]
- [Source: docs/cyberpunk-2020-core-rules-extracted.md:9534]
- [Source: docs/cyberpunk-2020-core-rules-extracted.md:9569]
- [Source: module/combat/armor-resolver.js]
- [Source: module/combat/attack-resolver.js]
- [Source: module/combat/state-planner.js]
- [Source: module/combat/combat-commit.js]
- [Source: module/settings.js]
- [Source: tests/combat/combat-fixtures.test.js]

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- Red phase: `node tests/run-combat-fixtures.mjs` failed before implementation because ablation did not reduce usable SP.
- Green phase: `node tests/run-combat-fixtures.mjs` passed after AP evidence, staged penetration planning, setting registration, and fixture updates.
- Localization validation: `python3 -m json.tool lang/en.json`, `lang/es.json`, and `lang/it.json` passed.
- Static check: `git diff --check` passed.

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- Implemented ablation-aware layer SP while preserving base SP and original coverage key evidence.
- Added explicit AP armor and penetrating-damage evidence without double-halving AP damage.
- Added staged penetration evidence and planned embedded armor item updates for penetrating hits.
- Added deterministic staged penetration disable input and a world setting defaulting to enabled.
- Added chat-data fields for AP, armor, penetrating damage, and staged penetration evidence.
- Kept BTM, wounds, saves, automatic fire, melee, and suppressive fire out of scope.
- Review fix: documented and fixture-covered outer item-backed armor as the staged penetration target in layered armor.
- Review fix: moved staged penetration setting access out of combat resolver code and into the Foundry item adapter options path.

### File List

- _bmad-output/implementation-artifacts/3-3-apply-armor-piercing-and-staged-penetration.md
- _bmad-output/implementation-artifacts/3-2-resolve-effective-armor-sp-with-layering-and-cover.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- lang/en.json
- lang/es.json
- lang/it.json
- module/combat/armor-resolver.js
- module/combat/attack-resolver.js
- module/combat/combat-chat.js
- module/combat/combat-outcome.js
- module/item/item.js
- module/settings.js
- tests/combat/combat-fixtures.test.js
- tests/combat/fixtures/ranged-single-shot.json

### Change Log

- 2026-05-27: Created Story 3.3 with AP, staged penetration, setting, state-planning, and fixture guidance.
- 2026-05-27: Implemented Story 3.3 AP evidence, ablation-aware SP, staged penetration planning, settings, chat evidence, and fixture coverage.
- 2026-05-27: Addressed code review findings for outer-layer staged penetration and Foundry setting coupling.

### Review Findings

- [x] [Review][Decision] Clarify which armor layer receives staged penetration in layered armor.
- [x] [Review][Patch] Resolver reads Foundry setting directly.
- [x] [Review][Defer] Multiple penetrations against the same armor item can collapse to one ablation.
- [x] [Review][Defer] Stale preview can overwrite newer armor ablation on confirm.
