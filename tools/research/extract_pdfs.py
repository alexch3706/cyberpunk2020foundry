"""Batch-extract PDF text layers into .research/extracted/."""

from __future__ import annotations

import hashlib
from datetime import datetime, timezone
from pathlib import Path

from pypdf import PdfReader

from common import (
    EXTRACTED_DIR,
    RESEARCH_DIR,
    REFERENCE_BOOK_NAME,
    ensure_dirs,
    list_library_pdfs,
    pdf_library_dir,
    write_json,
)


def slugify_filename(name: str) -> str:
    stem = Path(name).stem
    out = []
    for ch in stem:
        if ch.isalnum():
            out.append(ch.lower())
        elif ch in " -_":
            out.append("-")
    slug = "".join(out)
    while "--" in slug:
        slug = slug.replace("--", "-")
    return slug.strip("-")[:120]


def extract_pdf(pdf_path: Path) -> dict:
    reader = PdfReader(str(pdf_path))
    parts = [
        f"# {pdf_path.name}",
        "",
        f"Source: `{pdf_path}`",
        f"Extracted: {datetime.now(timezone.utc).isoformat()}",
        f"Pages: {len(reader.pages)}",
        "",
    ]

    total_chars = 0
    empty_pages = 0
    for page_number, page in enumerate(reader.pages, start=1):
        text = page.extract_text() or ""
        text = text.replace("\r\n", "\n").replace("\r", "\n")
        cleaned = "\n".join(line.rstrip() for line in text.split("\n")).strip()
        if not cleaned:
            empty_pages += 1
            cleaned = "_No extractable text on this page._"
        else:
            total_chars += len(cleaned)
        parts.extend([f"## Page {page_number}", "", cleaned, ""])

    out_path = EXTRACTED_DIR / f"{slugify_filename(pdf_path.name)}.md"
    out_path.write_text("\n".join(parts), encoding="utf-8")

    digest = hashlib.sha256(pdf_path.read_bytes()).hexdigest()[:16]
    return {
        "file": pdf_path.name,
        "path": str(pdf_path),
        "sha256_prefix": digest,
        "pages": len(reader.pages),
        "chars": total_chars,
        "empty_pages": empty_pages,
        "empty_page_ratio": round(empty_pages / max(len(reader.pages), 1), 3),
        "extracted_md": out_path.name,
        "priority": "bootstrap" if pdf_path.name == REFERENCE_BOOK_NAME else "canonical",
    }


def run_extract() -> None:
    ensure_dirs()
    pdfs = list_library_pdfs()
    entries = []
    for i, pdf in enumerate(pdfs, 1):
        print(f"[{i}/{len(pdfs)}] {pdf.name}")
        try:
            entries.append(extract_pdf(pdf))
        except Exception as exc:  # noqa: BLE001 — collect per-file failures
            entries.append({"file": pdf.name, "error": str(exc)})

    manifest = {
        "generated": datetime.now(timezone.utc).isoformat(),
        "pdf_library": str(pdf_library_dir()),
        "pdf_count": len(pdfs),
        "pdfs": entries,
    }
    write_json(RESEARCH_DIR / "manifest.json", manifest)
    ok = sum(1 for e in entries if "error" not in e)
    print(f"Extracted {ok}/{len(pdfs)} PDFs → {EXTRACTED_DIR}")
    print(f"Manifest → {RESEARCH_DIR / 'manifest.json'}")
