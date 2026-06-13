import json
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

# Base62 encode function to ensure valid 16-char IDs
BASE62 = string.digits + string.ascii_letters
def base62_encode(num, length=16):
    if num == 0: return BASE62[0] * length
    arr = []
    base = len(BASE62)
    while num:
        num, rem = divmod(num, base)
        arr.append(BASE62[rem])
    arr.reverse()
    res = ''.join(arr)
    # Pad or truncate to exact length
    if len(res) < length: res = res.zfill(length)
    return res[-length:]

def generate_id(name):
    # Deterministic SHA256 hash converted to an integer, then Base62 encoded to 16 chars
    h = hashlib.sha256(name.encode('utf-8')).hexdigest()
    num = int(h, 16)
    return base62_encode(num, 16)

def clean_filename(name):
    return re.sub(r'[^A-Za-z0-9]', '_', name).strip('_')

def get_base_item(name, item_type, source, _id):
    return {
        "_id": _id,
        "name": name,
        "type": item_type,
        "img": "icons/svg/mystery-man.svg",
        "data": {
            "flavor": "",
            "notes": "",
            "source": source if source and source != "-" else "CP20",
            "cost": 0,
            "weight": 1
        },
        "effects": [],
        "flags": {
            "exportSource": {
                "world": "cyberpunk_2020",
                "system": "cyberpunk2020-rilerena",
                "coreVersion": "0.7.9",
                "systemVersion": "0.2.6"
            }
        }
    }

def process_weapons(items, out_dir):
    for item in items:
        name = item.get("name", "Unknown Weapon")
        _id = generate_id("weapon:" + name)
        
        wtype = item.get("weapon_type", "P")
        folder_map = {
            "P": "pistols",
            "SMG": "smgs",
            "RIF": "rifles",
            "SHT": "shotguns",
            "HVY": "heavyWeapons",
            "MEL": "melee",
            "BOW": "bows",
            "EX": "exotics"
        }
        folder = folder_map.get(wtype, "weapons_other")
        
        target_dir = out_dir / folder
        target_dir.mkdir(parents=True, exist_ok=True)
        
        vtt = get_base_item(name, "weapon", item.get("source_code"), _id)
        
        stats = item.get("stats", {})
        
        # We need a reverse map from 'wtype' string in PDF to 'weaponType' in lookups.js
        vtt_type_map = {
            "P": "Pistol",
            "MP": "Pistol", # Machine Pistols use Pistol in Foundry? Wait, lookups.js has SMG. Let's map MP to SMG or Pistol? MP usually uses Handgun, but can be SMG. I'll map MP to SMG. No, let's map P to Pistol, SMG to SMG.
            "SMG": "SMG",
            "RIF": "Rifle",
            "SHT": "Shotgun",
            "HVY": "Heavy",
            "MEL": "Melee",
            "BOW": "Exotic", # Bows are Exotic in Cyberpunk 2020 usually
            "EX": "Exotic"
        }
        
        # Determine attackType
        if wtype == "SHT": vtt["data"]["attackType"] = "Autoshotgun"
        elif wtype == "MEL": vtt["data"]["attackType"] = "Melee"
        else: vtt["data"]["attackType"] = "Auto"
            
        vtt["data"]["weaponType"] = vtt_type_map.get(wtype, "Pistol") # Default to Pistol if unknown
        vtt["data"]["accuracy"] = stats.get("wa", "0")
        vtt["data"]["concealability"] = stats.get("conceal", "")
        vtt["data"]["availability"] = stats.get("availability", "")
        vtt["data"]["ammoType"] = stats.get("ammo", "")
        raw_damage = str(stats.get("damage", ""))
        # Remove anything in parentheses (e.g. ammo types)
        clean_damage = re.sub(r'\(.*?\)', '', raw_damage)
        # Remove ranges like "1-5d6" -> "5d6"
        clean_damage = re.sub(r'\d+\s*-\s*(\d+[dD]\d+)', r'\1', clean_damage)
        # Remove any non-math characters (allow numbers, d, D, +, -, *, /, x, spaces)
        clean_damage = re.sub(r'[^0-9dD\+\-\*\/x\s]', '', clean_damage).strip()
        # Fallback if empty
        if not clean_damage:
            clean_damage = "0"
            
        vtt["data"]["damage"] = clean_damage
        vtt["data"]["shots"] = stats.get("shots", "")
        vtt["data"]["rof"] = stats.get("rof", "1")
        vtt["data"]["reliability"] = stats.get("reliability", "")
        vtt["data"]["range"] = stats.get("range", "")
        
        try:
            vtt["data"]["cost"] = float(re.sub(r'[^0-9\.]', '', stats.get("cost", "0")) or 0)
        except:
            vtt["data"]["cost"] = 0
            
        desc = item.get("full_description") or item.get("description")
        if desc:
            vtt["data"]["notes"] = f"<p>{desc}</p>"
            
        # Determine attackType
        if wtype == "SHT": vtt["data"]["attackType"] = "Autoshotgun"
        elif wtype == "MEL": vtt["data"]["attackType"] = "Melee"
        else: vtt["data"]["attackType"] = "Auto"
            
        file_path = target_dir / f"{clean_filename(name)}_{_id}.json"
        save_item(vtt, file_path, target_dir.name)

