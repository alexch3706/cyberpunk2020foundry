# MEMORY.md

## Long-term Decisions & Context

- **Cyberpunk2020VTT Combat Fidelity Resolver**: The project implements a mechanics resolver inside `module/combat/` to enforce Cyberpunk 2020 corebook rules.
- **Incremental Migration**: Each story replaces a piece of the legacy roll handlers in `module/item/item.js` with structured resolver-backed outcomes.
- **Three fire modes migrated**:
  - Semi-Auto (Story 2.2-2.5)
  - Three-Round Burst (Story 4.1)
  - Full Auto (Story 4.2-4.3)
- **Suppressive Fire (Story 4.4)**: The next fire mode to be resolved. It requires Athletics + REF saves for targets in the zone versus a DC derived from rounds fired / zone width. Failed saves take 1d6 hits.
- **Melee normalization & opposed rolls (Story 5.1 & 5.2)**: Migrated baseline melee resolution. Normalizes defender skill snapshots, resolves opposed rolls (REF + skill), calculates weapon damage plus strength bonus, and applies the standard armor/BTM damage pipeline.
