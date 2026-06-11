import json
import hashlib
import string
import shutil
import re
from pathlib import Path

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
        
        vtt["data"]["weaponType"] = wtype
        vtt["data"]["accuracy"] = stats.get("wa", "0")
        vtt["data"]["concealability"] = stats.get("conceal", "")
        vtt["data"]["availability"] = stats.get("availability", "")
        vtt["data"]["ammoType"] = stats.get("ammo", "")
        vtt["data"]["damage"] = stats.get("damage", "")
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
        with open(file_path, "w") as f:
            json.dump(vtt, f, indent=2)

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
        with open(file_path, "w") as f:
            json.dump(vtt, f, indent=2)

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
        with open(file_path, "w") as f:
            json.dump(vtt, f, indent=2)

def process_gear(items, out_dir, category_name):
    target_dir = out_dir / category_name
    target_dir.mkdir(parents=True, exist_ok=True)
    for item in items:
        name = item.get("name", "Unknown Gear")
        _id = generate_id(f"{category_name}:{name}")
        vtt = get_base_item(name, "gear", item.get("source", "CP20"), _id)
        
        try:
            vtt["data"]["cost"] = float(re.sub(r'[^0-9\.]', '', str(item.get("cost", "0"))) or 0)
        except: pass
        
        desc = item.get("full_description") or item.get("description")
        if desc: vtt["data"]["notes"] = f"<p>{desc}</p>"
        if item.get("category"):
            vtt["data"]["notes"] = f"<b>Category:</b> {item.get('category')}<br>" + str(vtt["data"]["notes"])
        
        file_path = target_dir / f"{clean_filename(name)}_{_id}.json"
        with open(file_path, "w") as f:
            json.dump(vtt, f, indent=2)

def main():
    in_dir = Path(".research/parsed")
    out_dir = Path("packs-src")
    
    # We will only overwrite directories we are actively processing
    # Clean up old weapon directories that we are replacing
    for d in ["pistols", "smgs", "rifles", "shotguns", "heavyWeapons", "melee", "bows", "exotics", "cyberware", "vehicles", "gear", "netware", "ammo"]:
        path = out_dir / d
        if path.exists():
            shutil.rmtree(path)
            
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
        
    print("Conversion complete. Generated packs-src JSON files.")

if __name__ == "__main__":
    main()
