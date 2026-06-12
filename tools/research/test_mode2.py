from pypdf import PdfReader
from common import pdf_library_dir, REFERENCE_BOOK_NAME
path = pdf_library_dir() / REFERENCE_BOOK_NAME
reader = PdfReader(str(path))
modes = set()
for i, page in enumerate(reader.pages):
    if i < 30: continue
    text = page.extract_text()
    if not text: continue
    
    mode = None
    if "CYBERWARE LISTING" in text:
        mode = "cyberware"
    elif "NETWARE LISTING" in text:
        mode = "netware"
    elif "GEAR LISTING" in text:
        mode = "gear"
    elif "ARMOR COVERS SP" in text or "ARMOR" in text and "COVERS" in text and "EV" in text:
        mode = "armor"
    if mode: modes.add(mode)
print(modes)
