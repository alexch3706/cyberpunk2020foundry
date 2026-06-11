#!/usr/bin/env python3
"""Compendium research pipeline entrypoint."""

from __future__ import annotations

import sys
from pathlib import Path

# Allow imports when run as script
sys.path.insert(0, str(Path(__file__).resolve().parent))

from diff_weapons import run_diff_weapons
from extract_pdfs import run_extract
from parse_reference import run_parse_reference


def main() -> None:
    if len(sys.argv) < 2:
        print(__doc__)
        print("\nUsage: python tools/research/run.py <command>")
        print("Commands: parse-reference | extract | diff-weapons | bootstrap")
        sys.exit(1)

    cmd = sys.argv[1]
    if cmd == "parse-reference":
        run_parse_reference()
    elif cmd == "extract":
        run_extract()
    elif cmd == "diff-weapons":
        run_diff_weapons()
    elif cmd == "bootstrap":
        run_parse_reference()
        run_diff_weapons()
        print("\nTip: run `extract` separately — it processes the full PDF library.")
    else:
        print(f"Unknown command: {cmd}")
        sys.exit(1)


if __name__ == "__main__":
    main()
