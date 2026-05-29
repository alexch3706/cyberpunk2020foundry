export function registerSystemSettings() {
   /**
   * Track the system version upon which point a migration was last applied
   */
  game.settings.register("cyberpunk2020", "systemMigrationVersion", {
    name: "SETTINGS.SysMigration",
    scope: "world",
    config: false,
    type: String,
    default: ""
  });

  game.settings.register("cyberpunk2020", "trainedSkillsFirst", {
    name: "SETTINGS.TrainedSkillsFirst",
    hint: "SETTINGS.TrainedSkillsFirstHint",
    scope: "client",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register("cyberpunk2020", "stagedPenetration", {
    name: "SETTINGS.StagedPenetration",
    hint: "SETTINGS.StagedPenetrationHint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register("cyberpunk2020", "corebookFidelityMode", {
    name: "SETTINGS.CorebookFidelityMode",
    hint: "SETTINGS.CorebookFidelityModeHint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register("cyberpunk2020", "combatDamageCommitMode", {
    name: "SETTINGS.CombatDamageCommitMode",
    hint: "SETTINGS.CombatDamageCommitModeHint",
    scope: "world",
    config: true,
    type: String,
    choices: {
      previewConfirm: "SETTINGS.CombatDamageCommitModePreviewConfirm",
      direct: "SETTINGS.CombatDamageCommitModeDirect"
    },
    default: "previewConfirm"
  });
}
