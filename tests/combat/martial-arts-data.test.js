/**
 * Tests for module/combat/martial-arts-data.js
 *
 * Run standalone:  node tests/combat/martial-arts-data.test.js
 * Run via suite:   node tests/run-combat-fixtures.mjs
 *
 * Covers all 12 corebook styles, key technique bonuses, prerequisites,
 * case-insensitivity, deep-freezing, and defensive boundaries.
 */

import assert from "node:assert/strict";

import {
  MARTIAL_STYLES,
  MARTIAL_ACTIONS,
  getKeyTechniqueBonus,
  isTrainedMartial,
  getRequiresPrerequisite,
  getMartialStyleNames
} from "../../module/combat/martial-arts-data.js";

export function runMartialArtsDataTests() {
  // ──────────────────────────────────────────────
  // Acceptance Criterion 2: All 12 styles present
  // ──────────────────────────────────────────────

  const EXPECTED_STYLE_KEYS = [
    "brawling",
    "aikido",
    "animalkungfu",
    "boxing",
    "capoeira",
    "choilifut",
    "judo",
    "karate",
    "savate",
    "taekwondo",
    "thaikickboxing",
    "wrestling"
  ];

  assert.equal(
    getMartialStyleNames().length,
    EXPECTED_STYLE_KEYS.length,
    "MARTIAL_STYLES should have exactly 12 entries"
  );

  for (const key of EXPECTED_STYLE_KEYS) {
    assert.ok(MARTIAL_STYLES[key], `style "${key}" should exist in MARTIAL_STYLES`);
    assert.ok(MARTIAL_STYLES[key].name, `style "${key}" should have a name`);
    assert.ok(MARTIAL_STYLES[key].displayKey, `style "${key}" should have a displayKey`);
    assert.ok(MARTIAL_STYLES[key].keyTechniques, `style "${key}" should have keyTechniques`);
    assert.ok(
      typeof MARTIAL_STYLES[key].requiresPrerequisite === "object",
      `style "${key}" should have requiresPrerequisite map`
    );
  }

  // ──────────────────────────────────────────────
  // Acceptance Criterion 1: getKeyTechniqueBonus
  // ──────────────────────────────────────────────

  assert.equal(getKeyTechniqueBonus("karate", "strike"), 2, "Karate strike = +2");
  assert.equal(getKeyTechniqueBonus("karate", "kick"), 1, "Karate kick = +1");
  assert.equal(getKeyTechniqueBonus("karate", "blockParry"), 1, "Karate block/parry = +1");
  assert.equal(getKeyTechniqueBonus("karate", "dodge"), 0, "Karate dodge = +0");

  assert.equal(getKeyTechniqueBonus("boxing", "strike"), 2, "Boxing strike = +2");
  assert.equal(getKeyTechniqueBonus("boxing", "blockParry"), 1, "Boxing block/parry = +1");
  assert.equal(getKeyTechniqueBonus("boxing", "dodge"), 0, "Boxing dodge = +0");

  assert.equal(getKeyTechniqueBonus("judo", "strike"), 0, "Judo strike = +0");
  assert.equal(getKeyTechniqueBonus("judo", "disarm"), 1, "Judo disarm = +1");
  assert.equal(getKeyTechniqueBonus("judo", "hold"), 1, "Judo hold = +1");
  assert.equal(getKeyTechniqueBonus("judo", "throw"), 2, "Judo throw = +2");
  assert.equal(getKeyTechniqueBonus("judo", "escape"), 1, "Judo escape = +1");

  assert.equal(getKeyTechniqueBonus("aikido", "strike"), 1, "Aikido strike = +1");
  assert.equal(getKeyTechniqueBonus("aikido", "blockParry"), 0, "Aikido block/parry = +0");
  assert.equal(getKeyTechniqueBonus("aikido", "disarm"), 1, "Aikido disarm = +1");
  assert.equal(getKeyTechniqueBonus("aikido", "hold"), 1, "Aikido hold = +1");
  assert.equal(getKeyTechniqueBonus("aikido", "throw"), 1, "Aikido throw = +1");

  assert.equal(getKeyTechniqueBonus("capoeira", "strike"), 0, "Capoeira strike = +0");
  assert.equal(getKeyTechniqueBonus("capoeira", "kick"), 2, "Capoeira kick = +2");
  assert.equal(getKeyTechniqueBonus("capoeira", "dodge"), 1, "Capoeira dodge = +1");
  assert.equal(getKeyTechniqueBonus("capoeira", "sweepTrip"), 1, "Capoeira sweep/trip = +1");

  assert.equal(getKeyTechniqueBonus("wrestling", "strike"), 0, "Wrestling strike = +0");
  assert.equal(getKeyTechniqueBonus("wrestling", "grapple"), 2, "Wrestling grapple = +2");
  assert.equal(getKeyTechniqueBonus("wrestling", "hold"), 1, "Wrestling hold = +1");
  assert.equal(getKeyTechniqueBonus("wrestling", "escape"), 1, "Wrestling escape = +1");

  assert.equal(getKeyTechniqueBonus("savate", "strike"), 1, "Savate strike = +1");
  assert.equal(getKeyTechniqueBonus("savate", "kick"), 2, "Savate kick = +2");
  assert.equal(getKeyTechniqueBonus("savate", "blockParry"), 0, "Savate block/parry = +0");
  assert.equal(getKeyTechniqueBonus("savate", "dodge"), 1, "Savate dodge = +1");

  assert.equal(getKeyTechniqueBonus("thaikickboxing", "strike"), 1, "Thai Kickboxing strike = +1");
  assert.equal(getKeyTechniqueBonus("thaikickboxing", "kick"), 2, "Thai Kickboxing kick = +2");
  assert.equal(getKeyTechniqueBonus("thaikickboxing", "blockParry"), 0, "Thai Kickboxing block/parry = +0");
  assert.equal(getKeyTechniqueBonus("thaikickboxing", "grapple"), 1, "Thai Kickboxing grapple = +1");

  assert.equal(getKeyTechniqueBonus("taekwondo", "strike"), 2, "Tae Kwon Do strike = +2");
  assert.equal(getKeyTechniqueBonus("taekwondo", "kick"), 2, "Tae Kwon Do kick = +2");
  assert.equal(getKeyTechniqueBonus("taekwondo", "blockParry"), 0, "Tae Kwon Do block/parry = +0");

  assert.equal(getKeyTechniqueBonus("choilifut", "strike"), 2, "Choi Li Fut strike = +2");
  assert.equal(getKeyTechniqueBonus("choilifut", "kick"), 0, "Choi Li Fut kick = +0");
  assert.equal(getKeyTechniqueBonus("choilifut", "blockParry"), 1, "Choi Li Fut block/parry = +1");
  assert.equal(getKeyTechniqueBonus("choilifut", "grapple"), 1, "Choi Li Fut grapple = +1");

  assert.equal(getKeyTechniqueBonus("animalkungfu", "strike"), 1, "Animal Kung Fu strike = +1");
  assert.equal(getKeyTechniqueBonus("animalkungfu", "kick"), 1, "Animal Kung Fu kick = +1");
  assert.equal(getKeyTechniqueBonus("animalkungfu", "blockParry"), 0, "Animal Kung Fu block/parry = +0");
  assert.equal(getKeyTechniqueBonus("animalkungfu", "dodge"), 1, "Animal Kung Fu dodge = +1");
  assert.equal(getKeyTechniqueBonus("animalkungfu", "grapple"), 1, "Animal Kung Fu grapple = +1");

  // ──────────────────────────────────────────────
  // Acceptance Criterion 3: Brawling all zero, not trained
  // ──────────────────────────────────────────────

  for (const action of MARTIAL_ACTIONS) {
    assert.equal(
      getKeyTechniqueBonus("brawling", action),
      0,
      `Brawling ${action} should return 0`
    );
  }

  assert.equal(isTrainedMartial("brawling"), false, "Brawling is not a trained martial art");

  // ──────────────────────────────────────────────
  // Acceptance Criterion 4: isTrainedMartial for non-Brawling
  // ──────────────────────────────────────────────

  for (const key of EXPECTED_STYLE_KEYS) {
    if (key === "brawling") continue;
    assert.equal(isTrainedMartial(key), true, `${key} should be recognized as a trained martial art`);
  }

  assert.equal(isTrainedMartial("nonexistent"), false, "Nonexistent style should return false");
  assert.equal(isTrainedMartial(""), false, "Empty string should return false");

  // Prototype properties safety checks
  assert.equal(isTrainedMartial("toString"), false, "toString property on Object.prototype should return false");
  assert.equal(isTrainedMartial("hasOwnProperty"), false, "hasOwnProperty property should return false");

  // ──────────────────────────────────────────────
  // Acceptance Criterion 1b: Case-insensitivity
  // ──────────────────────────────────────────────

  assert.equal(
    getKeyTechniqueBonus("  KaRaTe  ", "  sTrIkE  "),
    2,
    "getKeyTechniqueBonus should be case-insensitive and trim whitespace"
  );

  assert.equal(
    getKeyTechniqueBonus("  BrAwLiNg  ", "  StRiKe  "),
    0,
    "getKeyTechniqueBonus Brawling with mixed case should still return 0"
  );

  assert.equal(
    isTrainedMartial("  JuDo  "),
    true,
    "isTrainedMartial should normalize case and trim whitespace"
  );

  assert.deepEqual(
    getRequiresPrerequisite("  AiKiDo  ", "  ThRoW  "),
    ["grapple", "blockParry", "dodge"],
    "getRequiresPrerequisite should normalize case and trim whitespace"
  );

  // ──────────────────────────────────────────────
  // Acceptance Criterion 1c: Invalid/nonexistent returns 0
  // ──────────────────────────────────────────────

  assert.equal(
    getKeyTechniqueBonus("nonexistent", "strike"),
    0,
    "Unknown style should return 0"
  );

  assert.equal(
    getKeyTechniqueBonus("karate", "nonexistent"),
    0,
    "Unknown action should return 0"
  );

  assert.equal(
    getKeyTechniqueBonus("", "strike"),
    0,
    "Empty style should return 0"
  );

  assert.equal(
    getKeyTechniqueBonus("karate", ""),
    0,
    "Empty action should return 0"
  );

  // ──────────────────────────────────────────────
  // Acceptance Criterion 3b: Non-key techniques return 0
  // ──────────────────────────────────────────────

  // Actions marked — (not a key technique) should return 0, not undefined
  const nonKeyAikidoActions = ["kick", "dodge", "sweepTrip", "grapple", "choke", "escape"];
  for (const action of nonKeyAikidoActions) {
    assert.equal(
      getKeyTechniqueBonus("aikido", action),
      0,
      `Aikido ${action} (not a key technique) should return 0`
    );
  }

  const nonKeyBoxingActions = ["kick", "disarm", "sweepTrip", "grapple", "hold", "choke", "throw", "escape"];
  for (const action of nonKeyBoxingActions) {
    assert.equal(
      getKeyTechniqueBonus("boxing", action),
      0,
      `Boxing ${action} (not a key technique) should return 0`
    );
  }

  // ──────────────────────────────────────────────
  // Acceptance Criterion 5: Prerequisites
  // ──────────────────────────────────────────────

  // Generic: Choke requires Hold for all styles
  assert.deepEqual(
    getRequiresPrerequisite("brawling", "choke"),
    ["hold"],
    "Brawling choke should require hold (generic rule)"
  );

  assert.deepEqual(
    getRequiresPrerequisite("karate", "choke"),
    ["hold"],
    "Karate choke should require hold (generic rule)"
  );

  assert.deepEqual(
    getRequiresPrerequisite("judo", "choke"),
    ["hold"],
    "Judo choke should require hold (generic rule)"
  );

  // Generic: Escape requires Grapple or Hold for all styles
  assert.deepEqual(
    getRequiresPrerequisite("brawling", "escape"),
    ["grapple", "hold"],
    "Brawling escape should require grapple or hold (generic rule)"
  );

  assert.deepEqual(
    getRequiresPrerequisite("karate", "escape"),
    ["grapple", "hold"],
    "Karate escape should require grapple or hold (generic rule)"
  );

  // Style-specific: Aikido prerequisites
  assert.deepEqual(
    getRequiresPrerequisite("aikido", "throw"),
    ["grapple", "blockParry", "dodge"],
    "Aikido throw should require grapple or block/parry or dodge"
  );

  assert.deepEqual(
    getRequiresPrerequisite("aikido", "disarm"),
    ["blockParry", "dodge"],
    "Aikido disarm should require block/parry or dodge"
  );

  assert.deepEqual(
    getRequiresPrerequisite("aikido", "hold"),
    ["grapple", "blockParry", "dodge"],
    "Aikido hold should require grapple or block/parry or dodge"
  );

  // Style-specific: Judo prerequisites
  assert.deepEqual(
    getRequiresPrerequisite("judo", "throw"),
    ["grapple"],
    "Judo throw should require grapple"
  );

  assert.deepEqual(
    getRequiresPrerequisite("judo", "hold"),
    ["grapple"],
    "Judo hold should require grapple"
  );

  // Style-specific: Wrestling prerequisites
  assert.deepEqual(
    getRequiresPrerequisite("wrestling", "hold"),
    ["grapple"],
    "Wrestling hold should require grapple"
  );

  // No prerequisite for most actions
  assert.equal(
    getRequiresPrerequisite("karate", "strike"),
    null,
    "Karate strike should have no prerequisites"
  );

  assert.equal(
    getRequiresPrerequisite("brawling", "strike"),
    null,
    "Brawling strike should have no prerequisites"
  );

  // Invalid style/action returns null
  assert.equal(
    getRequiresPrerequisite("nonexistent", "strike"),
    null,
    "Unknown style should return null for prerequisites"
  );

  assert.equal(
    getRequiresPrerequisite("karate", "nonexistent"),
    null,
    "Unknown action should return null for prerequisites"
  );

  // ──────────────────────────────────────────────
  // Acceptance Criterion 6: Deep freeze
  // ──────────────────────────────────────────────

  assert.equal(Object.isFrozen(MARTIAL_STYLES), true, "MARTIAL_STYLES should be frozen");

  for (const key of EXPECTED_STYLE_KEYS) {
    const style = MARTIAL_STYLES[key];
    assert.equal(Object.isFrozen(style), true, `${key} style definition should be frozen`);
    assert.equal(Object.isFrozen(style.keyTechniques), true, `${key} keyTechniques should be frozen`);
    assert.equal(
      Object.isFrozen(style.requiresPrerequisite),
      true,
      `${key} requiresPrerequisite should be frozen`
    );
  }

  // ──────────────────────────────────────────────
  // Acceptance Criterion 7: MARTIAL_ACTIONS export
  // ──────────────────────────────────────────────

  const EXPECTED_ACTIONS = [
    "dodge",
    "blockParry",
    "strike",
    "kick",
    "disarm",
    "sweepTrip",
    "grapple",
    "hold",
    "choke",
    "throw",
    "escape"
  ];

  assert.deepEqual(
    MARTIAL_ACTIONS,
    EXPECTED_ACTIONS,
    "MARTIAL_ACTIONS should contain exactly the 11 supported action keys"
  );

  // ──────────────────────────────────────────────
  // Acceptance Criterion 7: Export list
  // ──────────────────────────────────────────────

  assert.equal(typeof getMartialStyleNames, "function", "getMartialStyleNames should be exported");
  assert.deepEqual(getMartialStyleNames(), EXPECTED_STYLE_KEYS, "getMartialStyleNames should return all style keys");

  // ──────────────────────────────────────────────
  // Display key alignment
  // ──────────────────────────────────────────────

  assert.equal(MARTIAL_STYLES.brawling.displayKey, "CYBERPUNK.SkillBrawling", "Brawling displayKey");
  assert.equal(MARTIAL_STYLES.karate.displayKey, "CYBERPUNK.SkillMartial Arts: Karate", "Karate displayKey");
  assert.equal(
    MARTIAL_STYLES.animalkungfu.displayKey,
    "CYBERPUNK.SkillMartial Arts: AnimalKungFu",
    "Animal Kung Fu displayKey"
  );

  // ──────────────────────────────────────────────
  // Name fields
  // ──────────────────────────────────────────────

  assert.equal(MARTIAL_STYLES.brawling.name, "Brawling");
  assert.equal(MARTIAL_STYLES.aikido.name, "Aikido");
  assert.equal(MARTIAL_STYLES.animalkungfu.name, "Animal Kung Fu");
  assert.equal(MARTIAL_STYLES.thaikickboxing.name, "Thai Kickboxing");
  assert.equal(MARTIAL_STYLES.taekwondo.name, "Tae Kwon Do");
  assert.equal(MARTIAL_STYLES.choilifut.name, "Choi Li Fut");

  console.log("ok martial-arts-data — all assertions passed");

  return { name: "martial-arts-data" };
}

// Support running this test file standalone
if (import.meta.url.endsWith(process.argv[1])) {
  runMartialArtsDataTests();
}