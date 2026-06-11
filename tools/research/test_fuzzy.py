import json
import re
from pathlib import Path
from thefuzz import process, fuzz

def build_description_map():
    desc_map = {}
    for f in Path(".research/extracted").glob("*.md"):
        with open(f, 'r') as fp:
            text = fp.read()
            
        paragraphs = text.split('\n\n')
        for p in paragraphs:
            p = p.strip()
            if not p: continue
            
            match = re.match(r'^(?:\*\*)?(.+?)(?:\*\*)?[:\.\-]\s+(.+)', p, re.IGNORECASE | re.DOTALL)
            if match:
                name = match.group(1).strip()
                # Clean up PDF newlines
                desc = match.group(2).strip()
                desc = re.sub(r'(?<!\n)\n(?!\n)', ' ', desc)
                desc = re.sub(r'\s+', ' ', desc)
                
                if len(name) > 2 and len(desc) > 10:
                    # Prefer longer descriptions if there's a collision
                    if name not in desc_map or len(desc) > len(desc_map[name]):
                        desc_map[name] = desc
    return desc_map

def test_fuzzy_match():
    print("Building description map...")
    desc_map = build_description_map()
    desc_keys = list(desc_map.keys())
    print(f"Extracted {len(desc_keys)} descriptive paragraphs.")
    
    with open(".research/parsed/reference-cyberware.json", "r") as f:
        items = json.load(f)
    
    print(f"\nTesting fuzzy matching on {len(items)} cyberware items...")
    
    matches_found = 0
    high_confidence = 0
    
    # We will print the first 10 high-confidence matches as examples
    examples = []
    
    for item in items:
        target_name = item.get("name", "").strip()
        if not target_name: continue
        
        # Use token_set_ratio which is great for partial overlaps like "Gemini (Humanoid)" vs "Gemini"
        result = process.extractOne(target_name, desc_keys, scorer=fuzz.token_set_ratio)
        
        if result:
            best_match_name, score = result
            if score >= 85: # Good threshold for token_set_ratio
                matches_found += 1
                if score >= 95:
                    high_confidence += 1
                
                if len(examples) < 10 and score >= 90:
                    examples.append((target_name, best_match_name, score, desc_map[best_match_name][:100] + "..."))

    print(f"\n--- FUZZY MATCH RESULTS (Cyberware) ---")
    print(f"Total Items: {len(items)}")
    print(f"Total Matches (Score >= 85): {matches_found}")
    print(f"High Confidence Matches (Score >= 95): {high_confidence}")
    print(f"Success Rate: {(matches_found/len(items))*100:.1f}%\n")
    
    print("Examples of good fuzzy matches:")
    for tgt, matched, score, desc in examples:
        print(f"Item: '{tgt}'  =>  Matched Text Header: '{matched}' (Score: {score})")
        print(f"      Desc: {desc}")
        print("-" * 40)

if __name__ == '__main__':
    test_fuzzy_match()
