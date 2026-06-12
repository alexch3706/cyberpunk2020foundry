import re
import json
from pathlib import Path
from pypdf import PdfReader
from common import pdf_library_dir, REFERENCE_BOOK_NAME

def parse_cyberware_line(line):
    surg_match = re.search(r'\s(N|M|MA|CR|CRx2|MA\+|CR\+|M\+|M/CR|MA/CR|CR/MA|N/MA|M/MA|M/M|CR/M|\-)\s', line)
    if not surg_match: return None
    
    name = line[:surg_match.start()].strip()
    surg = surg_match.group(1)
    rest = line[surg_match.end():].strip()
    
    rest_parts = rest.split()
    if len(rest_parts) < 3: return None
    source = rest_parts[-1]
    hl = rest_parts[-2]
    cost = rest_parts[-3]
    desc = " ".join(rest_parts[:-3])
    
    return {"name": name, "surg": surg, "description": desc, "cost": cost, "hl": hl, "source": source}

def parse_gear_line(line):
    if '....' not in line: return None
    parts = line.split('....')
    name = parts[0].strip()
    cost = parts[-1].strip().lstrip('.')
    return {"name": name, "cost": cost}

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
        
    return {
        "name": name,
        "covers": covers,
        "sp": sp,
        "ev": ev,
        "cost_source_notes": rest
    }

def parse_netware_line(line):
    match = re.search(r'^(.+?)\s+(\d+(?:-\d+)?)\s+(\d+)\s+([\d,]+)\s+(.+?)\s+([A-Z0-9]+)$', line)
    if match:
        return {
            "name": match.group(1).strip(),
            "str": match.group(2).strip(),
            "mu": match.group(3).strip(),
            "cost": match.group(4).strip(),
            "function": match.group(5).strip(),
            "source": match.group(6).strip()
        }
    return None

def main():
    path = pdf_library_dir() / REFERENCE_BOOK_NAME
    reader = PdfReader(str(path))
    
    cyberware = []
    gear = []
    netware = []
    armor = []
    
    for i, page in enumerate(reader.pages):
        if i < 30: continue
        text = page.extract_text()
        if not text: continue
        
        mode = None
        if "CYBERWARE LISTING" in text:
            mode = "cyberware"
        elif "NETWARE LISTING" in text:
            mode = "netware"
        elif "ARMOR COVERS SP" in text or ("ARMOR" in text and "COVERS" in text and "EV" in text):
            mode = "armor"
        elif "GEAR LISTING" in text:
            mode = "gear"
            
        if not mode: continue
        
        for line in text.split('\n'):
            line = line.strip()
            if not line or "LISTING" in line or "Information" in line or "R.Talsorian" in line or "ajames@" in line:
                continue
                
            if mode == "cyberware":
                parsed = parse_cyberware_line(line)
                if parsed and parsed['name'].lower() != "cyberware": cyberware.append(parsed)
            elif mode == "gear":
                parsed = parse_gear_line(line)
                if parsed: gear.append(parsed)
            elif mode == "netware":
                parsed = parse_netware_line(line)
                if parsed and parsed['name'].lower() != "netware": netware.append(parsed)
            elif mode == "armor":
                parsed = parse_armor_line(line)
                if parsed: armor.append(parsed)

    out_dir = Path(".research/parsed")
    out_dir.mkdir(parents=True, exist_ok=True)
    
    with open(out_dir / "reference-cyberware.json", "w") as f:
        json.dump(cyberware, f, indent=2)
    with open(out_dir / "reference-gear.json", "w") as f:
        json.dump(gear, f, indent=2)
    with open(out_dir / "reference-netware.json", "w") as f:
        json.dump(netware, f, indent=2)
    with open(out_dir / "reference-armor.json", "w") as f:
        json.dump(armor, f, indent=2)
        
    print(f"Parsed {len(cyberware)} cyberware, {len(gear)} gear, {len(netware)} netware, {len(armor)} armor.")

if __name__ == '__main__':
    main()
