import json
from pathlib import Path

def validate():
    parsed_dir = Path(".research/parsed")
    files = list(parsed_dir.glob("reference-*.json"))
    
    total_items = 0
    all_names = set()
    duplicates = []
    
    for f in files:
        if f.name == "reference-weapons.json":
            with open(f, 'r') as fp:
                data = json.load(fp)
                items = data.get("weapons", [])
        else:
            with open(f, 'r') as fp:
                items = json.load(fp)
                
        category = f.name.replace("reference-", "").replace(".json", "")
        print(f"[{category}] Count: {len(items)}")
        
        for item in items:
            name = item.get("name")
            if not name: continue
            name_lower = name.lower().strip()
            
            total_items += 1
            if name_lower in all_names:
                duplicates.append((name_lower, category))
            else:
                all_names.add(name_lower)
                
    print(f"\nTotal unique names: {len(all_names)}")
    print(f"Total items evaluated: {total_items}")
    print(f"Total duplicates across all files: {len(duplicates)}")
    if duplicates:
        print(f"Sample duplicates: {duplicates[:10]}")

if __name__ == '__main__':
    validate()
