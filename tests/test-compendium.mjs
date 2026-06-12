import fs from 'fs';
import path from 'path';

// Load expected weapon types from lookups.js
// Since it's an ES module meant for the browser, we'll just hardcode the keys we expect based on our research.
// We can't trivially import lookups.js in Node because of the export/import syntax and browser globals (like `game`).
const VALID_WEAPON_TYPES = ["Pistol", "SMG", "Shotgun", "Rifle", "Heavy", "Melee", "Exotic"];

const PACKS_SRC_DIR = path.resolve(process.cwd(), 'packs-src');

const WEAPON_FOLDERS = [
    'pistols',
    'smgs',
    'rifles',
    'shotguns',
    'heavyWeapons',
    'melee',
    'weapons_other',
    'bows',
    'exotics'
];

let errors = 0;
let checked = 0;

for (const folder of WEAPON_FOLDERS) {
    const folderPath = path.join(PACKS_SRC_DIR, folder);
    if (!fs.existsSync(folderPath)) continue;

    const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.json'));
    for (const file of files) {
        checked++;
        const filePath = path.join(folderPath, file);
        try {
            const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            if (data.type === "weapon") {
                const wType = data.data?.weaponType;
                if (!VALID_WEAPON_TYPES.includes(wType)) {
                    console.error(`[ERROR] File ${file}: Invalid weaponType '${wType}'. Must be one of: ${VALID_WEAPON_TYPES.join(', ')}`);
                    errors++;
                }
            }
        } catch (e) {
            console.error(`[ERROR] Failed to read or parse ${file}: ${e.message}`);
            errors++;
        }
    }
}

console.log(`\nCompendium Fixture Test Results:`);
console.log(`- Evaluated ${checked} weapon JSONs.`);
if (errors > 0) {
    console.error(`- FAILED: Found ${errors} validation errors!`);
    process.exit(1);
} else {
    console.log(`- SUCCESS: All weapon types are strictly valid.`);
    process.exit(0);
}
