# Deferred Work

This file tracks technical debt and deferred items from code reviews.

## Deferred from: code review of 2-5-render-single-shot-combat-evidence-in-chat.md (2026-05-27)

- **Incomplete Test Coverage for Failure Paths**: The current test coverage does not verify error handling during adapter rendering or ChatMessage creations/updates.
- **Redundant Adapter Parameter Defaults**: `options.adapter || createFoundryCombatAdapter()` is duplicated across functions.
- **Concurrency - Double Click on Confirm**: Double clicking the Dialog buttons could trigger mutations multiple times before the message state settles.

## Deferred from: code review of 2-6-add-single-shot-fixtures-and-foundry-manual-checks.md (2026-05-27)

- **Critical Success and Fumble manual verification**: The guide lacks step-by-step instructions for verifying fumbles (weapon jams) and critical success (exploding 10s) on the preview and chat cards.
- **Untargeted Ranged Attack Flow**: Documentation of UI behavior and resolution path when zero targets are selected on the scene.
- **Node.js ES Module Parsing Warning**: Standardizing the package layout to avoid ES module warnings by setting `"type": "module"` in `package.json`.

## Deferred from: code review of 3-3-apply-armor-piercing-and-staged-penetration.md (2026-05-27)

- **Multiple penetrations against the same armor item can collapse to one ablation**: Future multi-hit outcomes should plan cumulative armor ablation instead of repeated absolute `before + 1` updates from one snapshot.
- **Stale preview can overwrite newer armor ablation on confirm**: Broader preview/confirm concurrency needs a current-value check, version guard, or delta-style update for armor ablation.

## Deferred from: code review of 3-5-apply-wound-state-and-special-damage-cases.md (2026-05-27)

- **Stale preview can overwrite newer target damage on confirm**: Broader preview/confirm concurrency needs a current-value check, version guard, or delta-style update before absolute `system.damage` updates are applied.
