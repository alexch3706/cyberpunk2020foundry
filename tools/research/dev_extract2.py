from pypdf import PdfReader
from common import pdf_library_dir, REFERENCE_BOOK_NAME

path = pdf_library_dir() / REFERENCE_BOOK_NAME
reader = PdfReader(str(path))
out = []
# Vehicles is around page 91-105? 
# "VEHICLE LISTING" was around line 340 in ToC -> 6.1
for p in range(70, 95):
    out.append(f"--- PAGE {p+1} ---")
    out.append(reader.pages[p].extract_text())
    
with open(".research/dump_vehicles.txt", "w") as f:
    f.write("\n".join(out))
