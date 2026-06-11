import re
import json
from pathlib import Path
from pypdf import PdfReader
from common import pdf_library_dir, REFERENCE_BOOK_NAME

def parse_ammo_table(text):
    # This is a very rough heuristic parser for Ammo & Add-ons
    items = []
    current_category = "General"
    
    for line in text.split('\n'):
        line = line.strip()
        if not line: continue
        
        # Skip headers
        if "Information" in line or "R.Talsorian" in line or "ajames@" in line: continue
        if "CYBERPUNK" in line and "AMMO" in line: continue
        if "--- PAGE" in line: continue
        
        # If line doesn't have numbers or typical damage dice, it might be a category header
        # or if it's very short.
        # But wait, "Shotgun Rounds" is a category. "12 Gauge (15eb/12)" is a category.
        # Let's say if it doesn't have a space followed by a number or 'd6' or 'eb'
        # Actually, let's just make it simple: first 1-3 words are name, rest is description
        match = re.search(r'^(.+?)(?:\s+(.*?\d+.*?|.*d6.*|.*eb.*))?$', line)
        if match:
            # We just take the whole line, and assume the first 1-3 words is name if there's no clear split
            # Actually, split by first double space? The PDF doesn't have double spaces.
            parts = line.split()
            if len(parts) <= 3 and not any(char.isdigit() for char in line):
                current_category = line
            else:
                name = parts[0]
                if len(parts) > 1 and not any(c.isdigit() for c in parts[1]):
                    name += " " + parts[1]
                desc = line[len(name):].strip()
                
                items.append({
                    "category": current_category,
                    "name": name,
                    "description": desc
                })

    return items

def main():
    with open(".research/dump_ammo.txt", "r") as f:
        text = f.read()
        
    ammo_items = parse_ammo_table(text)
    
    out_dir = Path(".research/parsed")
    out_dir.mkdir(parents=True, exist_ok=True)
    
    with open(out_dir / "reference-ammo.json", "w") as f:
        json.dump(ammo_items, f, indent=2)
        
    print(f"Parsed {len(ammo_items)} ammo/mods.")

if __name__ == '__main__':
    main()
