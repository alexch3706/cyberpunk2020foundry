---
baseline_commit: 20c182310d61ba7808138578df143b334a144ff3
---

# Story 7.2: Refactor Cover SP Input and Ablation

Status: in-progress

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As a referee,
I want to manually input cover SP and have ablation apply to cover instead of personal armor through sequential resolution,
so that cover protects actors properly without breaking their personal armor.

## Acceptance Criteria

1. Given a ranged attack is launched in Corebook Fidelity Mode, when the modifiers dialog opens, then the referee can enter a non-negative manual Cover SP value and that value is passed into the structured resolver as `action.options.cover` or equivalent plain action data.
2. Given a target is behind cover and also has personal armor, when an attack hits, then damage is resolved against cover first and only the remaining penetrating damage is resolved against personal armor. Cover must not participate in proportional armor layering with personal armor.
3. Given damage penetrates manually entered cover, when staged penetration is enabled, then cover ablation is represented on the hit evidence/chat data and accumulated across multiple hits in the same outcome; personal armor must remain unablated unless damage also penetrates the personal armor stage.
4. Given manually entered cover is not backed by a Foundry Item document, when combat updates are planned and confirmed, then no `embeddedItemUpdates` are emitted for cover. The persisted armor update plan must only include real actor-owned armor/cyberware items that were actually penetrated after cover resolution.
5. Given existing ranged, burst, full-auto, suppressive, melee, and martial resolver paths already call the armor pipeline, when cover support changes, then existing fixture behavior for no-cover attacks, AP, BTM, wounds, saves, ammo, chat preview/confirm, and manual target fallback remains intact.

## Tasks / Subtasks

- [ ] Add referee Cover SP input to the existing modifiers dialog path. (AC: 1)
  - [ ] Extend `rangedModifiers()` in `module/lookups.js` with a numeric cover field, preferably `coverSp` or a grouped `cover.sp` value that can be normalized cleanly.
  - [ ] Add localization keys for the new visible label/help text in `lang/en.json`, `lang/es.json`, and `lang/it.json`, or document intentional fallback behavior if only English is added.
  - [ ] Remove or replace the Corebook Fidelity warning in `templates/dialog/modifiers.hbs` that currently says cover input is deferred.
  - [ ] Normalize blank, missing, negative, and non-numeric cover input to "no cover" before the resolver sees it.
- [ ] Pass cover input through the current adapter contract. (AC: 1, 5)
  - [ ] Update `CyberpunkItem.__buildCombatActionOptions()` in `module/item/item.js` to convert modifier form data into plain resolver data like `{ cover: { stoppingPower, name: "Cover", source: "manual cover" } }`.
  - [ ] Keep the existing `normalizeSelectedTargets()` and `__buildCombatResolverContext()` flow; do not add a parallel combat launch path.
- [ ] Refactor cover math in `module/combat/armor-resolver.js`. (AC: 2, 3, 4)
  - [ ] Stop mixing manual cover into `calculateProportionalStoppingPower(layers)`.
  - [ ] Return enough structured armor evidence for each hit to distinguish `cover` mitigation from `personalArmor` mitigation.
  - [ ] Resolve personal armor layers with the existing cyberware/armor proportional logic after cover has been applied.
  - [ ] Preserve current layer ordering and warnings for personal armor/cyberware; cover-specific hard/soft warnings should not create false multi-hard warnings against personal armor.
  - [ ] Preserve AP behavior explicitly and fixture-cover the chosen rule: AP must be applied consistently to the cover stage and personal armor stage, with evidence showing the pre/post SP values.
- [ ] Route ablation to cover evidence before item-backed armor. (AC: 3, 4)
  - [ ] Update `buildStagedPenetrationEvidence()` in `module/combat/attack-resolver.js` or the armor output it consumes so a penetrated cover stage does not select the personal armor layer just because it is the last item-backed layer.
  - [ ] For manual cover, emit hit-level evidence such as `cover.ablation.before`, `cover.ablation.after`, `cover.ablation.applied`, and `reason: "penetrated-manual-cover"` without creating Foundry item updates.
  - [ ] For multi-hit outcomes, accumulate temporary cover ablation in the per-target snapshot/action state so later hits in the same attack use the reduced cover SP.
  - [ ] If damage remains after cover and then penetrates personal armor, existing item-backed staged penetration can still apply to the personal layer.
