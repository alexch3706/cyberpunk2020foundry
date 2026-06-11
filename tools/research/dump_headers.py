from pypdf import PdfReader
from common import pdf_library_dir, REFERENCE_BOOK_NAME

path = pdf_library_dir() / REFERENCE_BOOK_NAME
reader = PdfReader(str(path))
for i, page in enumerate(reader.pages):
    text = page.extract_text()
    if not text: continue
    lines = text.split("\n")
    for j, line in enumerate(lines):
        if "LISTING" in line:
            print(f"Page {i+1}: {line}")
            # print next 5 lines
            for k in range(1, 6):
                if j+k < len(lines):
                    print(f"  {lines[j+k]}")
