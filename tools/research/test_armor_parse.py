import re

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
        "rest": rest
    }

lines = [
    "Police Issue Patrol Armor Torso/Arms/Legs 20/15/18 -2 900 P&S, 39",
    "C-Ballistic Light Mesh Torso, Arms, Legs 15 -0 I1.1, 39",
    "Militech M78 RPA Hvy.Vest Torso 18 -2 300 CB3, 63"
]

for l in lines:
    print(parse_armor_line(l))