- [ ] Preserve commit and chat contracts. (AC: 3, 4, 5)
  - [ ] Keep `state-planner.js` and `combat-commit.js` update order unchanged: attacker ammo, embedded armor updates, actor damage, save state, chat.
  - [ ] Update `combat-chat.js` and `templates/chat/combat-outcome.hbs` only if existing evidence fields are insufficient to show cover mitigation/ablation.
  - [ ] Do not persist manual cover ablation to an actor/item document; the referee must enter the current cover SP on the next attack until map-object cover exists.
- [ ] Add deterministic fixture coverage. (AC: 1, 2, 3, 4, 5)
  - [ ] Replace the existing "manual cover as armor layer" expectation in `tests/combat/fixtures/ranged-single-shot.json`.
  - [ ] Add cases for: cover stops all damage; cover penetrated but personal armor is not reached; cover penetrated and remaining damage reaches personal armor; multi-hit cover ablation within one outcome; AP shot with cover; no-cover regression.
  - [ ] Update direct assertions in `tests/combat/combat-fixtures.test.js` that currently expect cover to be appended as an armor layer.
  - [ ] Regenerate/update `tests/combat/fixture-coverage-map.md`.
- [ ] Update manual verification docs. (AC: 1, 2, 3, 4)
  - [ ] Update `docs/testing/foundry-manual-checks.md` section 6.2 so it matches sequential cover behavior.
  - [ ] Update `docs/combat-mechanics-audit.md` and `_bmad-output/implementation-artifacts/deferred-work.md` to remove or narrow the cover input/sequential/cover-ablation deferred notes after implementation.

### Review Findings

- [x] [Review][Patch] Manual cover object input is dropped by `__normalizeManualCover` when `attackMods.cover` is an object because `Number(attackMods.cover)` becomes `NaN` before nested `sp/stoppingPower` fallback is reached. [/Users/alexanderchuprikov/Documents/Code/Tabletop/Cyberpunk2020VTT/module/item/item.js:357]
- [x] [Review][Patch] Cover ablation evidence is not preserved in the `missing-target-actor-uuid` branch, so multi-hit temporary cover ablation can fail to carry forward when personal armor also penetrates. [/Users/alexanderchuprikov/Documents/Code/Tabletop/Cyberpunk2020VTT/module/combat/attack-resolver.js:1588]
- [x] [Review][Patch] Cover ablation can become `NaN` because `Number(armor.cover?.ablation || 0)` does not guard truthy non-numeric values; this can corrupt staged cover ablation accumulation. [/Users/alexanderchuprikov/Documents/Code/Tabletop/Cyberpunk2020VTT/module/combat/attack-resolver.js:1530]
- [x] [Review][Patch] Deterministic fixture coverage required by story 7.2 is incomplete: the diff updates only direct assertions but does not add/replace the required cover scenarios in `ranged-single-shot` fixtures. [/Users/alexanderchuprikov/Documents/Code/Tabletop/Cyberpunk2020VTT/tests/combat/fixtures/ranged-single-shot.json:1]
- [x] [Review][Patch] Fixture coverage map was not regenerated/updated after cover behavior changes. [/Users/alexanderchuprikov/Documents/Code/Tabletop/Cyberpunk2020VTT/tests/combat/fixture-coverage-map.md:1]
- [x] [Review][Patch] Manual verification and deferred-gap docs were not updated to reflect implemented sequential cover/ablation behavior. [/Users/alexanderchuprikov/Documents/Code/Tabletop/Cyberpunk2020VTT/docs/testing/foundry-manual-checks.md:1]

## Dev Notes

### Current State

- `module/combat/armor-resolver.js` currently builds `layers` as equipped armor/cyberware plus `getManualCoverLayers(options.cover)`, then runs all layers through `calculateProportionalStoppingPower()`. This is the behavior to change: cover is currently a normal proportional layer, not a sequential barrier. [Source: `module/combat/armor-resolver.js`]
- Manual cover exists only as plain resolver input. It has no `updatePath`, no backing item id except `"cover"`, and should not produce Foundry document updates. [Source: `module/combat/armor-resolver.js`]
- `buildStagedPenetrationEvidence()` currently chooses the reversed last layer where `layer.type === "armor" && layer.id && layer.updatePath`. That means cover cannot receive ablation, and personal armor can be selected after cover is penetrated. This is the core routing bug for AC3/AC4. [Source: `module/combat/attack-resolver.js`]
- Multi-hit paths already use a mutable `targetSnapshotCopy` and `accumulatedAblations` to make later hits see earlier armor ablation. Reuse this pattern for temporary cover ablation inside the same outcome. [Source: `module/combat/attack-resolver.js`]
- `templates/dialog/modifiers.hbs` currently renders a Corebook Fidelity warning: cover SP input is deferred and cover ablation must be tracked manually. This must be replaced by actual input behavior. [Source: `templates/dialog/modifiers.hbs`]
- `module/dialog/modifiers.js` mutates `data.modifierGroups` by pushing the Extra Mod field during `getData()`. Avoid adding cover fields in a way that duplicates them on repeated renders. [Source: `module/dialog/modifiers.js`]
- `combat-commit.js` already awaits Foundry update APIs in deterministic order and blocks unsafe/manual plans. Do not bypass this flow. [Source: `module/combat/combat-commit.js`; `docs/resolver-contracts.md#Commit Flow`]

