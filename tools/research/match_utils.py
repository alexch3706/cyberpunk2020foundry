"""Multi-signal weapon matching between Reference Book inventory and packs-src."""

from __future__ import annotations

import json
import re
from difflib import SequenceMatcher
from pathlib import Path

from common import TOOLS_DIR, normalize_name, slug_name

REF_TYPE_TO_PACK: dict[str, str] = {
    "P": "pistols",
    "RIF": "rifles",
    "SMG": "smgs",
    "MEL": "melee",
    "SHT": "rifles",
    "HVY": "rifles",
    "EX": "rifles",
    "MP": "smgs",
    "GRN": "rifles",
    "MLG": "rifles",
    "BOW": "rifles",
    "FLM": "rifles",
}

COMPENDIUM_TYPE_TO_PACK: dict[str, str] = {
    "pistol": "pistols",
    "rifle": "rifles",
    "smg": "smgs",
    "melee": "melee",
    "shotgun": "rifles",
    "heavy weapon": "rifles",
    "exotic": "rifles",
}

STOP_TOKENS = frozenset({
    "arms", "arm", "inc", "the", "a", "an", "model", "mod", "type",
    "heavy", "light", "hvy", "lgt", "super", "auto", "assault", "of",
    "and", "mk", "series", "gun", "weapon", "pistol", "rifle",
})

MANUFACTURER_TOKENS = frozenset({
    "malorian", "colt", "federated", "militech", "budget", "sternmeyer",
    "dauma", "heckler", "koch", "arasaka", "militech", "tsunami",
    "nova", "kendachi", "constitutional", "fn", "ral", "beretta",
    "ruger", "smith", "wesson", "remington", "kalashnikov",
})

TIER_HIGH = 0.9
TIER_PROBABLE = 0.75
MATCH_THRESHOLD = 0.75

_aliases_cache: dict[str, list[str]] | None = None
_source_cache: dict | None = None


def load_name_aliases() -> dict[str, list[str]]:
    global _aliases_cache
    if _aliases_cache is None:
        path = TOOLS_DIR / "name_aliases.json"
        _aliases_cache = json.loads(path.read_text(encoding="utf-8"))
    return _aliases_cache


def load_source_aliases() -> dict:
    global _source_cache
    if _source_cache is None:
        path = TOOLS_DIR / "source_aliases.json"
        _source_cache = json.loads(path.read_text(encoding="utf-8"))
    return _source_cache


def expand_name_variants(name: str) -> set[str]:
    variants = {normalize_name(name), slug_name(name)}
    aliases = load_name_aliases()
    queue = [name.strip()]
    seen = set()
    while queue:
        current = queue.pop(0)
        if current in seen:
            continue
        seen.add(current)
        variants.add(normalize_name(current))
        variants.add(slug_name(current))
        for key, values in aliases.items():
            if current == key or normalize_name(current) == normalize_name(key):
                for alt in values:
                    queue.append(alt)
            elif current in values or normalize_name(current) == normalize_name(key):
                queue.append(key)
                for alt in values:
                    queue.append(alt)
    return variants


def significant_tokens(name: str) -> set[str]:
    tokens = set(normalize_name(name).split())
    return {t for t in tokens if t not in STOP_TOKENS and len(t) > 1}


def jaccard(a: set[str], b: set[str]) -> float:
    if not a or not b:
        return 0.0
    union = a | b
    return len(a & b) / len(union)


def normalize_damage(damage: str | None) -> str:
    if not damage:
        return ""
    text = damage.lower()
    text = re.sub(r"\([^)]*\)", "", text)
    text = re.sub(r"[^\w+*/-]", "", text)
    return text


def parse_cost(cost: str | None) -> tuple[int | None, int | None]:
    if not cost:
        return None, None
    text = cost.strip().rstrip("+")
    if "-" in text and not text.startswith("-"):
        parts = text.split("-", 1)
        try:
            return int(parts[0]), int(parts[1])
        except ValueError:
            return None, None
    digits = re.sub(r"[^\d]", "", text)
    if digits:
        val = int(digits)
        return val, val
    return None, None


def costs_overlap(ref_cost: str | None, comp_cost: str | None) -> bool:
    r_lo, r_hi = parse_cost(ref_cost)
    c_lo, c_hi = parse_cost(comp_cost)
    if r_lo is None or c_lo is None:
        return False
    return not (r_hi < c_lo or c_hi < r_lo)


def infer_source_codes(source: str) -> set[str]:
    if not source:
        return set()
    src = source.lower()
    codes: set[str] = set()
    cfg = load_source_aliases()
    for pattern, mapped in cfg.get("url_patterns", {}).items():
        if pattern in src:
            codes.update(mapped)
    for pattern, mapped in cfg.get("string_patterns", {}).items():
        if pattern.lower() in src:
            codes.update(mapped)
    return codes


