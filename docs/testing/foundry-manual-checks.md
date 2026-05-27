# Foundry VTT Manual Testing Guide: Single-Shot Firearm Resolution

This guide outlines the step-by-step verification process for the Corebook Fidelity single-shot combat resolver path in **Foundry VTT**. Use this document to manually audit UI/UX flows, sheet updates, and chat log output.

---

## 1. Environment & Setup

Ensure the system is loaded in a clean test world, and the following components are available on the active scene:

### 1.1 Attacker Setup
1. Create a new Actor named **Solo (Attacker)**.
2. Open the actor sheet and navigate to the **Combat** tab.
3. Add a Ranged Weapon:
   - **Name**: Heavy Pistol
   - **Damage**: `4d6`
   - **Shots**: `10` / `10`
   - **RoF**: `2`
   - **Reliability**: `standard`
   - **Range**: `50`m
   - **Accuracy**: `0`
4. Set attacker stats:
   - **REF**: `8`
   - **Handgun Skill**: `6`

### 1.2 Target Setup
1. Create a new Actor named **Target (Defender)**.
2. Open the actor sheet, navigate to **Gear**, and add an Armor item:
   - **Name**: Kevlar Vest
   - **Equipped**: Yes
   - **SP (Torso)**: `12`
3. Set defender stats:
   - **BODY**: `6` (BTM: `-2`)
4. Create a token on the active scene for both the Attacker and the Target.

---

## 2. Standard Attack Flow (Confirm Path)

Verify that a standard single-shot ranged attack resolves, prompts preview confirmation, mutates stats on confirm, and updates the chat card in-place.

### 2.1 Target Selection
1. Select the **Solo (Attacker)** token.
2. Use Foundry's Target tool (or double right-click / Alt+click depending on config) to target the **Target (Defender)** token on the scene.
3. Verify that the targeting reticle is visible on the Target token.

### 2.2 Initiating the Roll
1. Open the **Solo (Attacker)** actor sheet.
2. In the **Combat** tab, find the **Heavy Pistol** and click the roll button (dice icon).
3. The Ranged Attack Modifier Dialog should appear:
   - Select **Semi-Auto** or **Single Shot** fire mode.
   - Select the target range (e.g., **Medium**).
   - Leave other modifiers default or specify aim rounds if desired.
   - Click **Roll**.

### 2.3 Preview Dialog Validation
1. An in-progress combat preview dialog should appear on screen.
2. Confirm the displayed values in the dialog:
   - **Attacker**: "Solo" using "Heavy Pistol"
   - **Target**: "Target"
   - **Attack roll**: Verify the total (1d10 + REF 8 + Handgun 6 + Accuracy) against the Target Number (Medium DC: 20).
   - **Hit/Miss status**: Confirm it correctly identifies a **Hit** if the total is >= 20, or **Miss** if < 20.
   - **Ammo change**: Displays `-1` spent (Shots: `9 / 10`).
   - **Wound Transition & Damage**: Summarizes final damage (if hit) taking into account Kevlar Vest SP (12) and BTM (-2). *Note: This calculation assumes the hit lands on the Torso (either rolled randomly or aimed); hits to unarmored body locations will not apply the Kevlar Vest's SP.*
   - **Warnings**: Ensure no unexpected warnings are displayed.

### 2.4 Committing the Outcome
1. Click **Confirm** on the preview dialog.
2. **Verify Sheet Mutations (Database changes)**:
   - Open **Solo (Attacker)** sheet: verify ammo is decremented by 1 (Shots Left: `9`).
   - Open **Target (Defender)** sheet (if a hit occurred and damage penetrated SP): verify damage is increased by final damage value, and Kevlar Vest SP on Torso is ablated by 1 (SP: `11`). *Note: In Cyberpunk 2020, armor is only ablated if the damage exceeds the stopping power (damage > SP). If damage <= SP, no damage is taken and armor SP is not ablated.*
3. **Verify Chat Card**:
   - Locate the generated chat card in the Foundry chat log.
   - Confirm the banner status displays **[COMMITTED] - Applied to Actor(s)** in a green border.
   - Confirm no duplicate chat cards were created (only one card exists for this attack).

---

## 3. Standard Attack Flow (Cancel Path)

Verify that canceling a roll updates the chat card status in-place and leaves database stats untouched.

### 3.1 Flow Execution
1. Ensure the attacker has targets selected and initiate a weapon roll as in Section 2.
2. When the preview dialog appears, inspect the values, then click **Cancel**.

### 3.2 Verification
1. **Verify Sheet State**:
   - Open Attacker sheet: Ammo must **not** be decremented (remains at the pre-attack count).
   - Open Target sheet: Damage and armor SP must **not** be mutated.
2. **Verify Chat Card**:
   - Locate the chat card in the log.
   - Confirm the banner status is updated in-place to **[CANCELED] - Discarded** in a red border.
   - Confirm no database changes were applied.

---

## 4. Manual Resolution Fallbacks

Verify that missing actor context or state conflicts block the commit path and alert the referee.

### 4.1 Missing Target Actor Context
1. Place a token on the scene that is **not** linked to any Actor (e.g., an actorless token template).
2. Select the Attacker and target this actorless token.
3. Initiate an attack.
4. Verify the preview Dialog pops up and:
   - Displays a warning banner: **Target Actor is unavailable; resolve target damage, armor, and saves manually.**
   - Disables the **Confirm** action, forcing manual GM resolution.
5. Click **GM Resolution** (or the corresponding manual confirmation button). *Note: Only users with Gamemaster (GM) permissions in Foundry VTT will see or be allowed to resolve this fallback path.*
6. Verify the chat card updates in-place to **[MANUAL] - Requires GM Resolution** in a yellow/orange banner.
7. Open the Target (Defender) sheet and manually apply the damage to the Wound Tracker and decrement armor SP (if appropriate) according to the GM's manual calculations.

### 4.2 Insufficient Ammo Warning
1. Set the Attacker's weapon ammo count to `0` on the actor sheet.
2. Target the Defender and initiate a roll.
3. Verify the preview dialog displays a warning: **Insufficient ammo to perform attack.**
4. Confirm the commit action is blocked or marked for manual resolution.

---

## 5. Running Automated Fixtures

To execute the automated suite of deterministic combat fixtures (verifying normalization, outcomes, hit locations, and fallbacks in code):
1. Open a terminal in the project root directory.
2. Run the command: `node tests/run-combat-fixtures.mjs`.
3. Verify that the output displays `2 combat fixture(s) passed`.