### Required Implementation Shape

- Keep the resolver pure. `armor-resolver.js` may return richer plain evidence, but it must not call Foundry globals, `Actor`, `Item`, `ChatMessage`, `game`, or document update APIs. [Source: `_bmad-output/project-context.md#Framework-Specific Rules`; `docs/resolver-contracts.md#Data Flow`]
- Keep `CombatOutcome` as the source of truth for preview, chat, tests, and commit. Do not calculate cover math separately in chat templates or the commit adapter. [Source: `_bmad-output/planning-artifacts/architecture.md#AD-2`; `docs/resolver-contracts.md#Chat Derivation`]
- Preferred algorithm for each hit:
  1. Normalize manual cover SP after current temporary cover ablation.
  2. Resolve cover stage first. If cover effective SP fully stops damage, final personal armor mitigation is zero and no personal armor staged penetration occurs.
  3. If damage remains after cover, resolve equipped personal armor/cyberware through the existing proportional armor logic.
  4. Apply BTM/minimum damage only after both cover and personal armor stages.
  5. Build hit evidence with separate cover mitigation, personal armor mitigation, total armor mitigation, penetrating damage, BTM mitigation, final damage, and staged penetration details.
- If AP semantics are ambiguous, preserve current project behavior as much as possible and make the evidence explicit: show raw cover SP, AP-adjusted cover SP, raw personal armor SP, AP-adjusted personal armor SP, and penetrating damage before/after AP divisor.

### Files To Update

| Path | Update |
| --- | --- |
| `module/lookups.js` | Add the ranged modifier field for manual cover SP. |
| `module/dialog/modifiers.js` | Only if needed for safe form normalization or avoiding duplicate generated fields. |
| `templates/dialog/modifiers.hbs` | Remove deferred warning; keep existing FormApplication rendering pattern. |
| `module/item/item.js` | Normalize form values into resolver action options with `cover`. |
| `module/combat/armor-resolver.js` | Implement sequential cover and richer armor evidence. |
| `module/combat/attack-resolver.js` | Consume new armor evidence and route staged penetration/ablation correctly. |
| `module/combat/combat-outcome.js` | Update JSDoc typedefs if new hit/armor evidence fields are public contract fields. |
| `module/combat/combat-chat.js` and `templates/chat/combat-outcome.hbs` | Update only if chat cannot already display the new evidence clearly. |
| `tests/combat/fixtures/ranged-single-shot.json` | Replace old cover-as-layer expectations and add cover regression cases. |
| `tests/combat/combat-fixtures.test.js` | Update direct armor resolver assertions and any evidence assertions. |
| `tests/combat/fixture-coverage-map.md` | Regenerate/update after fixtures change. |
| `docs/testing/foundry-manual-checks.md` | Update Foundry manual cover verification. |
| `docs/combat-mechanics-audit.md` and `_bmad-output/implementation-artifacts/deferred-work.md` | Retire/narrow resolved cover gaps. |
| `lang/en.json`, `lang/es.json`, `lang/it.json` | Add visible strings for cover input. |

### Project Structure Notes

- This is a FoundryVTT system package loaded directly from `system.json`; do not introduce npm tooling, TypeScript, a frontend framework, or a separate app runtime. [Source: `_bmad-output/project-context.md#Technology Stack & Versions`]
- Runtime modules are plain JavaScript ES modules. Keep imports relative and compatible with Foundry's browser/Electron runtime. [Source: `_bmad-output/project-context.md#Language-Specific Rules`]
- Persisted state changes must go through Foundry document APIs. Manual cover is not persisted because it is not a document-backed scene object in MVP. [Source: `_bmad-output/project-context.md#Critical Implementation Rules`]
- No UX redesign is needed. Use the existing modifiers dialog and existing chat card style. [Source: `_bmad-output/planning-artifacts/architecture.md#AD-5`]

### Previous Story Intelligence

