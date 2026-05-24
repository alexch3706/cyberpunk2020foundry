---
project_name: 'Cyberpunk2020VTT'
user_name: 'Alex'
date: '2026-05-24'
sections_completed: ['technology_stack', 'language_specific_rules', 'framework_specific_rules', 'testing_rules', 'code_quality_style_rules', 'development_workflow_rules', 'critical_dont_miss_rules']
existing_patterns_found: 12
status: 'complete'
rule_count: 81
optimized_for_llm: true
---

# Project Context for AI Agents

_This file contains critical rules and patterns that AI agents must follow when implementing code in this project. Focus on unobvious details that agents might otherwise miss._

---

## Technology Stack & Versions

- This is a FoundryVTT system package named `cyberpunk2020`, not a standalone web app.
- System manifest version is `0.3.12` in `system.json`.
- Foundry compatibility is manifest-declared as minimum `10`, verified `11`, maximum `12`; do not treat `maximum: 12` as proof of fully tested Foundry v12 support.
- Runtime code is plain JavaScript ES modules loaded directly by Foundry from `system.json -> esmodules: ["module/cyberpunk2020.js"]`; there is no bundled application entrypoint.
- JavaScript runs inside the Foundry client runtime and depends on Foundry globals/API such as `game`, `Hooks`, `CONFIG`, `Actors`, `Items`, `ActorSheet`, and `ItemSheet`.
- There is no `package.json`, dependency lockfile, npm script workflow, bundler, TypeScript config, lint config, or automated test harness detected. Do not assume `npm install`, `npm run build`, or `npm test`.
- UI is Foundry `ActorSheet` / `ItemSheet` classes plus Foundry-managed Handlebars `.hbs` templates under `templates/`.
- Styling source is Sass under `scss/`; `css/cyberpunk2020.css` is a tracked compiled artifact and must stay in sync when SCSS changes.
- Sass CLI is an external prerequisite and its version is not pinned in the repo. README development command: `sass --watch scss/cyberpunk2020.scss css/cyberpunk2020.css`; one-off compile command: `sass scss/cyberpunk2020.scss css/cyberpunk2020.css`.
- Localization languages are declared in `system.json` and backed by `lang/en.json`, `lang/es.json`, and `lang/it.json`.
- Actor/item system data schema defaults are declared in `template.json`; this is a Foundry system template, not JSON Schema or a modern DataModel class.
- Compendium packs are Foundry `.db` data assets under `packs/`; avoid manual format rewrites unless intentionally migrating packs.
- Static assets such as `img/` and `fonts/` are loaded directly by Foundry/templates/CSS without an asset pipeline.
- Do not introduce TypeScript, Vite, Webpack, ESLint, Jest, or another toolchain by default; that would be an architectural change, not a routine edit.

## Critical Implementation Rules

### Language-Specific Rules