def pack_for_ref_type(ref_type: str) -> str | None:
    return REF_TYPE_TO_PACK.get(ref_type.upper())


def pack_for_compendium(item: dict) -> str:
    return item["pack"]


def type_pack_match(ref_type: str, item: dict) -> bool:
    expected = pack_for_ref_type(ref_type)
    if not expected:
        return True
    comp_type = (item.get("weapon_type") or "").lower()
    comp_pack = pack_for_compendium(item)
    mapped = COMPENDIUM_TYPE_TO_PACK.get(comp_type)
    if mapped:
        return mapped == expected
    return comp_pack == expected


def manufacturer_only_overlap(ref_tokens: set[str], comp_tokens: set[str]) -> bool:
    shared = ref_tokens & comp_tokens
    if not shared:
        return False
    if len(shared) >= 2:
        return False
    token = next(iter(shared))
    return token in MANUFACTURER_TOKENS


def stat_key_match(ref_stats: dict, item: dict) -> bool:
    ref_damage = normalize_damage(ref_stats.get("damage"))
    comp_damage = normalize_damage(item.get("damage"))
    if ref_damage and comp_damage and ref_damage == comp_damage:
        return True
    if costs_overlap(ref_stats.get("cost"), item.get("cost")):
        return True
    return False


def score_match(
    ref_name: str,
    ref_type: str,
    ref_stats: dict,
    ref_source_code: str,
    item: dict,
    *,
    ref_variants: set[str] | None = None,
    ref_tokens: set[str] | None = None,
) -> tuple[float, str]:
    ref_variants = ref_variants or expand_name_variants(ref_name)
    ref_tokens = ref_tokens or significant_tokens(ref_name)
    comp_norm = item["norm"]
    comp_slug = item["slug"]

    if comp_norm in ref_variants or comp_slug in ref_variants:
        return 1.0, "exact_alias"

    ref_tokens = significant_tokens(ref_name)
    comp_tokens = item["tokens"]
    token_score = jaccard(ref_tokens, comp_tokens)
    slug_score = SequenceMatcher(None, slug_name(ref_name), comp_slug).ratio()
    name_score = max(token_score, slug_score * 0.95)

    if manufacturer_only_overlap(ref_tokens, comp_tokens):
        if not stat_key_match(ref_stats, item):
            return 0.0, "manufacturer_only"

    if len(ref_tokens & comp_tokens) < 2 and not stat_key_match(ref_stats, item):
        if name_score < 0.5:
            return 0.0, "insufficient_tokens"

    score = name_score * 0.55

    if type_pack_match(ref_type, item):
        score += 0.15
    else:
        score -= 0.2

    if stat_key_match(ref_stats, item):
        score += 0.2

    source_codes = infer_source_codes(item.get("source", ""))
    if ref_source_code in source_codes:
        score += 0.1

    if comp_norm in normalize_name(ref_name) or normalize_name(ref_name) in comp_norm:
        score = max(score, 0.88)

    score = min(score, 1.0)
    method = "multi_signal"
    if score >= 0.95:
        method = "high_name+stats"
    elif stat_key_match(ref_stats, item) and name_score >= 0.4:
        method = "stats+tokens"

    return score, method


def match_tier(score: float) -> str:
    if score >= TIER_HIGH:
        return "high"
    if score >= TIER_PROBABLE:
        return "probable"
    return "low"


def find_best_match(
    ref_name: str,
    ref_type: str,
    ref_stats: dict,
    ref_source_code: str,
    compendium: list[dict],
    used: set[str],
) -> tuple[dict | None, float, str, str]:
    best_item = None
    best_score = 0.0
    best_method = ""
    best_tier = "low"

    ref_variants = expand_name_variants(ref_name)
    ref_tokens = significant_tokens(ref_name)
    expected_pack = pack_for_ref_type(ref_type)
    candidates = compendium
    if expected_pack:
        filtered = [c for c in compendium if c["pack"] == expected_pack]
        if filtered:
            candidates = filtered

    for item in candidates:
        key = f"{item['pack']}/{item['file']}"
        if key in used:
            continue
        score, method = score_match(
            ref_name,
            ref_type,
            ref_stats,
            ref_source_code,
            item,
            ref_variants=ref_variants,
            ref_tokens=ref_tokens,
        )
        if score > best_score and score >= MATCH_THRESHOLD:
            best_score = score
            best_item = item
            best_method = method
            best_tier = match_tier(score)

    return best_item, best_score, best_method, best_tier
