# Rule Reference Policy

## Purpose
This document establishes the canonical policy for referencing game mechanics, rulebooks, and project audit findings in the codebase and test fixtures. It ensures that mechanics citations are consistent, inspectable, and safely paraphrase copyrighted material.

## Core Policy Statements

1. **Mandatory Citations**: Every combat-related code comment and fixture that touches core mechanics must include a canonical citation.
2. **Corebook References**: Use the format `CP2020 p.{page}: {brief description}` (e.g., `CP2020 p.99: Range DC table (Medium=20)`).
3. **Audit References**: For project-specific decisions or technical constraints, use the format `Audit {audit-id}: {finding}` (e.g., `Audit 6.4: Missing ammo state blocks ammo updates`).
4. **No Copyrighted Text**: **Never** embed or copy large blocks of text verbatim from the rulebook. Paraphrase the expected mechanical behavior.
5. **Preference**: When in doubt, prefer a corebook page reference over no reference at all.

## Resolver Rule Map

The following maps each resolver module to its primary mechanics domain and suggests the standard citation pattern.

| Resolver Module | Typical Rules Area | Canonical Citation Pattern |
|---|---:|---|
| `attack-resolver.js` | Ranged DCs, burst/full-auto, fumbles/jams, hit locations, aimed shots | `CP2020 p.99-100: Range DCs, Burst, Full Auto`; `CP2020 p.102: Hit Location` |
| `armor-resolver.js` | SP, AP, staged penetration, layering, cover | `CP2020 p.105-106: Armor, SP, AP, Staged Penetration` |
| `damage-resolver.js` | BTM table, minimum damage, head/limb thresholds | `CP2020 p.102: Head-hit double; CP2020 p.106: BTM/Minimum; CP2020 p.108: Limb damage` |
| `save-resolver.js` | Stun/Shock saves, Death saves, Mortal wounds | `CP2020 p.107-108: Wounds, Stun, Death Saves` |
| `state-planner.js` | Wound state transitions, damage-to-wound mapping | `CP2020 p.107: Wound State table` |
| `combat-resolver.js` | Fire mode routing, exotic attack guard | `CP2020 p.99-100: Fire modes` |

*(Note: Hit location resolution is handled directly within `attack-resolver.js` and `target-normalizer.js`).*

## Code Review Enforcement
Reviewers must verify that new mechanic-touching PRs include proper citations in the comments and corresponding test fixtures. Exceptions are granted for internal plumbing, standard Javascript utility wrappers, or generic FoundryVTT API integration code.
