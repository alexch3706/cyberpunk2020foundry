import json
from pathlib import Path

parsed_dir = Path(".research/parsed")
files = list(parsed_dir.glob("reference-*.json"))

for f in files:
    with open(f, 'r') as fp:
        data = json.load(fp)
        
    items = data.get("weapons", data) if isinstance(data, dict) and "weapons" in data else data
    
    with_source = sum(1 for item in items if item.get("source") and item.get("source").strip() not in ["", "-"] )
    total = len(items)
    print(f"{f.name}: {with_source}/{total} items have a source field ({(with_source/total)*100 if total else 0:.1f}%)")

