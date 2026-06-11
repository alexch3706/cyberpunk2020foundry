from pypdf import PdfReader
from common import pdf_library_dir, REFERENCE_BOOK_NAME
import json

def dump():
    path = pdf_library_dir() / REFERENCE_BOOK_NAME
    reader = PdfReader(str(path))
    out = []
    # Cyberware is around page 106-114
    for p in range(105, 114):
        out.append(f"--- PAGE {p+1} ---")
        out.append(reader.pages[p].extract_text())
    
    with open(".research/dump_cyberware.txt", "w") as f:
        f.write("\n".join(out))

    out = []
    # Netware is around 115-126
    for p in range(114, 126):
        out.append(f"--- PAGE {p+1} ---")
        out.append(reader.pages[p].extract_text())
        
    with open(".research/dump_netware.txt", "w") as f:
        f.write("\n".join(out))

if __name__ == '__main__':
    dump()
