# Story 2.5: Render Single-Shot Combat Evidence in Chat

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a referee,
I want single-shot combat chat to show the resolved evidence and commit status,
so that table participants can audit what happened without reading source code.

## Acceptance Criteria

1. Given a single-shot `CombatOutcome` and a status (preview, committed, canceled, manual), when the chat message is rendered, then it shows the attack total, range difficulty (DC), active modifiers, target actor details, hit/miss status, hit location on hit, ammo change, status label, and any warnings.
2. Given a preview card is created in chat, when it is subsequently committed or canceled via the preview dialog, then the existing chat card content is updated to reflect the new status (`committed` or `canceled`), rather than creating a duplicate chat card.
3. Given the chat template is rendered, then it uses the structured template data returned by `buildCombatChatData()` as its source of truth.
4. Given normal legacy actor-sheet rolls, when this story is implemented, then legacy chat card rendering paths are not broken.

## Tasks / Subtasks

- [x] Create a dedicated Handlebars template for structured combat chat. (AC: 1, 3)
  - [x] Add `templates/chat/combat-outcome.hbs` template.
  - [x] Render card header with attacker name and weapon name.
  - [x] Render attack section displaying:
    - Attack roll total, formula, and die result.
    - Target Number / Range DC.
    - Hit/Miss status.
    - Modifiers summary (e.g. range, accuracy, target number modifiers).
  - [x] Render target list (for single-shot, exactly one target):
    - Target actor/token name.
    - Hit location (if hit).
    - Status of target outcome.
  - [x] Render ammo section (shots remaining, spent delta).
  - [x] Display visual banners/indicators matching the card status (`preview`, `manual`, `committed`, `canceled`).
  - [x] Render warning block if warnings are present in `CombatOutcome` or `PlannedUpdates`.
  - [x] Preload the template in `module/templates.js` by adding `"systems/cyberpunk2020/templates/chat/combat-outcome.hbs"` to the list.
- [x] Implement chat creation and update helper in `module/combat/combat-commit.js` or `module/combat/combat-chat.js`. (AC: 2, 3)
  - [x] Export `createOrUpdateCombatChatMessage(outcome, resultStatus, options = {})` (or similar helper) that:
    - Retrieves plan using `planCombatUpdates(outcome)`.
    - Generates template data using `buildCombatChatData(outcome, plan, { status: resultStatus })`.
    - Calls `renderTemplate("systems/cyberpunk2020/templates/chat/combat-outcome.hbs", chatData)`.
    - If `options.messageId` is provided:
      - Resolves the existing `ChatMessage` via `game.messages.get(messageId)`.
      - Awaits `message.update({ content: htmlContent })` to refresh the existing chat card.
    - If `options.messageId` is not provided:
      - Awaits `ChatMessage.create({ user: game.user.id, content: htmlContent, speaker: ... })` and returns the created message ID.
- [x] Integrate chat rendering into preview and apply orchestration flow. (AC: 2)
  - [x] Update `previewAndApplyCombatOutcome(outcome, options = {})` in `module/combat/combat-commit.js`:
    - Before showing the preview Dialog, call `createOrUpdateCombatChatMessage(outcome, COMBAT_CHAT_STATUS.preview)`.
    - Retain the returned `messageId`.
    - If the referee clicks **Confirm**:
      - Execute `applyCombatUpdates()`.
      - Call `createOrUpdateCombatChatMessage(outcome, COMBAT_CHAT_STATUS.committed, { messageId })`.
    - If the referee clicks **Cancel**:
      - Call `createOrUpdateCombatChatMessage(outcome, COMBAT_CHAT_STATUS.canceled, { messageId })`.
    - Ensure that dialog actions handle errors gracefully and still flag/update the chat card as needed.
- [x] Extend test coverage for chat rendering template data. (AC: 3)
  - [x] Update `tests/combat/combat-commit.test.js` or `tests/combat/combat-fixtures.test.js`.
  - [x] Verify that `buildCombatChatData()` generates the expected structure for all four statuses (`preview`, `manual`, `committed`, `canceled`).
  - [x] Add assertions verifying that the commit/cancel adapter functions call the mock chat creation and update interfaces with the correct status progression.
- [x] Verify project boundaries are preserved. (AC: 4)
  - [x] Do not add npm dependencies, bundlers, or TypeScript.
  - [x] Do not mutate document `system` directly without awaited Foundry document update APIs.
  - [x] Keep legacy weapon roll/chat rendering working.
