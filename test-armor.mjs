import { resolveArmor } from "./module/combat/armor-resolver.js";
function testSP(val) {
  const snapshot = {
    equippedArmor: [
      { id: "vest", name: "Vest", system: { equipped: true, coverage: { lleg: { stoppingPower: val, ablation: 0 } } } },
      { id: "mg", name: "MetalGear", system: { equipped: true, coverage: { lleg: { stoppingPower: 25, ablation: 0 } } } }
    ]
  };
  return resolveArmor(false, snapshot, "lleg").effectiveStoppingPower;
}
console.log('val=0:', testSP(0));
console.log('val="0":', testSP("0"));
console.log('val="":', testSP(""));
console.log('val=null:', testSP(null));
console.log('val=undefined:', testSP(undefined));
