/**
 * Helpers for shared physical table play where the attack d10 is rolled
 * outside Foundry, but the resolver still applies normal attack math.
 */

export function buildAttackDieEntryRoller(baseRoller, manualAttackDie) {
  if (manualAttackDie === undefined || manualAttackDie === null || manualAttackDie === "") {
    return baseRoller;
  }
  const parsed = parseManualAttackDie(manualAttackDie);

  return async function attackDieEntryRoller(request = {}) {
    if (request.id !== "attack") {
      return await baseRoller(request);
    }

    return {
      id: request.id,
      formula: request.formula,
      terms: request.terms,
      total: parsed.total + sumNumericRollData(request.rollData),
      die: {
        faces: 10,
        natural: parsed.results[0],
        results: [...parsed.results],
        exploded: parsed.results.length > 1,
        source: "manual"
      },
      isCritical: parsed.results[0] === 10,
      isFumble: parsed.results[0] === 1,
      source: "manualAttackDie"
    };
  };
}

export function parseManualAttackDie(value) {
  const parts = String(value)
    .split(",")
    .map(part => part.trim())
    .filter(part => part.length > 0);

  if (parts.length < 1 || parts.length > 2) {
    throw new Error("Manual attack die must be a d10 value or one explosion pair like 10,7.");
  }

  const results = parts.map(part => Number(part));
  if (results.some(result => !Number.isInteger(result) || result < 1 || result > 10)) {
    throw new Error("Manual attack die values must be integers from 1 to 10.");
  }
  if (results[0] === 10 && results.length !== 2) {
    throw new Error("Manual attack die explosion requires exactly one follow-up value, for example 10,7.");
  }
  if (results.length === 2 && results[0] !== 10) {
    throw new Error("Manual attack die explosion is only valid after an initial 10.");
  }

  return {
    results,
    total: results.reduce((sum, result) => sum + result, 0)
  };
}

export async function promptAttackDieEntry() {
  if (typeof Dialog !== "function") {
    return {};
  }

  return await new Promise(resolve => {
    let settled = false;
    const finish = (value) => {
      settled = true;
      resolve(value);
    };

    new Dialog({
      title: localizeSetting("CYBERPUNK.AttackDieEntryTitle", "Attack Die Entry"),
      content: `
        <form>
          <div class="form-group">
            <label>${localizeSetting("CYBERPUNK.AttackDieEntryManualLabel", "Manual d10")}</label>
            <input type="text" name="manualAttackDie" placeholder="7 or 10,6" autofocus />
          </div>
          <p class="notes">${localizeSetting("CYBERPUNK.AttackDieEntryManualHint", "Use 1-9, or 10 plus one follow-up value like 10,7.")}</p>
        </form>
      `,
      buttons: {
        auto: {
          label: localizeSetting("CYBERPUNK.AttackDieEntryAuto", "Auto"),
          callback: () => finish({})
        },
        manual: {
          label: localizeSetting("CYBERPUNK.AttackDieEntryManual", "Manual"),
          callback: html => {
            const value = html.find('[name="manualAttackDie"]').val();
            try {
              parseManualAttackDie(value);
            } catch (error) {
              if (typeof globalThis.ui?.notifications?.error === "function") {
                globalThis.ui.notifications.error(error.message);
              }
              return false;
            }
            finish({ manualAttackDie: value });
          }
        }
      },
      default: "auto",
      close: () => {
        if (!settled) {
          finish({ canceled: true });
        }
      }
    }).render(true);
  });
}

function localizeSetting(key, fallback) {
  try {
    if (typeof game?.i18n?.localize === "function") {
      const localized = game.i18n.localize(key);
      return localized === key ? fallback : localized;
    }
  } catch {
    // fall through
  }
  return fallback;
}

function sumNumericRollData(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (!value || typeof value !== "object") {
    return 0;
  }
  let total = 0;
  for (const child of Object.values(value)) {
    total += sumNumericRollData(child);
  }
  return total;
}
