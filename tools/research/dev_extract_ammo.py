from pypdf import PdfReader
from common import pdf_library_dir, REFERENCE_BOOK_NAME

path = pdf_library_dir() / REFERENCE_BOOK_NAME
reader = PdfReader(str(path))
out = []
# Ammo is around page 50-70? 
for p in range(50, 75):
    text = reader.pages[p].extract_text()
    if "AMMO" in text:
        out.append(f"--- PAGE {p+1} ---")
        out.append(text)
    
with open(".research/dump_ammo.txt", "w") as f:
    f.write("\n".join(out))