- Use plain JavaScript ES modules with relative `.js` imports matching the current style; do not use bundler-only features such as path aliases, decorators, TypeScript syntax, or bare imports for local code.
- Do not convert files to TypeScript or add transpilation unless that is an explicit architecture decision.
- Runtime modules under `module/` must remain compatible with the Foundry browser/Electron runtime. Do not add Node-only APIs, filesystem/process assumptions, or npm-only dependencies to runtime code.
- Do not import from Foundry internals. Use public Foundry globals/API and local project modules.
- Continue extending Foundry classes through the existing project subclasses (`CyberpunkActor`, `CyberpunkItem`, `CyberpunkActorSheet`, `CyberpunkItemSheet`) instead of bypassing them with parallel service/global architectures.
- Reading from `this.system`, `actor.system`, and `item.system` is normal; persisted writes must go through Foundry document APIs such as `update({ "system.path": value })`, `createEmbeddedDocuments`, or `updateEmbeddedDocuments`.
- `update`, `createEmbeddedDocuments`, `updateEmbeddedDocuments`, migrations, roll evaluation, and chat-message flows return Promises; `await` them wherever ordering, error handling, or follow-up state depends on completion.
- Preserve Foundry lifecycle patterns: initialization belongs in `Hooks.once("init", ...)`; world migration checks belong in `Hooks.once("ready", ...)` and must remain GM-gated.
- Keep form fields compatible with Foundry sheet submission by using `name="system.path"` bindings rather than custom parsing unless necessary.
- Use existing utility functions from `module/utils.js` for localization and shared helpers instead of duplicating localize/deep lookup logic.
- Use existing roll helpers from `module/dice.js` (`makeD10Roll`, `Multiroll`) for Cyberpunk d10 rolls and chat-card rolls.
- Keep user-visible strings localized with `CYBERPUNK.*` keys through `localize`, `localizeParam`, or Handlebars helpers; do not hardcode new UI text only in templates.
- New Handlebars helpers should be registered through the existing helper registration path and should not duplicate existing helpers/utilities.
- Handlebars templates should remain `.hbs`; keep complex logic in sheet classes or helpers, not embedded in templates.
- When a file uses Foundry sheet listeners and jQuery-style `html.find(...)`, preserve that local interaction style.
- Use `game.settings` for system/client settings; do not store persistent or cross-session runtime state in module globals.
- Be defensive with optional `system` fields because older actors/items may predate migrations; avoid fragile chained access when data may be missing.
- Keep comments sparse and practical. Existing comments are used mainly to explain Foundry quirks, migration hazards, or game-rule reasoning.

### Framework-Specific Rules

- Treat FoundryVTT as the application framework. The system is loaded by Foundry from `system.json`; do not add a separate app shell, router, dev server, or frontend framework.
- Register document classes and sheets during `Hooks.once("init", ...)` using the existing pattern in `module/cyberpunk2020.js`.
- Actor behavior belongs in `module/actor/actor.js`; actor sheet presentation and listeners belong in `module/actor/actor-sheet.js`.
- Item behavior belongs in `module/item/item.js`; item sheet presentation and listeners belong in `module/item/item-sheet.js`.
- Keep `template.json` changes backward-aware. If actor/item data shape changes, consider whether `module/migrate.js` needs a migration and whether default pack data needs updates.
- Add reusable Handlebars partials under `templates/` and preload them through `module/templates.js` when they are rendered dynamically or shared.
- Keep item sheet partial naming aligned with the current dynamic template pattern: `templates/item/parts/[item.type]/summary.hbs` and `settings.hbs`.
- Use `game.packs`, Foundry documents, and embedded documents for compendium/entity access; do not parse pack `.db` files as the normal implementation path.
- Use `game.i18n` through existing localization wrappers/helpers for UI strings and sheet labels.
- Foundry settings belong in `module/settings.js` via `game.settings.register`.
- Chat output should use Foundry `ChatMessage`, `Roll`, and existing chat templates under `templates/chat/`.
- Sheet interactions should be wired through `activateListeners(html)` and existing CSS classes/data attributes, not inline event handlers in templates.

### Testing Rules

- No automated test harness is currently detected. Do not claim a change is covered by tests unless a test framework is added or a Foundry runtime check was actually performed.
- For code-only changes, use static inspection plus targeted reasoning around Foundry lifecycle, document updates, and template paths.
- For sheet/UI behavior, verify manually in Foundry when possible: actor sheet render, item sheet render, tab navigation, relevant click handlers, form persistence, and chat output.
- For data model changes, check `template.json`, existing actor/item usage, migration needs in `module/migrate.js`, and any affected compendium/default item data.
- For Sass changes, compile `scss/cyberpunk2020.scss` to `css/cyberpunk2020.css` and inspect the compiled CSS diff.
- For localization changes, update all declared language files or explicitly document intentional fallback behavior.
- For roll/combat changes, verify both roll formula construction and rendered chat-card data, especially crit/fumble and multi-roll behavior.
- For migration changes, preserve GM-only execution and version gating; reason through old-world data with missing fields.