def process_cyberware(items, out_dir):
    target_dir = out_dir / "cyberware"
    target_dir.mkdir(parents=True, exist_ok=True)
    
    for item in items:
        name = item.get("name", "Unknown Cyberware")
        _id = generate_id("cyberware:" + name)
        
        vtt = get_base_item(name, "cyberware", item.get("source"), _id)
        
        try:
            vtt["data"]["cost"] = float(re.sub(r'[^0-9\.]', '', str(item.get("cost", "0"))) or 0)
        except: pass
            
        notes = []
        if item.get("surg"): notes.append(f"<b>Surgery Code:</b> {item.get('surg')}")
        if item.get("hl"): notes.append(f"<b>Humanity Loss:</b> {item.get('hl')}")
        
        desc = item.get("full_description") or item.get("description")
        if desc: notes.append(f"<p>{desc}</p>")
        
        vtt["data"]["notes"] = "<br>".join(notes)
        
        file_path = target_dir / f"{clean_filename(name)}_{_id}.json"
        save_item(vtt, file_path, target_dir.name)

def process_vehicles(items, out_dir):
    target_dir = out_dir / "vehicles"
    target_dir.mkdir(parents=True, exist_ok=True)
    for item in items:
        name = item.get("name", "Unknown Vehicle")
        _id = generate_id("vehicle:" + name)
        vtt = get_base_item(name, "vehicle", item.get("source"), _id)
        
        try:
            vtt["data"]["cost"] = float(re.sub(r'[^0-9\.]', '', str(item.get("cost", "0"))) or 0)
        except: pass
        
        notes = [
            f"<b>Top Speed:</b> {item.get('top_speed')}",
            f"<b>Acc/Dec:</b> {item.get('acc_dec')}",
            f"<b>Crew:</b> {item.get('crew')}",
            f"<b>Range:</b> {item.get('range')}",
            f"<b>Passengers:</b> {item.get('passengers')}",
            f"<b>Cargo:</b> {item.get('cargo')}",
            f"<b>Maneuver:</b> {item.get('man')}",
            f"<b>SDP:</b> {item.get('sdp')}",
            f"<b>SP:</b> {item.get('sp')}",
            f"<b>Mass:</b> {item.get('mass')}"
        ]
        
        desc = item.get("full_description") or item.get("description")
        if desc: notes.append(f"<p>{desc}</p>")
        
        vtt["data"]["notes"] = "<br>".join(notes)
        
        file_path = target_dir / f"{clean_filename(name)}_{_id}.json"
        save_item(vtt, file_path, target_dir.name)

def is_armor(name):
    # Match "(SP 14)", "SP: 10", "SP 10"
    m = re.search(r'(?i)SP\s*:?\s*(\d+)', name)
    if m:
        return True, int(m.group(1))
    
    if re.search(r'(?i)\b(armor|helmet|kevlar|flak|vest|jacket)\b', name):
        return True, 0
    return False, 0

