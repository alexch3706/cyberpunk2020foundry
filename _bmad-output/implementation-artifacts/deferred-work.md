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

## Deferred from: code review of 3-6-generate-stun-and-death-save-prompts.md (2026-05-28)

- **Missing checks for deceased status**: Save resolution does not check if the target is already dead (deceased status or failed saves) before generating new Stun or Death save prompts.

## Deferred from: code review of 3-7-add-damage-pipeline-fixtures-and-foundry-checks.md (2026-05-28)

- **Duplication of `woundStateLabel` function**: Duplicate implementations in `module/combat/state-planner.js` and `module/combat/save-resolver.js`.
- **Duplication of `normalizeDamageValue` function**: Duplicate implementations in `module/combat/state-planner.js` and `module/combat/save-resolver.js`.
- **Cover resolved as standard armor layer**: Temporary cover resolved as standard armor participating in proportional layering rather than sequential resolution.
- **Ablation applied to personal armor instead of cover**: When cover is bypassed/penetrated, ablation updates are planned on the equipped personal armor instead of cover due to type checks matching only `"armor"`.
- **Skinweave and Subdermal Armor ignored during staged armor ablation**: Cyberware items with stopping power are ignored when updates are generated for armor ablation.
- **Hardcoded limb keys in `LIMB_LOCATION_KEYS`**: Key limb locations like hands and feet are not recognized as limbs for severing/crushing warnings.
- **Missing check for stabilized status in Mortal target reminders**: Recurring death save reminders are created even if the Mortal target is already stabilized.
- **Death saves generated for guaranteed dead targets**: Death saves are generated for targets above Mortal 6 who should be considered deceased automatically.
- **Inconsistent validation of wound damage**: Discrepancy in `cannotResolveTargetSaves` and `resolveDamageEvidence` validation checks.
- **Death save reminders bound to attacks instead of target turns**: Reminder prompts are triggered on attacks (even 0-damage ones) rather than target turn changes.

## Deferred from: code review of 4-1-migrate-three-round-burst-to-resolver-outcome.md (2026-05-28)

- **Cyberware armor updatePath in staged penetration**: Edge Case Hunter noted that cyberware layers might not have their `system.ablation` updated correctly because of how `updatePath` is resolved. This is a pre-existing issue related to cyberware ablation logic, not introduced by story 4.1.
