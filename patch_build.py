import re

with open("tools/research/build_vtt_packs.py", "r") as f:
    code = f.read()

# Add imports and globals at the top
header = """import json
import hashlib
import string
import shutil
import re
import os
from pathlib import Path

preserve_data = {"items": [], "packs": {}}
stats = {"created": 0, "overwritten": 0, "skipped": 0, "deleted_ghosts": 0}
existing_items = {} # pack_name -> { id -> filepath }

def load_preserve_data():
    global preserve_data
    try:
        with open("tools/compendium-manager/preserve.json", "r") as f:
            preserve_data = json.load(f)
            if "items" not in preserve_data: preserve_data["items"] = []
            if "packs" not in preserve_data: preserve_data["packs"] = {}
    except:
        pass

def scan_existing_items(out_dir):
    global existing_items
    for d in ["pistols", "smgs", "rifles", "shotguns", "heavyWeapons", "melee", "bows", "exotics", "cyberware", "vehicles", "gear", "netware", "ammo", "armor", "weapons_other"]:
        pack_path = out_dir / d
        existing_items[d] = {}
        if pack_path.exists():
            for p in pack_path.glob("*.json"):
                try:
                    with open(p, "r") as f:
                        j = json.load(f)
                        existing_items[d][j.get("_id", "")] = p
                except:
                    pass

def save_item(vtt, file_path, pack_name):
    global stats
    _id = vtt["_id"]
    mode = preserve_data["packs"].get(pack_name, "none")
    
    is_preserved = _id in preserve_data["items"]
    is_existing = pack_name in existing_items and _id in existing_items[pack_name]
    
    if mode == "freeze":
        stats["skipped"] += 1
        return
        
    if mode == "protect" and is_existing:
        stats["skipped"] += 1
        return
        
    if is_preserved:
        stats["skipped"] += 1
        return

    # To avoid duplicates with changed filenames, if an old file exists, we delete it first
    if is_existing and existing_items[pack_name][_id] != file_path:
        try:
            existing_items[pack_name][_id].unlink()
        except: pass

    if is_existing:
        stats["overwritten"] += 1
    else:
        stats["created"] += 1
        
    with open(file_path, "w") as f:
        json.dump(vtt, f, indent=2)
"""

code = re.sub(r'^import json.*?\nfrom pathlib import Path\n', header, code, flags=re.MULTILINE|re.DOTALL)

# Replace all file saving logic
save_logic = r'with open\(file_path, "w"\) as f:\s*json\.dump\(vtt, f, indent=2\)'
new_save = r'save_item(vtt, file_path, target_dir.name)'
code = re.sub(save_logic, new_save, code)

# Replace main
main_start = code.find('def main():')
new_main = """def main():
    in_dir = Path(".research/parsed")
    out_dir = Path("packs-src")
    
    load_preserve_data()
    scan_existing_items(out_dir)
            
    print("Converting Weapons...")
    with open(in_dir / "reference-weapons.json", "r") as f:
        process_weapons(json.load(f)["weapons"], out_dir)
        
    print("Converting Cyberware...")
    with open(in_dir / "reference-cyberware.json", "r") as f:
        process_cyberware(json.load(f), out_dir)
        
    print("Converting Vehicles...")
    with open(in_dir / "reference-vehicles.json", "r") as f:
        process_vehicles(json.load(f), out_dir)
        
    print("Converting Gear...")
    with open(in_dir / "reference-gear.json", "r") as f:
        process_gear(json.load(f), out_dir, "gear")
        
    print("Converting Netware...")
    with open(in_dir / "reference-netware.json", "r") as f:
        process_gear(json.load(f), out_dir, "netware")
        
    print("Converting Ammo...")
    with open(in_dir / "reference-ammo.json", "r") as f:
        process_gear(json.load(f), out_dir, "ammo")
        
    print("Converting Armor...")
    if (in_dir / "reference-armor.json").exists():
        with open(in_dir / "reference-armor.json", "r") as f:
            process_armor_list(json.load(f), out_dir)
            
    print(f"Conversion complete. Created: {stats['created']}, Overwritten: {stats['overwritten']}, Skipped: {stats['skipped']}")

if __name__ == "__main__":
    main()
"""
code = code[:main_start] + new_main

with open("tools/research/build_vtt_packs.py", "w") as f:
    f.write(code)

