export function registerSystemSettings() {
   /**
   * Track the system version upon which point a migration was last applied
   */
  game.settings.register(game.system.id, "systemMigrationVersion", {
    name: "SETTINGS.SysMigration",
    scope: "world",
    config: false,
    type: String,
    default: ""
  });

  game.settings.register(game.system.id, "trainedSkillsFirst", {
    name: "SETTINGS.TrainedSkillsFirst",
    hint: "SETTINGS.TrainedSkillsFirstHint",
    scope: "client",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(game.system.id, "stagedPenetration", {
    name: "SETTINGS.StagedPenetration",
    hint: "SETTINGS.StagedPenetrationHint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(game.system.id, "corebookFidelityMode", {
    name: "SETTINGS.CorebookFidelityMode",
    hint: "SETTINGS.CorebookFidelityModeHint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(game.system.id, "combatDamageCommitMode", {
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
