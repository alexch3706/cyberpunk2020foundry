---
created: 2026-06-13
baseline_commit: 32ab5c2
implementation_commit: 88b20b3614d4a2fd5aad0d8c6ab662a4841e9bad
---

# Story 8.5: Add Attack Die Entry Prompt

**Status**: Done
**Assignee**: Alex
**Progress**: 100%
**Last Updated**: 2026-06-13

## Story

As a referee running a shared physical table,
I want to choose automatic rolling or manual attack d10 entry when an attack is triggered,
so that players can roll their own physical attack die while the VTT still applies skills, modifiers, hit resolution, damage, armor, wounds, and evidence.

## Acceptance Criteria

1. Given the table uses the normal combat attack flow, when the attack die entry setting is configured for prompting, then starting a ranged, melee, or martial attack allows the GM to choose automatic rolling or manual attack d10 entry.
2. Given automatic rolling is chosen, when the attack resolves, then the existing automated attack flow is preserved.
3. Given manual entry is chosen, when the GM enters a value, then the natural d10 attack value is applied before skill/stat/modifier math.
4. Given manual `1` is entered, when the attack resolves, then existing fumble/jam behavior is preserved where applicable.
5. Given manual `10` is entered, when the prompt validates the value, then exactly one explosion follow-up value is required.
6. Given manual `10,10` is entered, when the attack resolves, then the total attack die contribution is 20 and no further explosion is allowed.
7. Given invalid values or chained explosions are entered, when the prompt or resolver validates input, then the value is rejected before resolution.
8. Given manual attack die entry is used, when damage resolution continues, then automated damage, hit location, armor, wound, and chat evidence flows continue through the existing resolver pipeline.
9. Given Luck is used at the table, when this MVP story is complete, then Luck remains referee-managed through existing extra modifiers rather than becoming a tracked resource.
10. Given fixture coverage is added, when tests run, then automatic/manual paths are covered for ranged attack and focused shared-seam coverage exists for melee and martial attacks.

## Tasks / Subtasks

- [x] Add world-level attack die entry setting. (AC: 1, 2)
  - [x] Register `attackDieEntryMode` with `auto` and `prompt` choices.
  - [x] Default existing worlds to `auto`.
  - [x] Add localized setting labels and hints.
- [x] Add attack launch prompt integration. (AC: 1, 2, 7)
  - [x] Prompt from the actor sheet attack confirmation flow only when the resolver setting resolves to `prompt`.
  - [x] Preserve the automatic path when the GM selects Auto.
  - [x] Cancel attack launch cleanly if the prompt closes without a valid selection.
- [x] Add manual attack die resolver support. (AC: 3, 4, 5, 6, 7, 8, 9)
  - [x] Add `module/combat/attack-die-entry.js`.
  - [x] Parse compact manual input such as `7` or `10,6`.
  - [x] Reject missing explosion follow-up, non-d10 values, and chained explosions.
  - [x] Wrap only attack roll requests so defender rolls, damage rolls, and hit-location rolls continue through the base roller.
  - [x] Mark manual die metadata with natural result, result list, explosion state, and source.
- [x] Add setting helper coverage. (AC: 1, 2)
  - [x] Centralize `getAttackDieEntryMode()` in `settings-helpers.js`.
  - [x] Support explicit test/action overrides without requiring Foundry globals.
- [x] Add regression coverage. (AC: 3, 5, 6, 7, 10)
  - [x] Verify manual ranged `10,7` applies before stat and skill math and records both dice.
  - [x] Verify manual melee `9` shares the same attack-roll seam.
  - [x] Verify manual martial `10,10` applies one explosion pair before stat, skill, and key technique math.
  - [x] Verify `10` and `10,10,4` are rejected.
  - [x] Verify default attack die setting behavior is `auto` and option override can select `prompt`.

## Dev Notes

### Implementation Summary

- The implementation landed in commit `88b20b3614d4a2fd5aad0d8c6ab662a4841e9bad` (`Add manual attack die entry prompt`).
- Runtime prompt support lives in `module/combat/attack-die-entry.js`.
- `resolveCombatAction()` wraps the active/test roller with `buildAttackDieEntryRoller()` when `options.manualAttackDie` is present.
- The wrapper intercepts only `request.id === "attack"` and delegates all other roll requests to the original roller.
- Actor sheet attack launch now calls `promptAttackDieEntry()` inside the existing `ModifiersDialog` `onConfirm` path when `attackDieEntryMode` resolves to `prompt`.
- The prompt uses compact input format only: normal values `1`-`9`, or one explosion pair such as `10,7`.
- Luck remains outside this feature and continues through existing modifiers.

### Files Updated By Implementation Commit

| Path | Purpose |
| --- | --- |
| `module/settings.js` | Registers `attackDieEntryMode` world setting. |
| `module/combat/settings-helpers.js` | Adds `getAttackDieEntryMode()` helper with test overrides and Foundry fallback. |
| `module/combat/attack-die-entry.js` | Adds prompt, parser, and manual attack roller wrapper. |
| `module/combat/combat-resolver.js` | Wraps resolver roller with manual attack die support. |
| `module/actor/actor-sheet.js` | Invokes prompt from the existing attack modifier confirmation flow. |
| `lang/en.json` | Adds English labels. |
| `lang/es.json` | Adds Spanish labels. |
| `lang/it.json` | Adds Italian labels. |
| `tests/combat/combat-fixtures.test.js` | Adds resolver and settings helper assertions. |

### Verification

- Implementation commit added focused Node assertions in `tests/combat/combat-fixtures.test.js` for ranged, melee, martial, invalid explosion input, and settings helper behavior.
- Current story file was reconstructed after implementation from the committed code and git history; no code changes were made as part of this artifact restoration.

### Known Caveats

- Manual prompt UI verification still requires a live Foundry world because `Dialog` and actor-sheet interaction are Foundry runtime surfaces.
- Manual input intentionally uses compact text input for MVP. A guided two-step explosion UI remains a possible UX refinement.

## Dev Agent Record

### Agent Model Used

Codex

### Debug Log References

- `git show --stat 88b20b3`
- `rg "manualAttackDie|attackDieEntryMode|promptAttackDieEntry" module tests`

### Completion Notes List

- Restored missing BMad implementation artifact for already completed Story 8.5.
- Story status matches `_bmad-output/implementation-artifacts/sprint-status.yaml`, where `8-5-add-attack-die-entry-prompt` is marked `done`.
- The artifact records the implementation commit and maps the shipped code to the original acceptance criteria.

### File List

- `_bmad-output/implementation-artifacts/8-5-add-attack-die-entry-prompt.md`
