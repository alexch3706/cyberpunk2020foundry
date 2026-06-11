"""Parse Cyberpunk 2020 Reference Book weapon tables into structured JSON."""

from __future__ import annotations

import re
from collections import Counter
from pathlib import Path

from pypdf import PdfReader

from common import (
    REFERENCE_BOOK_NAME,
    SECTION_HEADERS,
    WEAPON_TYPES,
    ensure_dirs,
    list_library_pdfs,
    load_book_codes,
    pdf_library_dir,
    resolve_pdf_for_code,
    source_codes_sorted,
    write_json,
    PARSED_DIR,
    INVENTORY_DIR,
    RESEARCH_DIR,
)

TYPE_TOKEN = r"(?:P|RIF|SMG|SHT|HVY|EX|MEL|MP|GRN|MLG|BOW|FLM)"
TYPE_RE = re.compile(rf"\b({TYPE_TOKEN})\s+", re.I)
STAT_START_RE = re.compile(r"^[+-]?\d+(?:/[+-]?\d+)?\s+")
RANGE_RE = re.compile(r"^(\d+m|-\s*SW|-)$", re.I)
COST_RE = re.compile(
    r"^[\d]+([+-][\d]+)?(\+)?$|^[\d]+-[\d]+$|^d\d|^[\d,]+$",
    re.I,
)
WA_RE = re.compile(r"^[+-]?\d+(/[+-]?\d+)?$")
REL_RE = re.compile(r"^(ST|VR|UR|YR\*?|UR\*?|ST\*?|VR\*?)$", re.I)

MANUFACTURER_FRAGMENTS = frozenset({
    "malorian", "colt", "federated", "militech", "budget", "sternmeyer",
    "dauma", "heckler", "koch", "arasaka", "tsunami", "nova", "kendachi",
    "constitutional", "beretta", "ruger", "remington", "kalashnikov",
    "winchester", "dai", "lung", "espinoza", "towa", "seburo",
})


def reference_book_path() -> Path:
    path = pdf_library_dir() / REFERENCE_BOOK_NAME
    if not path.is_file():
        raise FileNotFoundError(f"Reference Book not found: {path}")
    return path


def is_weapon_listing_page(text: str) -> bool:
    return "WEAPON LISTING" in text and "Name Type WA Con." in text


def parse_source_suffix(line: str, codes: list[str]) -> tuple[str | None, str]:
    stripped = line.rstrip()
    for code in codes:
        if stripped.endswith(" " + code):
            return code, stripped[: -len(code)].rstrip()
        if stripped.endswith(code):
            return code, stripped[: -len(code)].rstrip()
    return None, stripped


def parse_stats_tail(tail: str) -> dict:
    tokens = tail.split()
    if len(tokens) < 4:
        return {"parse_error": "too_few_tokens", "tail": tail}

    cost = tokens.pop()
    if not (COST_RE.match(cost) or cost.replace("+", "").replace(",", "").isdigit()):
        tokens.append(cost)
        cost = None
    else:
        cost = cost.rstrip("+").replace(",", "")

    range_m = None
    if tokens:
        candidate = tokens[-1]
        if RANGE_RE.match(candidate):
            range_m = tokens.pop()
            if range_m.upper() == "- SW":
                range_m = "- SW"

    reliability = tokens.pop() if tokens and REL_RE.match(tokens[-1]) else None
    rof = tokens.pop() if tokens else None
    shots = tokens.pop() if tokens else None

    wa = conceal = avail = None
    damage = " ".join(tokens)

    if len(tokens) >= 3 and len(tokens[2]) <= 2:
        wa = tokens[0]
        conceal = tokens[1]
        avail = tokens[2]
        damage = " ".join(tokens[3:])
    elif len(tokens) >= 2:
        wa = tokens[0]
        conceal = tokens[1]
        damage = " ".join(tokens[2:])

    bod_min = None
    bod_match = re.search(r"\(B(\d+)\)", damage or "")
    if bod_match:
        bod_min = int(bod_match.group(1))

    ammo_match = re.search(r"\(([^)]+)\)\s*$", damage or "")
    ammo = ammo_match.group(1) if ammo_match else None

    return {
        "wa": wa,
        "conceal": conceal,
        "availability": avail,
        "damage": damage,
        "ammo": ammo,
        "bod_min": bod_min,
        "shots": shots,
        "rof": rof,
        "reliability": reliability,
        "range": range_m,
        "cost": cost,
    }


def find_weapon_type_match(text: str) -> re.Match | None:
    """Pick the type token before stat columns, not name fragments like 'Hvy'."""
    matches = list(TYPE_RE.finditer(text))
    for match in reversed(matches):
        if STAT_START_RE.match(text[match.end():]):
            return match
    return matches[-1] if matches else None


def validate_weapon_row(parsed: dict) -> str | None:
    stats = parsed.get("stats", {})
    if stats.get("parse_error"):
        return stats["parse_error"]

    name = parsed.get("name", "").strip()
    name_tokens = name.split()
    if len(name_tokens) == 1:
        if normalize_fragment(name) in MANUFACTURER_FRAGMENTS:
            return "manufacturer_fragment_name"

    wa = stats.get("wa")
    if wa is not None and not WA_RE.match(str(wa)):
        return "invalid_wa"

    if not name:
        return "empty_name"

    return None


