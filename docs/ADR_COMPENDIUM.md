# Architecture Decision Records (ADR): Cyberpunk 2020 Canonical Compendium

This document records the architectural decisions made during the parsing and creation of the new canonical VTT compendium for the Cyberpunk 2020 Foundry VTT system (`cyberpunk2020-rilerena`).

## ADR 1: Idempotency & Deterministic IDs
**Context:** Foundry VTT requires a 16-character alphanumeric `_id` for each item. Generating random IDs on every build breaks existing world links and macros.
**Decision:** We use a deterministic hash (SHA-256) of the item's canonical name, taking the first 16 valid base62 characters. 
**Consequences:** Re-running the compendium builder script will seamlessly update items in place without breaking references. If an item name changes, its ID will change.

## ADR 2: Weapon Firing Modes & Composite ROF
**Context:** Cyberpunk 2020 rules for firing modes (Single, 3-Round Burst, Full Auto) are derived from the Rate of Fire (ROF) and Weapon Type. Later sourcebooks introduced composite ROF (e.g., `1/3/30`). The `cyberpunk2020-rilerena` system does not support discrete boolean toggles for firing modes.
**Decision:** We extract the exact ROF string from the Reference Book tables (including composite formats like `1/3/30`) and map it directly to `data.rof`. We do not attempt to construct a custom `firingModes` array. Any narrative overrides (e.g., "Weapon cannot fire burst") will be pushed to the `notes` field.
**Consequences:** Players and Game Masters must interpret the ROF string according to standard FNFF rules, but the data fidelity is 100% accurate to the sourcebooks.

## ADR 3: Source Code Tracking
**Context:** We want to track which rulebook an item originates from (e.g., `CP20` for Core Rulebook, `Chr1` for Chromebook 1).
**Decision:** The source abbreviation is extracted and placed into `data.source`. For items from the Gear and Ammo tables where the Reference Book omitted a source column, the source defaults to `CP20`.
**Consequences:** Users can accurately filter weapons, cyberware, and vehicles by sourcebook.

## ADR 4: Rich Data Preservation via Notes
**Context:** Our raw parsing extracted detailed parameters not natively supported by the VTT schema (e.g., Surgery Code and Humanity Loss for Cyberware, ACC/DEC and Passengers for Vehicles).
**Decision:** Any field from the canonical JSON that does not map 1:1 to the VTT item schema is formatted as HTML text and appended to the item's `data.notes` or `data.flavor`.
**Consequences:** Zero data loss during VTT migration. All mechanical stats are accessible in the UI.

## ADR 5: Subdirectory Mapping
**Context:** The old `packs-src` contained messy, manually created folders (`pistols`, `smgs`, `assault-rifles`, etc.).
**Decision:** The script automatically routes items into unified directories: `pistols`, `smgs`, `rifles`, `shotguns`, `heavyweapons`, `melee`, `cyberware`, `gear`, `netware`, `vehicles`, `ammo`. The old directories will be systematically wiped and replaced by the script output.
