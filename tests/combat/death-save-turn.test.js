import assert from "node:assert/strict";

import {
  buildTurnStartDeathSaveReminder,
  handleCombatTurnDeathSaveReminder
} from "../../module/combat/death-save-turn.js";

export async function runDeathSaveTurnTests() {
  const results = [];

  async function test(name, fn) {
    try {
      await fn();
      results.push({ name: `death-save-turn: ${name}`, passed: true });
    } catch (err) {
      console.error(`FAIL: death-save-turn: ${name}`);
      console.error(err);
      results.push({ name: `death-save-turn: ${name}`, passed: false, error: err });
    }
  }

  await test("does not emit without active started combat", async () => {
    const adapter = createFakeTurnAdapter({ combat: undefined });
    const result = await handleCombatTurnDeathSaveReminder(undefined, {}, {}, { adapter });
    assert.equal(result.status, "skipped");
    assert.equal(adapter.messages.length, 0);
  });

  await test("does not emit before initiative starts", async () => {
    const adapter = createFakeTurnAdapter({ combat: { started: false, combatant: activeCombatant() } });
    const result = await handleCombatTurnDeathSaveReminder(adapter.combat, {}, {}, { adapter });
    assert.equal(result.status, "skipped");
    assert.equal(adapter.messages.length, 0);
  });

  await test("does not emit on non-GM clients", async () => {
    const adapter = createFakeTurnAdapter({ isGM: false });
    const result = await handleCombatTurnDeathSaveReminder(adapter.combat, {}, {}, { adapter });
    assert.equal(result.status, "skipped");
    assert.equal(adapter.messages.length, 0);
  });

  await test("emits exactly one reminder for a Mortal active combatant", async () => {
    const adapter = createFakeTurnAdapter();
    const first = await handleCombatTurnDeathSaveReminder(adapter.combat, { turn: 0, round: 1 }, {}, { adapter });
    const duplicate = await handleCombatTurnDeathSaveReminder(adapter.combat, { turn: 0, round: 1 }, {}, { adapter });
    assert.equal(first.status, "created");
    assert.equal(duplicate.status, "duplicate");
    assert.equal(adapter.messages.length, 1);
    assert.match(adapter.messages[0].content, /Mortal 0/);
    assert.match(adapter.messages[0].content, /Body Type 6/);
    assert.match(adapter.messages[0].content, /Penalty 0/);
  });

  await test("does not emit for dead or stabilized actors", async () => {
    const deadAdapter = createFakeTurnAdapter({
      combat: { started: true, round: 1, turn: 0, combatant: activeCombatant({ system: { damage: 41, stats: { bt: { total: 6 } } } }) }
    });
    const stabilizedAdapter = createFakeTurnAdapter({
      combat: { started: true, round: 1, turn: 0, combatant: activeCombatant({ system: { damage: 13, deathSave: { stabilized: true }, stats: { bt: { total: 6 } } } }) }
    });

    assert.equal((await handleCombatTurnDeathSaveReminder(deadAdapter.combat, {}, {}, { adapter: deadAdapter })).status, "skipped");
    assert.equal((await handleCombatTurnDeathSaveReminder(stabilizedAdapter.combat, {}, {}, { adapter: stabilizedAdapter })).status, "skipped");
    assert.equal(deadAdapter.messages.length, 0);
    assert.equal(stabilizedAdapter.messages.length, 0);
  });

  await test("builds reminder data with actor, Mortal level, Body Type, and penalty", () => {
    const reminder = buildTurnStartDeathSaveReminder(activeCombatant().actor);
    assert.equal(reminder.actorName, "Target");
    assert.equal(reminder.mortalLevel, 0);
    assert.equal(reminder.bodyType, 6);
    assert.equal(reminder.penalty, 0);
    assert.equal(reminder.threshold, 6);
    assert.equal(reminder.woundState.label, "Mortal 0");
  });

  return results;
}

function createFakeTurnAdapter(options = {}) {
  const messages = [];
  const adapter = {
    messages,
    combat: options.combat || { started: true, round: 1, turn: 0, combatant: activeCombatant() },
    isAuthoritativeClient() {
      return options.isGM !== false;
    },
    async createReminderMessage(reminder) {
      messages.push({
        content: `${reminder.actorName}: ${reminder.woundState.label}, Body Type ${reminder.bodyType}, Penalty ${reminder.penalty}, Threshold ${reminder.threshold}`
      });
    }
  };
  return adapter;
}

function activeCombatant(actor = { name: "Target", system: { damage: 13, stats: { bt: { total: 6 } } } }) {
  return {
    id: "combatant-1",
    actor,
    token: {
      name: actor.name
    }
  };
}