def normalize_fragment(text: str) -> str:
    return text.lower().strip()


def parse_weapon_line(line: str, codes: list[str]) -> dict | None:
    line = line.strip()
    if not line or line.startswith("Name Type"):
        return None
    if SECTION_HEADERS.match(line):
        return None
    if line.startswith("3.") and "Information" in line:
        return None
    if "WEAPON LISTING" in line:
        return None

    source_code, without_source = parse_source_suffix(line, codes)
    if not source_code:
        return None

    match = find_weapon_type_match(without_source)
    if not match:
        return None

    weapon_type = match.group(1).upper()
    if weapon_type not in WEAPON_TYPES:
        return None

    name = without_source[: match.start()].strip()
    tail = without_source[match.end() :].strip()
    if not name:
        return None

    stats = parse_stats_tail(tail)
    return {
        "name": name,
        "weapon_type": weapon_type,
        "source_code": source_code,
        "stats": stats,
        "raw_line": line,
    }


def merge_line_buffer(buffer: str, line: str) -> str:
    return f"{buffer} {line}".strip()


def parse_reference_weapons() -> dict:
    ensure_dirs()
    book_codes = load_book_codes()
    code_list = source_codes_sorted(book_codes)
    library = list_library_pdfs()
    reader = PdfReader(str(reference_book_path()))

    weapons: list[dict] = []
    rejected: list[dict] = []
    rejection_reasons: Counter[str] = Counter()
    current_section = None
    line_buffer = ""

    for page_index, page in enumerate(reader.pages):
        text = page.extract_text() or ""
        if not is_weapon_listing_page(text):
            continue

        page_num = page_index + 1
        for raw_line in text.split("\n"):
            line = raw_line.strip()
            if SECTION_HEADERS.match(line) and "WEAPON" not in line.upper():
                current_section = line
                line_buffer = ""
                continue

            if not line:
                continue

            candidate_lines = []
            if line_buffer:
                candidate_lines.append(merge_line_buffer(line_buffer, line))
                candidate_lines.append(line)
            else:
                candidate_lines.append(line)

            parsed = None
            used_line = line
            for candidate in candidate_lines:
                parsed = parse_weapon_line(candidate, code_list)
                if parsed:
                    used_line = candidate
                    break

            if not parsed:
                if not parse_source_suffix(line, code_list)[0]:
                    if line_buffer:
                        line_buffer = merge_line_buffer(line_buffer, line)
                    else:
                        line_buffer = line
                continue

            line_buffer = ""
            reason = validate_weapon_row(parsed)
            if reason:
                rejected.append({**parsed, "reject_reason": reason, "ref_page": page_num})
                rejection_reasons[reason] += 1
                continue

            code = parsed["source_code"]
            meta = book_codes.get(code, {})
            parsed["ref_page"] = page_num
            parsed["section"] = current_section
            parsed["source_label"] = meta.get("label", code)
            parsed["pdf_hints"] = resolve_pdf_for_code(code, book_codes, library)
            parsed["raw_line"] = used_line
            weapons.append(parsed)

    out = {
        "source_pdf": REFERENCE_BOOK_NAME,
        "source_note": "Andrew James Reference Book v5 — bootstrap index, verify against official PDFs",
        "weapon_count": len(weapons),
        "rejected_rows": len(rejected),
        "rejection_reasons": dict(rejection_reasons),
        "weapons": weapons,
    }
    write_json(PARSED_DIR / "reference-weapons.json", out)
    return out


def build_weapon_inventory(parsed: dict) -> None:
    import yaml

    book_codes = load_book_codes()
    items = []
    for w in parsed["weapons"]:
        code = w["source_code"]
        items.append({
            "name": w["name"],
            "category": w.get("section"),
            "weapon_type": w["weapon_type"],
            "source": {
                "code": code,
                "label": w.get("source_label") or book_codes.get(code, {}).get("label", code),
                "ref_book_page": w["ref_page"],
                "pdf_hints": w.get("pdf_hints", []),
            },
            "stats": w.get("stats", {}),
            "raw_line": w.get("raw_line"),
            "compendium": {
                "matched": False,
                "pack": None,
                "file": None,
                "name": None,
            },
        })

    inv_path = INVENTORY_DIR / "weapons.yaml"
    inv_path.parent.mkdir(parents=True, exist_ok=True)
    meta = {
        "bootstrap": REFERENCE_BOOK_NAME,
        "count": len(items),
        "rejected_rows": parsed.get("rejected_rows", 0),
        "rejection_reasons": parsed.get("rejection_reasons", {}),
    }
    inv_path.write_text(
        yaml.dump(
            {"meta": meta, "weapons": items},
            allow_unicode=True,
            sort_keys=False,
            default_flow_style=False,
        ),
        encoding="utf-8",
    )

    write_json(RESEARCH_DIR / "book-codes.json", load_book_codes())


def run_parse_reference() -> None:
    parsed = parse_reference_weapons()
    build_weapon_inventory(parsed)
    print(f"Parsed {parsed['weapon_count']} weapons from Reference Book")
    if parsed.get("rejected_rows"):
        print(f"  Rejected {parsed['rejected_rows']} rows: {parsed.get('rejection_reasons', {})}")
    print(f"  → {PARSED_DIR / 'reference-weapons.json'}")
    print(f"  → {INVENTORY_DIR / 'weapons.yaml'}")
