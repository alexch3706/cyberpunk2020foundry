import re
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
        has_cov = True
        return cov
        
    if "helmet" in name_lower or "head" in name_lower or "visor" in name_lower or "face" in name_lower:
        cov["Head"]["stoppingPower"] = -1
        has_cov = True
    if "torso" in name_lower or "jacket" in name_lower or "vest" in name_lower or "coat" in name_lower or "suit" in name_lower or "armor" in name_lower:
        cov["Torso"]["stoppingPower"] = -1
        if "jacket" in name_lower or "coat" in name_lower or "suit" in name_lower or "arms" in name_lower or "arm" in name_lower:
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

print(guess_coverage("Police Issue Patrol Armor Torso/Arms/Legs"))
