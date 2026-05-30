# Deferred Risks — Story 6-4: Direct-Mutation & Awaited-Update Audit Findings

> Generated: 2026-05-30
> Owner: @maintainer
> Status: Active

---

## DEFERRED-6.4-1: Serial Migration Performance

**Severity:** Low

**Description:** Serial `await`-ing every document migration (actor items → standalone items → compendium documents) could be slow in worlds with hundreds of actors/items. Each migration runs sequentially, blocking the ready hook.

**Acceptability:** Acceptable for MVP. Migration runs once per version upgrade. Even with 500+ documents, the total time should stay under a few seconds.

**Owner:** @maintainer

**Follow-up:** Epic 6 post-MVP or optimisation pass — consider batching or concurrent-but-tracked migration if profiling shows >5s delay.

---

## DEFERRED-6.4-2: Legacy Fallback Ammo Updates (Redundant After Story 6-8)

**Severity:** Low

**Description:** The `await`-patched ammo updates in `__semiAuto`, `__threeRoundBurst`, and `__fullAuto` (Finding A, item.js) will become dead code once the structured resolver is the default path (Story 6-8). The patches are correct but temporary.

**Acceptability:** Necessary guard-rail until the legacy path is removed. The patched code is already tested and prevents the stale-value bugs found in the audit.

**Owner:** @maintainer

**Follow-up:** Story 6-8 — remove or fence `__legacyWeaponRoll()` and all sub-methods.

---

## DEFERRED-6.4-3: Stale `previewData` Overwriting Concurrent Updates

**Severity:** Medium

**Description:** The combat preview/commit flow (`combat-commit.js` → `previewData`) can produce a stale snapshot that overwrites a later concurrent update. If two combat actions resolve near-simultaneously, the second commit may write the first action's ablated armor SP back onto the actor, undoing the second action's damage.

**Root Cause:** `previewData` is computed once at preview time and applied at commit time. There is no version guard or merge mechanism between preview capture and commit application.

**Acceptability:** Deferred from audit because the scenario (simultaneous independent attacks) is rare in Foundry's single-user session model. In shared-world sessions with multiple GMs this could manifest.

**Owner:** @maintainer

**Follow-up:** Post-MVP / combat commit hardening. Add a version guard (`system._updateEpoch`) or switch to delta-only updates rather than snapshot-overwrite.

---

## DEFERRED-6.4-4: Concurrent Roll Locking (Double-Click)

**Severity:** Medium

**Description:** `resolveCombatAction` does not prevent concurrent invocations from the same attacker. A player clicking "Fire" twice in rapid succession launches two resolver pipelines, both of which can mutate the same actor's ammo, wounds, and SP. This can produce double-ammo-spend, double-damage, or inconsistent save prompts.

**Acceptability:** Low-latency double-click is a UX issue rather than a data-integrity crisis in single-user mode. The structured resolver's awaited update chain serialises per-document mutations via Foundry, but the resolver itself does not gate on an in-flight flag.

**Owner:** @maintainer

**Follow-up:** Post-MVP / combat UX hardening. Add an in-flight flag on the attacker actor (`system._combatInFlight`) checked at resolver entry, cleared after commit resolves.

---

## DEFERRED-6.4-5: `_prepareArmorData` Morphing/Cleansing Should Move Out of `prepareData()`

**Severity:** Low

**Description:** `_prepareArmorData` in `item.js` directly mutates `system.coverage` inside `prepareData()` — a method that Foundry calls on every sheet render and data access. This is a direct mutation of persisted schema state from a prepare-only lifecycle method. The full fix would move coverage morphing/cleansing to an explicit event handler (e.g. `onTransferItem` or item-create hook) using `updateEmbeddedDocuments`.

**Acceptability:** The bug (`delete system.coverage.armorArea` → fixed with bracket notation) is gated by `COVERAGE_CLEANSE_THRESHOLD = 20` — extremely unlikely to trigger in normal play. The armour resolver (`getEquippedArmorForLocation`) reads from equipped item snapshots directly, not from actor-prepared coverage. The bracket-notation fix prevents the literal-property deletion bug.

**Owner:** @maintainer

**Follow-up:** Epic 6 post-MVP. Move coverage morphing/cleansing out of `prepareData()` into an explicit item-transfer or item-create handler.