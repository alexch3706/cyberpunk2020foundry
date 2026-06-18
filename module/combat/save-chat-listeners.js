export function registerSaveChatListeners() {
  Hooks.on("renderChatMessage", (message, html, data) => {
    // Only process our custom combat outcome messages
    const flags = message.getFlag(game.system.id, "combatOutcome");
    if (!flags || !flags.targets) return;

    html.find(".save-action-autoroll").on("click", async (event) => {
      event.preventDefault();
      const targetUuid = event.currentTarget.dataset.targetUuid;
      const targetData = flags.targets.find(t => t.target.actorUuid === targetUuid);
      if (!targetData) return;
      
      const actor = await fromUuid(targetUuid);
      if (!actor) {
        ui.notifications.warn(`Could not find actor ${targetUuid}`);
        return;
      }

      await autoRollSaves(actor, targetData.saves);
    });

    html.find(".save-action-manual").on("click", async (event) => {
      event.preventDefault();
      ui.notifications.info("Manual resolution for saves clicked. Update the character sheet manually.");
    });
  });
}

async function autoRollSaves(actor, saves) {
  if (!saves || saves.length === 0) return;

  let hasFailedStun = false;

  for (const save of saves) {
    if (save.type === "stun" && hasFailedStun) {
      continue; // Skip further Stun Saves if target is already Stunned
    }
    const roll = await new Roll("1d10").evaluate({ async: true });
    const isSuccess = roll.total <= save.targetNumber;

    let title = `${save.type === 'stun' ? 'Stun/Shock' : 'Death'} Save`;
    if (save.type === 'death') {
      title += ` (Mortal ${save.mortalLevel})`;
    } else {
      title += ` (${save.woundState.label})`;
    }

    const flavor = `<b>${actor.name}</b> attempts a ${title}...<br/>
      Target Number: ${save.targetNumber} (BT ${save.bodyType} - ${save.penalty} penalty)<br/>
      Result: ${roll.total} - <b>${isSuccess ? "SUCCESS" : "FAILURE"}</b>`;

    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor }),
      flavor: flavor
    });

    if (!isSuccess) {
      if (save.type === "stun") {
        hasFailedStun = true;
        ChatMessage.create({
          speaker: ChatMessage.getSpeaker({ actor }),
          content: `<b>${actor.name}</b> has failed a Stun/Shock Save and is now <b>Stunned</b>!`
        });
      } else if (save.type === "death") {
        ChatMessage.create({
          speaker: ChatMessage.getSpeaker({ actor }),
          content: `<b>${actor.name}</b> has failed a Death Save and is now <b>DEAD</b>!`
        });
        break; // Stop rolling if they died
      }

    }
  }
}