def guess_coverage(name):
    name_lower = name.lower()
    cov = { 
        "Head": {"stoppingPower": 0, "ablation": 0}, 
        "Torso": {"stoppingPower": 0, "ablation": 0}, 
        "lArm": {"stoppingPower": 0, "ablation": 0}, 
        "rArm": {"stoppingPower": 0, "ablation": 0}, 
        "lLeg": {"stoppingPower": 0, "ablation": 0}, 
        "rLeg": {"stoppingPower": 0, "ablation": 0} 
    }
    
    has_cov = False
    if "whole body" in name_lower or "any where" in name_lower or "any location" in name_lower:
        cov["Head"]["stoppingPower"] = -1
        cov["Torso"]["stoppingPower"] = -1
        cov["lArm"]["stoppingPower"] = -1
        cov["rArm"]["stoppingPower"] = -1
        cov["lLeg"]["stoppingPower"] = -1
        cov["rLeg"]["stoppingPower"] = -1
        return cov
        
    if "helmet" in name_lower or "head" in name_lower or "visor" in name_lower or "face" in name_lower:
        cov["Head"]["stoppingPower"] = -1
        has_cov = True
    if "torso" in name_lower or "jacket" in name_lower or "vest" in name_lower or "coat" in name_lower or "suit" in name_lower or "armor" in name_lower:
        cov["Torso"]["stoppingPower"] = -1
        if "jacket" in name_lower or "coat" in name_lower or "suit" in name_lower or "arm" in name_lower:
            cov["lArm"]["stoppingPower"] = -1
            cov["rArm"]["stoppingPower"] = -1
        has_cov = True
    if "leg" in name_lower or "pants" in name_lower or "stocking" in name_lower or "suit" in name_lower:
        cov["lLeg"]["stoppingPower"] = -1
        cov["rLeg"]["stoppingPower"] = -1
        has_cov = True
        
    if not has_cov:
        # Default to Torso only
        cov["Torso"]["stoppingPower"] = -1
        
    return cov

def process_gear(items, out_dir, category_name):
    target_dir = out_dir / category_name
    target_dir.mkdir(parents=True, exist_ok=True)
    
    armor_dir = out_dir / "armor"
    armor_dir.mkdir(parents=True, exist_ok=True)
    
    for item in items:
        name = item.get("name", "Unknown Gear")
        
        is_arm, sp_val = is_armor(name)
        if is_arm:
            _id = generate_id(f"armor:{name}")
            vtt = get_base_item(name, "armor", item.get("source", "CP20"), _id)
            cov = guess_coverage(name)
            for k, v in cov.items():
                if v["stoppingPower"] == -1:
                    v["stoppingPower"] = sp_val
            vtt["data"]["coverage"] = cov
            file_path = armor_dir / f"{clean_filename(name)}_{_id}.json"
        else:
            _id = generate_id(f"{category_name}:{name}")
            vtt = get_base_item(name, "misc", item.get("source", "CP20"), _id)
            file_path = target_dir / f"{clean_filename(name)}_{_id}.json"
        
        try:
            vtt["data"]["cost"] = float(re.sub(r'[^0-9\.]', '', str(item.get("cost", "0"))) or 0)
        except: pass
        
        desc = item.get("full_description") or item.get("description")
        if desc: vtt["data"]["notes"] = f"<p>{desc}</p>"
        if item.get("category"):
            vtt["data"]["notes"] = f"<b>Category:</b> {item.get('category')}<br>" + str(vtt["data"]["notes"])
        
        save_item(vtt, file_path, target_dir.name)

def process_armor_list(items, out_dir):
    target_dir = out_dir / "armor"
    target_dir.mkdir(parents=True, exist_ok=True)
    
    for item in items:
        name = item.get("name", "Unknown Armor")
        _id = generate_id(f"armor:{name}")
        vtt = get_base_item(name, "armor", "CP20", _id)
        
        sp_str = str(item.get("sp", "0"))
        m = re.search(r'\d+', sp_str)
        sp_val = int(m.group(0)) if m else 0
        
        cov = guess_coverage(name + " " + str(item.get("covers", "")))
        for k, v in cov.items():
            if v["stoppingPower"] == -1:
                v["stoppingPower"] = sp_val
        vtt["data"]["coverage"] = cov
        
        notes = item.get("cost_source_notes", "")
        if notes:
            vtt["data"]["notes"] = f"<p>{notes}</p>"
            m_cost = re.search(r'^([\d,]+)', notes)
            if m_cost:
                try:
                    vtt["data"]["cost"] = float(m_cost.group(1).replace(',', ''))
                except: pass
                
        file_path = target_dir / f"{clean_filename(name)}_{_id}.json"
        save_item(vtt, file_path, target_dir.name)

def main():
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
