# Project Documentation Index

Last updated: 2026-05-30

## Project Overview

- **Project:** Cyberpunk2020VTT
- **Type:** FoundryVTT system package
- **Repository structure:** Monolith
- **Primary language:** Plain JavaScript ES modules
- **Architecture:** Foundry document/sheet/template architecture
- **Current package version:** `0.3.12`
- **Foundry compatibility:** manifest-declared minimum `10`, verified `11`, maximum `12`

## Quick Reference

- **Runtime entry:** `module/cyberpunk2020.js`
- **Manifest:** `system.json`
- **Data template:** `template.json`
- **Actor logic:** `module/actor/actor.js`
- **Actor sheet:** `module/actor/actor-sheet.js`
- **Item logic:** `module/item/item.js`
- **Item sheet:** `module/item/item-sheet.js`
- **Templates:** `templates/`
- **Sass source:** `scss/cyberpunk2020.scss`
- **Compiled CSS:** `css/cyberpunk2020.css`
- **Compendium packs:** `packs/*.db`

## Generated Documentation

- [Resolver Contracts Reference](./resolver-contracts.md)
- [Rule Reference Policy](./rule-reference-policy.md)
- [Project Overview](./project-overview.md)
- [Architecture](./architecture.md)
- [Source Tree Analysis](./source-tree-analysis.md)
- [Component and UI Inventory](./component-inventory.md)
- [Data Models and Assets](./data-models.md)
- [Development Guide](./development-guide.md)
- [Refactor Assessment](./refactor-assessment.md)
- [Project Scan State](./project-scan-report.json)

## Existing Documentation

- [README](../README.md) - upstream/user-facing project overview and development note
- [Project Context for AI Agents](../_bmad-output/project-context.md) - AI implementation rules generated before this scan
- [Cyberpunk 2020 Core Rules PDF](./Cyberpunk%202020%20-%20Core%20Rules.pdf) - local source PDF for mechanics conformance checks
- [Cyberpunk 2020 Core Rules Extracted Text](./cyberpunk-2020-core-rules-extracted.md) - searchable extracted text with page separators; verify precision against the PDF

## Getting Started for AI Agents

1. Read [Project Context for AI Agents](../_bmad-output/project-context.md).
2. Read [Architecture](./architecture.md) for runtime structure.
3. Read [Refactor Assessment](./refactor-assessment.md) before proposing broad refactors.
4. Use [Development Guide](./development-guide.md) for verification expectations.
5. Use [Data Models and Assets](./data-models.md) before changing `template.json`, packs, actor/item fields, or migrations.
6. Use [Cyberpunk 2020 Core Rules Extracted Text](./cyberpunk-2020-core-rules-extracted.md) for searchable mechanics discovery, then confirm exact wording/page details in the source PDF.

## Documentation Purpose

This documentation captures the current brownfield state so future PRD, architecture, and story workflows can decide how much refactoring is justified before feature work.
