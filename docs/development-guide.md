# Development Guide

Last updated: 2026-05-24

## Prerequisites

- FoundryVTT runtime for actual execution and manual verification.
- Sass CLI for styling changes.
- No npm install step is defined in this repository.

## Local Development Model

This repository is a FoundryVTT system package. The normal development loop is:

1. Edit JavaScript, Handlebars, Sass, language, or data files.
2. If Sass changed, compile `scss/cyberpunk2020.scss` to `css/cyberpunk2020.css`.
3. Load or reload the system in Foundry.
4. Manually verify the affected sheet, roll, item, actor, or pack behavior.

## Build Commands

README documents watch mode:

```sh
sass --watch scss/cyberpunk2020.scss css/cyberpunk2020.css
```

One-off compile command:

```sh
sass scss/cyberpunk2020.scss css/cyberpunk2020.css
```

There are no detected npm scripts, test scripts, bundler commands, or CI commands.

## Common Change Workflows

### Actor Behavior Change

Check:

- `module/actor/actor.js`
- `module/actor/actor-sheet.js`
- `templates/actor/`
- `template.json`
- migrations if persisted data shape changes

Manual verification:

- create/open character
- create/open NPC if relevant
- check sheet tabs
- check changed derived values
- check relevant rolls or item interactions

### Item or Combat Change

Check:

- `module/item/item.js`
- `module/item/item-sheet.js`
- `module/lookups.js`
- `module/dice.js`
- `templates/item/`
- `templates/chat/`
- relevant packs if defaults need updating

Manual verification:

- open item sheet
- attach item to actor if owned behavior matters
- execute relevant attack/roll path
- inspect chat card output
- inspect item state updates such as `shotsLeft`

### Template Change

Check:

- matching sheet class data context
- `module/templates.js` if a new partial must be preloaded
- `module/handlebars-helpers.js` if helpers are needed
- localization keys for visible labels

Manual verification:

- render affected actor/item/dialog/chat UI
- submit forms and verify persistence
- check tabs and click handlers

### Sass Change

Check:

- edit `scss/`, not `css/` as source
- compile CSS
- inspect both SCSS and CSS diffs

Manual verification:

- render affected sheet/card at typical Foundry window sizes

### Data Model Change

Check:

- `template.json`
- all `name="system.path"` template bindings
- actor/item prepare code
- migration requirements
- pack data compatibility

Manual verification:

- old actor/item with missing field
- new actor/item defaults
- relevant compendium item

## Verification Standards

Because no automated test harness is present, completion notes should state exactly what was done:

- static review only
- Sass compile run or not run
- Foundry runtime/manual check run or not run
- specific sheet/roll/data path verified

Avoid saying "tested" unless an actual test or runtime check happened.

## Files to Treat as High Risk

- `system.json`: package contract
- `template.json`: actor/item data contract
- `module/migrate.js`: old-world compatibility
- `packs/*.db`: compendium data
- `module/item/item.js`: combat, ammo, vehicle, armor behavior
- `module/actor/actor.js`: derived character data
- `module/templates.js`: template preload paths
- `module/handlebars-helpers.js`: rendering helpers used across templates

## No-Tooling Rule

Do not introduce TypeScript, Vite, Webpack, ESLint, Jest, or an npm workflow as a side effect of an unrelated feature. Tooling changes should be planned as explicit architecture work.
