# Addendum: Technical Context for Core Combat Fidelity MVP

This addendum preserves implementation-relevant context that informs architecture but should not dominate the PRD.

## Source Inputs

- Brownfield documentation: `docs/index.md`, `docs/architecture.md`, `docs/refactor-assessment.md`
- Static conformance audit: `_bmad-output/implementation-artifacts/investigations/corebook-mechanical-faithfulness-audit.md`
- Investigation case file: `_bmad-output/implementation-artifacts/investigations/corebook-mechanical-faithfulness-investigation.md`
- Rules source: `docs/Cyberpunk 2020 - Core Rules.pdf`, navigated through `docs/cyberpunk-2020-core-rules-extracted.md`

## Architectural Direction Carried Forward

The audit recommends a mechanics-core extraction, not a broad frontend or stack rewrite. The downstream architecture should define a testable resolver layer with these conceptual responsibilities:

1. `rollAttack`: structured attack result with natural die metadata, fumble/jam information, modifiers, range DC, and action context.
2. `resolveHitLocations`: target-aware random or aimed locations.
3. `resolveArmor`: proportional armor, AP, cover, optional staged penetration, and effective SP per hit.
4. `resolveDamage`: damage dice, head/limb special cases, BTM, minimum damage, wound increment.
5. `resolveSaves`: stun/death thresholds, immediate save prompts/results, and recurring mortal save state if in scope.
6. `commitCombatResult`: actor/item updates and chat rendering in one controlled place.

The PRD does not require these exact names. It requires the behaviors and testability they represent.

## Known Code Risk Areas

- `module/item/item.js`: tightly couples modifier collection, attack rolls, damage rolls, hit locations, ammo updates, and chat rendering.
- `module/actor/actor.js`: computes useful derived data but mixes many mechanics in `prepareData`.
- `module/actor/actor-sheet.js`: passes selected targets as name/id objects, not target actor context.
- `module/item/item-sheet.js`: directly mutates cyberware humanity loss instead of using Foundry updates.
- `module/migrate.js`: async migration sequencing is not reliable.
- `template.json`: contains fields like weapon `ap`, armor `ablation`, and damage state that are underused by current mechanics.

## Suggested Verification Fixtures

- Single shot vs unarmored target.
- Single shot vs armored target where SP fully stops damage.
- Single shot vs armored target where BTM reduces damage but minimum damage applies.
- AP shot vs armor.
- Head hit damage doubling.
- Limb damage exceeding the severing threshold.
- Serious, Critical, and Mortal wound threshold transitions.
- Stun save threshold by wound state.
- Death save threshold by Mortal level.
- Three-round burst hit count and ammo usage.
- Full-auto one target and multi-target rounding.
- Suppressive fire zone save and failed-save hit count.
- Opposed melee attack.
- Martial throw/choke/grapple prerequisite path.
- Cyberware humanity roll persistence.

