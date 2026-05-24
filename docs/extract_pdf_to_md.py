from pathlib import Path

from pypdf import PdfReader


SOURCE = Path("docs/Cyberpunk 2020 - Core Rules.pdf")
OUTPUT = Path("docs/cyberpunk-2020-core-rules-extracted.md")


def main():
    reader = PdfReader(str(SOURCE))
    parts = [
        "# Cyberpunk 2020 Core Rules - Extracted Text",
        "",
        f"Source PDF: {SOURCE.name}",
        "",
        (
            "Extraction note: Generated from the PDF text layer with page "
            "separators for private project analysis. OCR/text quality varies "
            "by page; verify rules against the original PDF page when precision "
            "matters."
        ),
        "",
        f"Total PDF pages: {len(reader.pages)}",
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

    OUTPUT.write_text("\n".join(parts), encoding="utf-8")
    print(
        f"wrote {OUTPUT} pages={len(reader.pages)} "
        f"chars={total_chars} empty_pages={empty_pages} size={OUTPUT.stat().st_size}"
    )


if __name__ == "__main__":
    main()
