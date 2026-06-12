import fs from 'fs';
import path from 'path';

// Valid core item types defined in template.json
const VALID_ROOT_TYPES = ["skill", "weapon", "armor", "cyberware", "vehicle", "misc"];
const VALID_WEAPON_TYPES = ["Pistol", "SMG", "Shotgun", "Rifle", "Heavy", "Melee", "Exotic"];

const PACKS_SRC_DIR = path.resolve(process.cwd(), 'packs-src');

const ALL_FOLDERS = fs.readdirSync(PACKS_SRC_DIR).filter(f => fs.statSync(path.join(PACKS_SRC_DIR, f)).isDirectory());

let errors = 0;
let checked = 0;

for (const folder of ALL_FOLDERS) {
    const folderPath = path.join(PACKS_SRC_DIR, folder);
    const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.json'));
    
    for (const file of files) {
        checked++;
        const filePath = path.join(folderPath, file);
        try {
            const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            
            // 1. Check root item type
            if (!VALID_ROOT_TYPES.includes(data.type)) {
                console.error(`[ERROR] File ${folder}/${file}: Invalid root type '${data.type}'. Must be one of: ${VALID_ROOT_TYPES.join(', ')}`);
                errors++;
            }
            
            // 2. Additional weapon-specific validation
            if (data.type === "weapon") {
                const wType = data.data?.weaponType;
                if (!VALID_WEAPON_TYPES.includes(wType)) {
                    console.error(`[ERROR] File ${folder}/${file}: Invalid weaponType '${wType}'. Must be one of: ${VALID_WEAPON_TYPES.join(', ')}`);
                    errors++;
                }
                
                // Validate damage field for syntax errors in Roll
                const damage = data.data?.damage || "";
                if (damage && !/^[0-9dD\+\-\*\/\x\s]+$/.test(damage)) {
                    console.error(`[ERROR] File ${folder}/${file}: Invalid damage formula '${damage}'. Contains forbidden characters.`);
                    errors++;
                }
            }
        } catch (e) {
            console.error(`[ERROR] Failed to read or parse ${folder}/${file}: ${e.message}`);
            errors++;
        }
    }
}

console.log(`\nCompendium Fixture Test Results:`);
console.log(`- Evaluated ${checked} JSONs across all packs.`);
if (errors > 0) {
    console.error(`- FAILED: Found ${errors} validation errors!`);
    process.exit(1);
} else {
    console.log(`- SUCCESS: All item types and schemas are strictly valid.`);
    process.exit(0);
}
