"""Match Reference Book weapon inventory against packs-src compendium."""

from __future__ import annotations

import json
from collections import defaultdict

import yaml

from common import INVENTORY_DIR, PACKS_SRC, WEAPON_PACKS, normalize_name, slug_name, write_json
from match_utils import TIER_HIGH, TIER_PROBABLE, find_best_match, significant_tokens


def load_compendium_weapons() -> list[dict]:
    items = []
    for pack in WEAPON_PACKS:
        pack_dir = PACKS_SRC / pack
        if not pack_dir.is_dir():
            continue
        for path in pack_dir.glob("*.json"):
            data = json.loads(path.read_text(encoding="utf-8"))
            weapon_data = data.get("data", {})
            items.append({
                "name": data.get("name", ""),
                "pack": pack,
                "file": path.name,
                "source": weapon_data.get("source", ""),
                "weapon_type": weapon_data.get("weaponType", ""),
                "cost": str(weapon_data.get("cost", "")),
                "damage": weapon_data.get("damage", ""),
                "range": str(weapon_data.get("range", "")),
                "norm": normalize_name(data.get("name", "")),
                "slug": slug_name(data.get("name", "")),
                "tokens": significant_tokens(data.get("name", "")),
            })
    return items


def run_diff_weapons() -> None:
    inv_path = INVENTORY_DIR / "weapons.yaml"
    if not inv_path.is_file():
        raise FileNotFoundError(f"Run parse-reference first. Missing {inv_path}")

    inventory = yaml.safe_load(inv_path.read_text(encoding="utf-8"))
    compendium = load_compendium_weapons()
    used_compendium: set[str] = set()

    tier_counts = {"high": 0, "probable": 0}
    matched = 0

    for entry in inventory.get("weapons", []):
        hit, score, method, tier = find_best_match(
            entry["name"],
            entry.get("weapon_type", ""),
            entry.get("stats", {}),
            entry["source"]["code"],
            compendium,
            used_compendium,
        )
        entry["match_score"] = round(score, 3) if hit else 0.0
        entry["match_method"] = method if hit else None
        entry["match_tier"] = tier if hit else None

        if hit and tier == "high":
            matched += 1
            tier_counts["high"] += 1
            key = f"{hit['pack']}/{hit['file']}"
            used_compendium.add(key)
            entry["compendium"] = {
                "matched": True,
                "pack": hit["pack"],
                "file": hit["file"],
                "name": hit["name"],
                "source": hit["source"],
            }
        else:
            entry["compendium"] = {"matched": False, "pack": None, "file": None, "name": None}
            if hit and tier == "probable":
                entry["compendium"]["probable"] = {
                    "pack": hit["pack"],
                    "file": hit["file"],
                    "name": hit["name"],
                    "score": round(score, 3),
                    "method": method,
                }

    for entry in inventory.get("weapons", []):
        if entry["compendium"]["matched"]:
            continue
        probable = entry["compendium"].get("probable")
        if not probable:
            continue
        key = f"{probable['pack']}/{probable['file']}"
        if key in used_compendium:
            entry["compendium"].pop("probable", None)
            continue
        matched += 1
        tier_counts["probable"] += 1
        used_compendium.add(key)
        entry["compendium"] = {
            "matched": True,
            "pack": probable["pack"],
            "file": probable["file"],
            "name": probable["name"],
            "source": next(
                (c["source"] for c in compendium if c["file"] == probable["file"]),
                "",
            ),
            "match_tier": "probable",
        }

    inv_path.write_text(
        yaml.dump(inventory, allow_unicode=True, sort_keys=False, default_flow_style=False),
        encoding="utf-8",
    )

    ref_only = [w for w in inventory["weapons"] if not w["compendium"]["matched"]]
    probable_unmatched = [
        w for w in inventory["weapons"]
        if not w["compendium"]["matched"] and w.get("compendium", {}).get("probable")
    ]
    pack_only = [c for c in compendium if f"{c['pack']}/{c['file']}" not in used_compendium]

    by_source = defaultdict(list)
    for w in ref_only:
        by_source[w["source"]["code"]].append(w["name"])

    lines = [
        "# Weapons gap report",
        "",
        f"- Reference Book weapons: **{len(inventory['weapons'])}**",
        f"- packs-src weapons: **{len(compendium)}**",
        f"- Matched (high tier, score≥{TIER_HIGH}): **{tier_counts['high']}**",
        f"- Matched (probable tier, {TIER_PROBABLE}–{TIER_HIGH}): **{tier_counts['probable']}**",
        f"- Total matched: **{matched}**",
        f"- In Reference Book only: **{len(ref_only)}**",
        f"- Probable matches pending review: **{len(probable_unmatched)}**",
        f"- In packs-src only: **{len(pack_only)}**",
        "",
        "## Probable matches (needs review)",
        "",
    ]
    for w in sorted(probable_unmatched, key=lambda x: -x.get("match_score", 0))[:50]:
        prob = w["compendium"]["probable"]
        lines.append(
            f"- {w['name']} → [{prob['pack']}] {prob['name']} "
            f"(score {prob['score']}, {prob['method']})"
        )
    if len(probable_unmatched) > 50:
        lines.append(f"- … and {len(probable_unmatched) - 50} more")
    lines.extend(["", "## In Reference Book, not in packs-src (by source code)", ""])

    for code in sorted(by_source.keys()):
        names = by_source[code]
        lines.append(f"### {code} ({len(names)})")
        for name in sorted(names)[:30]:
            lines.append(f"- {name}")
        if len(names) > 30:
            lines.append(f"- … and {len(names) - 30} more")
        lines.append("")

    lines.extend(["## Sample packs-src-only (first 40)", ""])
    for item in sorted(pack_only, key=lambda x: x["name"])[:40]:
        lines.append(f"- [{item['pack']}] {item['name']} (`{item['source']}`)")
    if len(pack_only) > 40:
        lines.append(f"- … and {len(pack_only) - 40} more")

    gaps_path = INVENTORY_DIR / "weapons-gaps.md"
    gaps_path.write_text("\n".join(lines) + "\n", encoding="utf-8")

    summary = {
        "reference_count": len(inventory["weapons"]),
        "compendium_count": len(compendium),
        "matched_high": tier_counts["high"],
        "matched_probable": tier_counts["probable"],
        "matched_total": matched,
        "reference_only": len(ref_only),
        "probable_pending": len(probable_unmatched),
        "compendium_only": len(pack_only),
    }
    write_json(INVENTORY_DIR / "weapons-diff-summary.json", summary)

    print(
        f"Matched {matched}/{len(inventory['weapons'])} reference weapons to packs-src "
        f"(high={tier_counts['high']}, probable={tier_counts['probable']})"
    )
    print(f"  → {gaps_path}")
    print(f"  → {inv_path}")