### Code Quality & Style Rules

- Follow the existing file organization: actor code in `module/actor/`, item code in `module/item/`, shared helpers in `module/utils.js`, lookup tables in `module/lookups.js`, roll helpers in `module/dice.js`, settings in `module/settings.js`, migrations in `module/migrate.js`.
- Preserve current naming style: exported classes use `Cyberpunk*`; helper functions are camelCase; constants and lookup objects follow nearby file conventions rather than a repo-wide imposed style.
- Keep changes narrow and brownfield-friendly. Prefer small local edits over broad refactors unless the refactor is required for the requested behavior.
- Do not edit generated `css/cyberpunk2020.css` as the source of truth; edit SCSS first and then compile CSS.
- Keep Handlebars templates declarative. Use partials and helpers for reuse rather than duplicating large template blocks.
- Keep localization keys under the `CYBERPUNK.` namespace and use existing key naming patterns such as `TabSkills`, `Skill...`, and setting keys.
- Avoid introducing new global state. If state must persist, use Foundry documents or `game.settings` as appropriate.
- Preserve existing comments that explain Foundry quirks, migration behavior, or Cyberpunk 2020 rule reasoning.
- Do not reformat unrelated files or normalize the whole codebase during feature work.

### Development Workflow Rules

- This repo has no detected npm workflow. Prefer direct file edits plus Foundry/manual verification over inventing a package workflow.
- For styling work, run Sass compilation after SCSS edits when the Sass CLI is available: `sass scss/cyberpunk2020.scss css/cyberpunk2020.css`.
- Keep `scss/` and compiled `css/` diffs paired for style changes.
- Treat `system.json`, `template.json`, `packs/`, and migration code as high-risk files because changes affect installability, world data, or compendium data.
- When changing manifest compatibility, release version, pack declarations, languages, scripts, styles, or esmodules, verify the corresponding files and paths exist.
- When changing data shape, update code, templates, migrations, and default data together as needed.
- Before reporting completion, summarize verification honestly: static review, Sass compile, Foundry runtime/manual check, or not run.
- Avoid committing/generated metadata churn such as `.DS_Store` changes.

### Critical Don't-Miss Rules

- Do not treat this as a normal npm/browser app. Foundry loads the system directly from manifest paths, so path changes can break runtime loading.
- Do not change `system.json` identifiers, manifest paths, pack paths, language paths, `esmodules`, or `styles` casually; these are Foundry package contract surfaces.
- Do not mutate persisted actor/item `system` data directly. Use Foundry document update APIs so sheets, persistence, and hooks stay coherent.
- Do not change actor/item data shape without checking migrations and old-world compatibility.
- Do not add UI text without localization keys for declared languages, unless fallback behavior is intentional and documented.
- Do not edit compendium `.db` files as if they were ordinary JSON. Treat pack changes as data migration/export work.
- Do not move or rename templates/partials without updating preload paths, dynamic partial helpers, and callers.
- Do not update SCSS without regenerating tracked CSS when the change should affect shipped styling.
- Do not assume Foundry v12 behavior is fully supported just because `maximum` is `12`; manifest `verified` is `11`.
- Do not introduce a new build/test/tooling stack as part of an unrelated feature or bug fix.
- Watch for old actor/item data missing newer `system` fields; defensive defaults and migrations matter.
- Roll and chat-card changes are high-risk because formulas, rendered templates, and Foundry roll evaluation all need to stay aligned.

---

## Usage Guidelines

**For AI Agents:**

- Read this file before implementing any code.
- Follow all rules exactly as documented.
- When in doubt, prefer the more restrictive option.
- Update this file if new project patterns emerge.

**For Humans:**

- Keep this file lean and focused on agent needs.
- Update it when the technology stack, Foundry compatibility, data model, or workflow changes.
- Review periodically for outdated rules.
- Remove rules that become obvious or no longer apply.

Last Updated: 2026-05-24
