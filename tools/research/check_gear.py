from pypdf import PdfReader
from common import pdf_library_dir, REFERENCE_BOOK_NAME

path = pdf_library_dir() / REFERENCE_BOOK_NAME
reader = PdfReader(str(path))
for p in range(70, 75):
    text = reader.pages[p].extract_text()
    if "GEAR LISTING" in text:
        print(f"--- PAGE {p+1} ---")
        lines = text.split('\n')
        # print first 30 lines of the page
        for line in lines[:30]:
            print(line)
        break