- Story `7-1-automate-damage-and-targeting` is marked `done` in sprint status, but no `7-1-*.md` story file exists under `_bmad-output/implementation-artifacts`. Use current code and recent commits as the implementation record.
- Recent commit `53bffc4` refactored combat for Foundry v12 async `Roll.evaluate()` and touched `module/actor/actor.js`, `module/combat/attack-resolver.js`, and `module/combat/combat-resolver.js`. Preserve the async resolver shape and await roll evaluation.
- Recent commit `20c1823` updated `tests/combat/combat-fixtures.test.js` so fixture tests await async `resolveCombatAction()`. Any new fixture tests must keep that async pattern.
- The working tree already has unrelated/user changes in docs, packs, `system.json`, `test-armor.mjs`, and `tools/`. Do not revert or normalize those while implementing this story.

### Testing Requirements

- Run the fixture suite with the existing Node entrypoint if available:

```bash
node tests/run-combat-fixtures.mjs
```

- Also run targeted direct tests if changed:

```bash
node --test tests/combat/combat-fixtures.test.js
```

- If Node/Foundry globals are unavailable for a test path, report the limitation honestly and verify with static review plus fixture-level reasoning.
- Manual Foundry verification should cover: actor sheet attack launch, selected target, Cover SP input, preview/confirm, chat evidence, target damage persistence, personal armor non-ablation when only cover is penetrated, and personal armor ablation when damage penetrates through cover into armor.

### Latest Technical Notes

- Foundry v12 `Dialog` remains valid for modal choices and callbacks; the official v12 API documents `Dialog` as a window with configurable title/content/buttons and callback functions. Keep the existing `Dialog`/`FormApplication` approach unless a broader AppV2 migration is explicitly requested. [Source: Foundry VTT API v12 Dialog, https://foundryvtt.com/api/v12/classes/client.Dialog.html]
- Foundry v12 still exposes ChatMessage as a primary client document type, and the existing project adapter already treats chat create/update paths as async operations. Preserve the current awaited commit discipline instead of introducing fire-and-forget chat or document updates. [Source: Foundry VTT API v12 ChatMessage, https://foundryvtt.com/api/v12/classes/client.ChatMessage.html; `module/combat/combat-commit.js`]

### References

- Epic/story source: `_bmad-output/planning-artifacts/epics.md#Story 7.2`
- PRD armor requirements: `_bmad-output/planning-artifacts/prds/prd-Cyberpunk2020VTT-2026-05-24/prd.md#FR-10` and `#FR-11`
- Architecture resolver boundary: `_bmad-output/planning-artifacts/architecture.md#AD-1`, `#AD-2`, `#AD-3`, `#AD-6`
- Project context: `_bmad-output/project-context.md`
- Current cover gap: `docs/combat-mechanics-audit.md#Armor & Cover`
- Current deferred work: `_bmad-output/implementation-artifacts/deferred-work.md#Deferred from: code review of 4-1-migrate-three-round-burst-to-resolver-outcome.md`
- Resolver contract: `docs/resolver-contracts.md`
- Manual check section: `docs/testing/foundry-manual-checks.md#6.2 Armor Layering & Cover`

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References
- 2026-05-31: Updated combat modifiers flow to collect manual `coverSp` and normalize into structured `action.options.cover`.
- 2026-05-31: Refactored armor resolver to sequential cover-first model (`cover` stage then proportional personal armor stage), with AP evidence split by stage.
- 2026-05-31: Updated staged penetration routing in attack resolver to support manual cover ablation evidence without embedded item updates.
- 2026-05-31: Validation run: `node --test tests/combat/combat-fixtures.test.js` passed.
- 2026-05-31: Validation run: `node tests/run-combat-fixtures.mjs` failed at `attack request.rollData.skill.handgun` expectation mismatch; requires fixture/context follow-up before marking story complete.

### Completion Notes List
- Implemented UI and adapter plumbing for manual cover SP input (`CoverSP`) and removed deferred warning in modifiers dialog.
- Implemented sequential mitigation pipeline where cover mitigation is resolved before personal armor mitigation.
- Added manual cover staged penetration evidence (`reason: penetrated-manual-cover`) and per-target multi-hit temporary cover ablation carry-over.
- Updated direct armor resolver assertions to align with stage-aware AP evidence and cover warning semantics.

### File List
- `module/lookups.js`
- `templates/dialog/modifiers.hbs`
- `module/item/item.js`
- `module/combat/armor-resolver.js`
- `module/combat/attack-resolver.js`
- `lang/en.json`
- `lang/es.json`
- `lang/it.json`
- `tests/combat/combat-fixtures.test.js`

### Change Log
- 2026-05-31: Started implementation of Story 7.2; cover-first sequential armor resolution and manual cover ablation evidence are now in progress.
