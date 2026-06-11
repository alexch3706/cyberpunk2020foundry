"""Shared paths and helpers for the compendium research pipeline."""

from __future__ import annotations

import json
import os
import re
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RESEARCH_DIR = ROOT / ".research"
EXTRACTED_DIR = RESEARCH_DIR / "extracted"
PARSED_DIR = RESEARCH_DIR / "parsed"
INVENTORY_DIR = RESEARCH_DIR / "inventory"
PACKS_SRC = ROOT / "packs-src"
TOOLS_DIR = Path(__file__).resolve().parent

DEFAULT_PDF_DIR = Path.home() / "Downloads" / "Cyberpunk 2020"
REFERENCE_BOOK_NAME = "Cyberpunk_2020_-_Reference_Book.pdf"

WEAPON_TYPES = frozenset({"P", "RIF", "SMG", "SHT", "HVY", "EX", "MEL", "MP", "GRN", "MLG", "BOW", "FLM"})
WEAPON_PACKS = ("pistols", "rifles", "smgs", "melee")

SECTION_HEADERS = re.compile(
    r"^(LIGHT|MEDIUM|HEAVY|VERY|ASSAULT|SNIPER|OTHER|MACHINE|SHOTGUN|EXOTIC|MELEE|GRENADE|"
    r"LIGHT PISTOLS|MEDIUM PISTOLS|HEAVY PISTOLS|VERY HEAVY PISTOLS|"
    r"LIGHT SUBMACHINEGUNS|MEDIUM SUBMACHINEGUNS|HEAVY SUBMACHINEGUNS|"
    r"ASSAULT RIFLES|SNIPER RIFLES|OTHER RIFLES|MACHINEGUNS|HEAVY WEAPONS|CYBERPUNK)",
    re.I,
)

SKIP_PDF_NAMES = frozenset({
    "Chromebook 1 & 2.pdf",
    "Chromebook 3 & 4.pdf",
})

SKIP_DIR_NAMES = frozenset({
    "Masters under 190 MB",
})


def pdf_library_dir() -> Path:
    return Path(os.environ.get("RESEARCH_PDF_DIR", DEFAULT_PDF_DIR)).expanduser()


def ensure_dirs() -> None:
    for d in (RESEARCH_DIR, EXTRACTED_DIR, PARSED_DIR, INVENTORY_DIR):
        d.mkdir(parents=True, exist_ok=True)


def load_book_codes() -> dict:
    path = TOOLS_DIR / "book_codes.json"
    return json.loads(path.read_text(encoding="utf-8"))


def source_codes_sorted(codes: dict) -> list[str]:
    return sorted(codes.keys(), key=len, reverse=True)


def normalize_name(name: str) -> str:
    text = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode("ascii")
    text = re.sub(r"([a-zA-Z])([A-Z])", r"\1 \2", text)
    text = text.replace("&", " and ")
    text = text.lower()
    text = re.sub(r"\btm\b", "", text)
    text = re.sub(r"\binc\.?\b", "", text)
    text = re.sub(r"\b(arms|arm)\b", "", text)
    text = re.sub(r"\bmodel\b|\bmod\.?\b", "", text)
    text = re.sub(r"\bh\s*&\s*k\b|\bh\s+and\s+k\b", "heckler koch", text)
    text = re.sub(r"[^\w\s.-]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def slug_name(name: str) -> str:
    return normalize_name(name).replace(" ", "")


def should_skip_pdf(path: Path) -> bool:
    if path.name in SKIP_PDF_NAMES:
        return True
    if " (1)" in path.name:
        return True
    if path.parent.name in SKIP_DIR_NAMES:
        return True
    return False


def list_library_pdfs() -> list[Path]:
    base = pdf_library_dir()
    if not base.is_dir():
        raise FileNotFoundError(f"PDF library not found: {base}")
    pdfs = []
    for path in sorted(base.rglob("*.pdf")):
        if should_skip_pdf(path):
            continue
        pdfs.append(path)
    return pdfs


def resolve_pdf_for_code(code: str, codes: dict, library: list[Path]) -> list[str]:
    entry = codes.get(code, {})
    globs = entry.get("pdf_globs", [])
    names = {p.name for p in library}
    resolved = [g for g in globs if g in names]
    return resolved


def write_json(path: Path, data: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
