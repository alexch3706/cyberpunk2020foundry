# Compendium research pipeline

Local tooling to inventory gear from Cyberpunk 2020 PDFs and compare against `packs-src/`.

Intermediate outputs live in **`.research/`** (gitignored). Scripts live in **`tools/research/`**.

## Bootstrap source

`Cyberpunk_2020_-_Reference_Book.pdf` (Andrew James fan compilation, v5) is parsed first:

- **Legend** → book code → PDF filename mapping
- **Weapon / vehicle tables** → structured inventory with `source_code` pointing at canonical books

Official PDFs are then batch-extracted for verification, flavor text, and gaps not covered by the Reference Book.

## Setup

```bash
python3 -m venv .venv-research
source .venv-research/bin/activate
pip install -r tools/research/requirements.txt
```

Set your PDF library (default: `~/Downloads/Cyberpunk 2020`):

```bash
export RESEARCH_PDF_DIR="/path/to/Cyberpunk 2020"
```

## Commands

```bash
# 1) Parse Reference Book → inventory bootstrap
python tools/research/run.py parse-reference

# 2) Extract text from all library PDFs (excludes master-merge & duplicates)
python tools/research/run.py extract

# 3) Diff reference inventory vs packs-src weapons
python tools/research/run.py diff-weapons

# Or all bootstrap steps:
python tools/research/run.py bootstrap
```

## Outputs

| Path | Description |
|------|-------------|
| `.research/manifest.json` | PDFs processed, page counts, empty-page ratio |
| `.research/book-codes.json` | Legend: code → book label → PDF glob |
| `.research/extracted/*.md` | Per-PDF text (page-separated) |
| `.research/parsed/reference-weapons.json` | Parsed weapon rows from Reference Book |
| `.research/inventory/weapons.yaml` | Inventory with compendium match hints |
| `.research/inventory/weapons-gaps.md` | In ref / in packs / only one side |
| `.research/inventory/weapons-diff-summary.json` | Match counts by tier |

## Matcher tuning

| Path | Description |
|------|-------------|
| `tools/research/name_aliases.json` | Bidirectional weapon name variants |
| `tools/research/source_aliases.json` | Map packs-src `data.source` URLs/strings → book codes |
| `tools/research/match_utils.py` | Multi-signal scoring (name, type, stats, source) |

`diff-weapons` assigns `match_tier`: **high** (≥0.9), **probable** (0.75–0.9). High matches are consumed first; probable matches fill remaining slots. See `weapons-gaps.md` for probable matches needing review.

`parse-reference` rejects malformed rows (invalid WA, manufacturer-only names) and logs counts in `reference-weapons.json` meta.

## Policy

Per `docs/rule-reference-policy.md`: do not commit large verbatim rulebook excerpts. Only mechanical summaries and citations belong in tracked repo files.
