import re
import json
from pathlib import Path
from pypdf import PdfReader
from common import pdf_library_dir, REFERENCE_BOOK_NAME

def parse_vehicle_line(line):
    # Anchor 1: Speed Acc/Dec Crew Range Passengers
    match = re.search(r'\s+(\d+)\s+(\d+/\d+)\s+(\d+)\s+([\d,]+|\-)\s+(\d+)\s+', line)
    if not match: return None
    
    name = line[:match.start()].strip()
    top_speed = match.group(1)
    acc_dec = match.group(2)
    crew = match.group(3)
    range_ = match.group(4)
    passengers = match.group(5)
    
    rest = line[match.end():].strip()
    
    # Anchor 2: Cargo Man SDP SP Mass Cost Source
    rest_match = re.search(r'(.*?)\s+([\+\-]\d+)\s+(\d+\s*(?:\(\d+\))?)\s+(\d+)\s+(.+?)\s+([\d,/\.]+)\s*([A-Za-z0-9]*)$', rest)
    if not rest_match: return None
    
    cargo = rest_match.group(1).strip()
    man = rest_match.group(2).strip()
    sdp = rest_match.group(3).strip()
    sp = rest_match.group(4).strip()
    mass = rest_match.group(5).strip()
    cost = rest_match.group(6).strip()
    source = rest_match.group(7).strip()
    
    return {
        "name": name,
        "top_speed": top_speed,
        "acc_dec": acc_dec,
        "crew": crew,
        "range": range_,
        "passengers": passengers,
        "cargo": cargo,
        "man": man,
        "sdp": sdp,
        "sp": sp,
        "mass": mass,
        "cost": cost,
        "source": source
    }

def main():
    path = pdf_library_dir() / REFERENCE_BOOK_NAME
    reader = PdfReader(str(path))
    
    vehicles = []
    
    for i, page in enumerate(reader.pages):
        text = page.extract_text()
        if not text: continue
        
        if "VEHICLE LISTING" not in text:
            continue
            
        for line in text.split('\n'):
            line = line.strip()
            if not line or "VEHICLE LISTING" in line or "Information" in line or "R.Talsorian" in line or "ajames@" in line:
                continue
                
            parsed = parse_vehicle_line(line)
            if parsed:
                vehicles.append(parsed)

    out_dir = Path(".research/parsed")
    out_dir.mkdir(parents=True, exist_ok=True)
    
    with open(out_dir / "reference-vehicles.json", "w") as f:
        json.dump(vehicles, f, indent=2)
        
    print(f"Parsed {len(vehicles)} vehicles.")

if __name__ == '__main__':
    main()
