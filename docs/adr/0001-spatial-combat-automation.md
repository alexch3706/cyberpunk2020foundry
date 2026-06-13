# Spatial Combat Automation Limits

We decided to implement Tactical Environment Automation using a hybrid approach of VTT raycasting/templates and GM-prompted dialogs, rather than building a fully automated 3D physics simulation.

## Considered Options

- **Full Simulation (XCOM style):** Enhancing Foundry walls with SP/SDP, tracking 3D token heights, calculating volumetric cover, and simulating bullet blowthrough across multiple living tokens. Rejected due to extreme performance overhead, poor map-prep UX (GMs must configure height/SP for every map prop), and loss of GM agency for edge cases.
- **Hybrid GM-Assisted Automation (Selected):** Using simple line-of-effect raycasts and `MeasuredTemplate` zones to detect *intersections*, but relying on prompt dialogs for the GM to supply semantic data (e.g., Cover SP, hit locations blocked) and narrative edge cases (blowthrough).

## Consequences

- **Target Normalization:** `target-normalizer.js` must intercept Foundry templates (for shotguns/suppressive fire) and raycasts (for classic weapons) to assemble the `CombatActionContext`.
- **Cover SP:** Map walls do not hold SP. When a raycast hits an obstruction, the combat pipeline pauses and prompts the GM for Cover SP and protected hit locations (Partial Cover Resolution).
- **Transient Cover:** During multi-hit sequences (Full Auto), the system will ablate cover internally based on the GM's initial input without permanently destroying the map object.
- **Shotguns:** Dynamic Damage Drop-off will be fully automated; the system will measure distance to each target in the template and adjust damage dice automatically according to FNFF spread rules.
- **Overpenetration:** The engine stops raycasting at the first valid target. Blowthrough effects must be handled narratively by the GM.
