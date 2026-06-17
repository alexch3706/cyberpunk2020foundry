import assert from "node:assert/strict";



import { CyberpunkActor } from "../../module/actor/actor.js";

export function runActorDataTests() {
  const results = [];
  try {
    assertPartialCyberlimbSDP();
    results.push({ name: "assertPartialCyberlimbSDP", passed: true });
  } catch(e) {
    console.error(e);
    results.push({ name: "assertPartialCyberlimbSDP", passed: false });
  }

  try {
    assertMaxSDPSelection();
    results.push({ name: "assertMaxSDPSelection", passed: true });
  } catch(e) {
    console.error(e);
    results.push({ name: "assertMaxSDPSelection", passed: false });
  }

  try {
    assertFBCOverride();
    results.push({ name: "assertFBCOverride", passed: true });
  } catch(e) {
    console.error(e);
    results.push({ name: "assertFBCOverride", passed: false });
  }

  return results;
}

function assertPartialCyberlimbSDP() {
  const mockActor = {
    type: "character",
    items: {
      contents: [
        {
          type: "cyberware",
          system: {
            equipped: true,
            location: "lArm",
            sdp: 30
          }
        }
      ]
    },
    woundState: () => "Light",
    system: {
      stats: {
        int: { base: 5, tempMod: 0 },
        ref: { base: 5, tempMod: 0 },
        tech: { base: 5, tempMod: 0 },
        cool: { base: 5, tempMod: 0 },
        attr: { base: 5, tempMod: 0 },
        luck: { base: 5, tempMod: 0 },
        ma: { base: 5, tempMod: 0 },
        bt: { base: 5, tempMod: 0 },
        emp: { base: 5, tempMod: 0 }
      },
      hitLocations: {
        lArm: { label: "Left Arm", location: [6], type: "flesh" },
        rArm: { label: "Right Arm", location: [5], type: "flesh" }
      }
    }
  };

  // Call the method
  CyberpunkActor.prototype._prepareCharacterData.call(mockActor, mockActor.system);

  // Assertions
  assert.equal(mockActor.system.hitLocations.lArm.type, "cybernetic", "lArm should be upgraded to cybernetic type");
  assert.equal(mockActor.system.hitLocations.lArm.sdp?.max, 30, "lArm max SDP should be set to 30");
  assert.equal(mockActor.system.hitLocations.lArm.sdp?.value, 30, "lArm current SDP should initialize to 30");
  
  assert.equal(mockActor.system.hitLocations.rArm.type, "flesh", "rArm should remain flesh");
  assert.equal(mockActor.system.hitLocations.rArm.sdp, undefined, "rArm should not have SDP initialized");
}

function assertMaxSDPSelection() {
  const mockActor = {
    type: "character",
    items: {
      contents: [
        { type: "cyberware", system: { equipped: true, location: "lArm", sdp: 15 } },
        { type: "cyberware", system: { equipped: true, location: "lArm", sdp: 30 } },
        { type: "cyberware", system: { equipped: true, location: "lArm", sdp: 10 } }
      ]
    },
    woundState: () => "Light",
    system: {
      stats: { int: {base:5, tempMod:0}, ref: {base:5, tempMod:0}, tech: {base:5, tempMod:0}, cool: {base:5, tempMod:0}, attr: {base:5, tempMod:0}, luck: {base:5, tempMod:0}, ma: {base:5, tempMod:0}, bt: {base:5, tempMod:0}, emp: {base:5, tempMod:0} },
      hitLocations: {
        lArm: { label: "Left Arm", location: [6], type: "flesh" }
      }
    }
  };

  CyberpunkActor.prototype._prepareCharacterData.call(mockActor, mockActor.system);

  assert.equal(mockActor.system.hitLocations.lArm.sdp?.max, 30, "Should select max SDP among multiple items on the same location");
}

function assertFBCOverride() {
  const mockActor = {
    type: "character",
    items: {
      contents: [
        {
          type: "cyberware",
          system: {
            equipped: true,
            isFBC: true,
            fbcHitLocations: {
              lArm: { sdp: 20 },
              rArm: { sdp: 20 }
            }
          }
        },
        {
          type: "cyberware",
          system: {
            equipped: true,
            location: "lArm",
            sdp: 40
          }
        }
      ]
    },
    woundState: () => "Light",
    system: {
      stats: { int: {base:5, tempMod:0}, ref: {base:5, tempMod:0}, tech: {base:5, tempMod:0}, cool: {base:5, tempMod:0}, attr: {base:5, tempMod:0}, luck: {base:5, tempMod:0}, ma: {base:5, tempMod:0}, bt: {base:5, tempMod:0}, emp: {base:5, tempMod:0} },
      hitLocations: {
        lArm: { label: "Left Arm", location: [6], type: "flesh" },
        rArm: { label: "Right Arm", location: [5], type: "flesh" }
      }
    }
  };

  CyberpunkActor.prototype._prepareCharacterData.call(mockActor, mockActor.system);

  assert.equal(mockActor.system.hitLocations.rArm.sdp?.max, 20, "rArm should fallback to FBC max SDP");
  assert.equal(mockActor.system.hitLocations.lArm.sdp?.max, 40, "lArm should override FBC with specific cyberware max SDP");
}
