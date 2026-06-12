from pypdf import PdfReader
from common import pdf_library_dir, REFERENCE_BOOK_NAME
path = pdf_library_dir() / REFERENCE_BOOK_NAME
reader = PdfReader(str(path))
page = reader.pages[81]
text = page.extract_text()
print("GEAR LISTING" in text)
