# Data Models and Assets

Last updated: 2026-05-24

## Foundry System Template

`template.json` defines schema-like defaults for Foundry system data. It is not JSON Schema and it is not a modern Foundry DataModel class.

## Actor Model

Actor types:

- `character`
- `npc`

Actor templates:

- `stats`
- `skills`
- `info`
- `lifepath`
- `hitLocations`
- `gear`

The `character` type uses `info`, `lifepath`, `stats`, `skills`, `hitLocations`, and `gear`. The runtime currently prepares both `character` and `npc` through `_prepareCharacterData`.

Important actor data areas:

- `system.stats.*.base`
- `system.stats.*.tempMod`
- derived `system.stats.*.total`
- derived `system.stats.ref.armorMod`
- `system.hitLocations`
- derived `system.hitLocLookup`
- `system.damage`
- `system.role.value`
- `system.eurobucks`
- `system.carryWeight`
- `system.sortedSkillIDs`
- `system.skillsSortedBy`
- `system.transient.skillFilter`

## Item Model

Item types:

- `skill`
- `weapon`
- `armor`
- `cyberware`
- `vehicle`
- `misc`

Common item fields apply to all item types except `skill` according to current template metadata:

- `system.flavor`
- `system.notes`
- `system.cost`
- `system.equipped`
- `system.weight`
- `system.source`

Important type-specific areas:

| Type | Important Fields |
| --- | --- |
| `skill` | `level`, `chipLevel`, `isChipped`, `ip`, `diffMod`, `isRoleSkill`, `stat` |
| `weapon` | `weaponType`, `attackType`, `attackSkill`, `accuracy`, `damage`, `range`, `shots`, `shotsLeft`, `rof`, `reliability`, `concealability`, `availability`, `ammoType`, `rangeDamages` |
| `armor` | `coverage`, `encumbrance`, `lastOwnerId` |
| `cyberware` | `cyberwareType`, `cyberwareSubtype`, `surgCode`, `humanityCost`, `humanityLoss`, `abbrev`, `slots`, `spaces` |
| `vehicle` | `sdp`, `sp`, `speed`, `fuel`, `passengers`, `maneuverability` |
| `misc` | common fields only |

## Derived vs Persisted Data

Several values are derived during `prepareData` and should be treated carefully:

- stat totals
- REF armor modifier
- hit-location stopping power totals
- hit-location lookup map
- movement derived values
- body type modifier/carry/lift
- wound modifiers
- humanity loss/total and EMP total
- carry weight

The current code mutates `system` during preparation for derived data. Refactors should clearly separate derived values from persisted updates and avoid expanding direct mutation patterns into user edits.

## Compendium Pack Inventory

| Pack | Manifest Name | Type Count |
| --- | --- | --- |
| `packs/default-skills.db` | `default-skills` | 90 skills |
| `packs/role-skills.db` | `role-skills` | 10 skills |
| `packs/pistols.db` | `pistols` | 338 weapons |
| `packs/rifles.db` | `rifles` | 397 weapons |
| `packs/smgs.db` | `smgs` | 8 weapons |
| `packs/armor.db` | `armor` | 16 armor items |
| `packs/cyberware.db` | `cyberware` | 481 cyberware items |
| `packs/chipware.db` | `chipware` | 203 cyberware items |
| `packs/vehicles.db` | `vehicles` | 16 vehicle items |
| `packs/communication.db` | `communication` | 10 misc items |
| `packs/electronics.db` | `electronics` | 17 misc items |
| `packs/entertainment.db` | `entertainment` | 12 misc items |
| `packs/fashion.db` | `fashion` | 32 misc items |
| `packs/furnishing.db` | `furnishing` | 10 misc items |
| `packs/medical.db` | `medical` | 10 misc items |
| `packs/netrunningEquipment.db` | `netrunningEquipment` | 15 misc items |
| `packs/rentalandservices.db` | `rentalandservices` | 40 misc items |
| `packs/security.db` | `security` | 26 misc items |
| `packs/sellTheDead.db` | `sellthedead` | 27 misc items |
| `packs/surveillance.db` | `surveillance` | 5 misc items |
| `packs/tools.db` | `tools` | 13 misc items |
| `packs/roll-tables.db` | `roll-tables` | 1 roll-table-like document |

## Localization Data

Declared languages:

- `en`, 352 keys
- `es`, 348 keys
- `it`, 387 keys

Most application strings use the `CYBERPUNK.` namespace. Settings use `SETTINGS.*` keys.

## Migration Implications

Any actor/item data shape change should be checked against:

- `template.json`
- existing document preparation code
- sheet form names
- Handlebars field paths
- compendium data
- `module/migrate.js`

Changes to skill representation, weapon fields, armor coverage, or cyberware humanity fields are especially likely to need migration logic and pack updates.