- [x] Perform validation checks. (AC: 1, 2, 3, 4)
  - [x] Check file syntax with `node --check` for modified files.
  - [x] Run `node tests/run-combat-fixtures.mjs` and ensure all tests pass.
  - [x] Verify that pure resolver files under `module/combat/` do not contain references to `ChatMessage`, `Dialog`, or other Foundry globals.

## Dev Notes

### Scope Boundary

This story is focused on rendering the structured combat outcome in Foundry's chat log. It wires the preview state to create a chat card, and updates it on commit or cancel.

Do not implement damage calculation, armor layering, BTM, wounds, or save resolution here. Use existing `buildCombatChatData()` which already has placeholders for those values.

### Epic 2 Context

Epic 2 builds the first end-to-end single-shot firearm path:
1. Story 2.1 normalized selected targets to actor-aware references.
2. Story 2.2 resolved structured hit/miss and hit-location attack evidence.
3. Story 2.3 added ammo evidence and planned ammo updates.
4. Story 2.4 added preview/confirm state application.
5. Story 2.5 (This Story) renders single-shot combat evidence in chat.
6. Story 2.6 adds end-to-end fixtures and Foundry manual checks.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` - Story 2.5]
- [Source: `module/combat/combat-chat.js`]
- [Source: `module/combat/combat-commit.js`]
- [Source: `module/templates.js` - template preloading]

## Dev Agent Record

### Agent Model Used

Gemini 3.5 Flash (Medium)

### Debug Log References

- `node tests/run-combat-fixtures.mjs` (first run failed due to plan status mismatch; second run passed successfully)
- Checked templates syntax and ES modules compatibility

### Completion Notes List

- Implemented `templates/chat/combat-outcome.hbs` and registered it in `module/templates.js`.
- Expanded the Foundry adapter in `module/combat/combat-commit.js` with `renderTemplate`, `createChatMessage`, and `updateChatMessage`.
- Created `createOrUpdateCombatChatMessage` to manage the lifecycle of the chat messages.
- Wired the chat message rendering into `previewAndApplyCombatOutcome` to create cards in preview mode and update them in place on confirm/cancel.
- Added `assertChatOutcomeLifecycle` unit tests in `tests/combat/combat-commit.test.js` to assert the entire preview -> commit/cancel chat message state machine.
- All unit tests pass.

### File List

- `templates/chat/combat-outcome.hbs`
- `module/templates.js`
- `module/combat/combat-commit.js`
- `tests/combat/combat-commit.test.js`

### Review Findings

- [x] [Review][Patch] Swallowed Chat Lifecycle Errors [module/combat/combat-commit.js:44-261]
- [x] [Review][Patch] Hardcoded Inline CSS and Hex Colors in HTML Template [templates/chat/combat-outcome.hbs]
- [x] [Review][Patch] Broken Status Banner Border Styling [templates/chat/combat-outcome.hbs:439]
- [x] [Review][Patch] Hardcoded UI String Literals and Lack of Localization [templates/chat/combat-outcome.hbs]
- [x] [Review][Patch] Dangerous Speaker Resolution Fallback [module/combat/combat-commit.js:315]
- [x] [Review][Patch] Polluted Data Objects with undefined Properties [module/combat/combat-commit.js:326-331]
- [x] [Review][Patch] Inconsistent Warnings Retention on Cancel [module/combat/combat-commit.js:154-173]
- [x] [Review][Patch] Attack total equals 0 hides attack details [templates/chat/combat-outcome.hbs:380]
- [x] [Review][Patch] Duplicate chat messages on ChatMessage.create undefined [module/combat/combat-commit.js:134-140]
- [x] [Review][Patch] ChatMessage deleted or missing during update [module/combat/combat-commit.js:285-288]
- [x] [Review][Patch] Missing Active Modifiers in Chat Template UI [templates/chat/combat-outcome.hbs]
- [x] [Review][Patch] Missing Attack Roll Formula in Chat Template UI [templates/chat/combat-outcome.hbs:380]
- [x] [Review][Patch] Discarding of Commit-Failure Warnings in Chat Updates [module/combat/combat-commit.js:98-107]
- [x] [Review][Defer] Incomplete Test Coverage for Failure Paths [tests/combat/combat-commit.test.js] — deferred, pre-existing
- [x] [Review][Defer] Redundant Adapter Parameter Defaults [module/combat/combat-commit.js] — deferred, pre-existing
- [x] [Review][Defer] Concurrency - Double Click on Confirm [module/combat/combat-commit.js:60-84] — deferred, pre-existing
