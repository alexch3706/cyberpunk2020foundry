from pypdf import PdfReader
from common import pdf_library_dir, REFERENCE_BOOK_NAME
import re

def parse_armor_line(line):
    match = re.search(r'\s(\d+(?:/\d+)*(?:\(s\))?(?:\s+vs\s+[A-Za-z]+)?)\s+([\+\-]\d+(?:\.\d+)?(?:/[a-z]+)?)\s+(.*)$', line)
    if not match: return None
    sp = match.group(1).strip()
    ev = match.group(2).strip()
    rest = match.group(3).strip()
    front = line[:match.start()].strip()
    covers_match = re.search(r'\b(Torso|Arms|Legs|Head|Whole Body|Any where|Any location|Feet|Arm)\b(.*)$', front, re.IGNORECASE)
    if covers_match:
        covers = covers_match.group(0).strip()
        name = front[:covers_match.start()].strip()
    else:
        covers = ""
        name = front
    return {"name": name, "covers": covers, "sp": sp, "ev": ev, "cost_source_notes": rest}

path = pdf_library_dir() / REFERENCE_BOOK_NAME
reader = PdfReader(str(path))
for i in [81, 82, 83]:
    page = reader.pages[i]
    text = page.extract_text()
    for line in text.split('\n'):
        line = line.strip()
        parsed = parse_armor_line(line)
        if parsed and "ARMOR" not in parsed['name'].upper():
            print(f"MATCH: {parsed}")
        elif len(line) > 10 and not parsed:
            # print(f"FAIL: {line}")
            pass
