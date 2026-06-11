import json
import re
from pathlib import Path

def build_description_map():
    desc_map = {}
    for f in Path(".research/extracted").glob("*.md"):
        with open(f, 'r') as fp:
            text = fp.read()
            
        # Split by double newline to get paragraphs
        paragraphs = text.split('\n\n')
        for p in paragraphs:
            p = p.strip()
            if not p: continue
            
            # Match: "Name: Description..." or "**Name**: Description..." or "Name. Description..."
            # Keep it simple: look for the first colon or period in the first line.
            lines = p.split('\n')
            first_line = lines[0]
            
            match = re.match(r'^(?:\*\*)?(.+?)(?:\*\*)?[:\.\-]\s*(.+)', p, re.IGNORECASE | re.DOTALL)
            if match:
                name = match.group(1).strip().lower()
                desc = match.group(2).strip()
                
                # Clean up PDF newlines
                desc = re.sub(r'(?<!\n)\n(?!\n)', ' ', desc)
                desc = re.sub(r'\s+', ' ', desc)
                
                if len(name) > 2 and len(desc) > 10:
                    if name not in desc_map or len(desc) > len(desc_map[name]):
                        desc_map[name] = desc
    return desc_map

def enrich_file(filepath, desc_map):
    with open(filepath, 'r') as f:
        data = json.load(f)
        
    items = data.get("weapons", data) if isinstance(data, dict) and "weapons" in data else data
    
    matched_count = 0
    for item in items:
        name = item.get("name", "").strip().lower()
        if not name: continue
        
        # Try direct match
        desc = desc_map.get(name)
        
        if desc:
            if "description" in item and len(item["description"]) > 20:
                item["full_description"] = desc
            else:
                item["description"] = desc
            matched_count += 1
                
    with open(filepath, 'w') as f:
        json.dump(data, f, indent=2)
        
    return matched_count, len(items)

def main():
    print("Building description map...")
    desc_map = build_description_map()
    print(f"Extracted {len(desc_map)} descriptive paragraphs.")
    
    parsed_dir = Path(".research/parsed")
    files = list(parsed_dir.glob("reference-*.json"))
    
    total_matched = 0
    total_items = 0
    
    print("Enriching files...")
    for f in files:
        matched, count = enrich_file(f, desc_map)
        print(f"[{f.name}] Enriched {matched}/{count} items.")
        total_matched += matched
        total_items += count
        
    print(f"\nTotal enriched: {total_matched}/{total_items} ({(total_matched/total_items)*100:.1f}%)")

if __name__ == '__main__':
    main()
