import { localize, tryLocalize } from "../utils.js";

export async function promptCoverDecision(obstruction, targetName) {
  if (typeof Dialog !== "function") {
    return { canceled: true };
  }

  return await new Promise(resolve => {
    let settled = false;
    const finish = (value) => {
      settled = true;
      resolve(value);
    };

    const obstructionName = escapeHtml(obstruction?.name || tryLocalize("Unknown", "Unknown"));
    const safeTargetName = escapeHtml(targetName || tryLocalize("Target", "Target"));
    const dialogContent = `
      <form>
        <p><strong>${localize("CoverObstructionDetected")}</strong>: ${obstructionName}</p>
        <p>${localize("CoverObstructionTarget")} ${safeTargetName}</p>

        <div class="form-group">
          <label>${localize("CoverSP")}</label>
          <input type="number" name="coverSP" value="10" min="0" step="1" autofocus />
        </div>

        <div class="form-group">
          <label>${localize("ProtectedLocations")}</label>
          <select name="protectedLocations" multiple size="4">
            <option value="Head" selected>${localize("Head")}</option>
            <option value="Torso" selected>${localize("Torso")}</option>
            <option value="lArm" selected>${localize("lArm")}</option>
            <option value="rArm" selected>${localize("rArm")}</option>
            <option value="lLeg" selected>${localize("lLeg")}</option>
            <option value="rLeg" selected>${localize("rLeg")}</option>
          </select>
          <p class="notes">${localize("ProtectedLocationsHint")}</p>
        </div>
      </form>
    `;

    new Dialog({
      title: tryLocalize("CoverDecisionTitle", "Cover Decision"),
      content: dialogContent,
      buttons: {
        apply: {
          label: tryLocalize("ApplyCover", "Apply Cover"),
          callback: html => {
            const sp = Number(html.find('[name="coverSP"]').val());
            const locations = html.find('[name="protectedLocations"]').val() || [];
            finish({
              cover: {
                applies: true,
                stoppingPower: Number.isFinite(sp) && sp >= 0 ? Math.floor(sp) : 0,
                protectedLocations: Array.isArray(locations) ? locations : [locations],
                source: "raycast-gm",
                transient: true
              }
            });
          }
        },
        ignore: {
          label: tryLocalize("IgnoreCover", "Ignore Cover"),
          callback: () => finish({
            cover: { applies: false }
          })
        }
      },
      default: "apply",
      close: () => {
        if (!settled) {
          finish({ canceled: true });
        }
      }
    }).render(true);
  });
}

function escapeHtml(value) {
  if(globalThis.foundry?.utils?.escapeHTML) {
    return globalThis.foundry.utils.escapeHTML(String(value));
  }
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
