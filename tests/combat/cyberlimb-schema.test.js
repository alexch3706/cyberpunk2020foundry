import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function runCyberlimbSchemaTests() {
  const results = [];

  function test(name, fn) {
    try {
      fn();
      results.push({ name: `cyberlimb schema: ${name}`, passed: true });
    } catch (err) {
      console.error(`FAIL: cyberlimb schema: ${name}`);
      console.error(err);
      results.push({ name: `cyberlimb schema: ${name}`, passed: false, error: err });
    }
  }

  test("template.json contains location and sdp fields for cyberware", () => {
    const templatePath = path.resolve(__dirname, "../../template.json");
    const templateContent = fs.readFileSync(templatePath, "utf-8");
    const template = JSON.parse(templateContent);

    assert.ok(template.Item.cyberware, "cyberware item type should exist in template.json");
    
    // Test that the properties exist
    assert.ok("location" in template.Item.cyberware, "cyberware should have a location field");
    assert.equal(template.Item.cyberware.location, "", "default location should be empty string");

    assert.ok("sdp" in template.Item.cyberware, "cyberware should have an sdp field");
    assert.equal(template.Item.cyberware.sdp, 0, "default sdp should be 0");
  });

  return results;
}

if (process.argv[1] === fileURLToPath(import.meta.url) || process.argv[1]?.endsWith("cyberlimb-schema.test.js")) {
  const results = runCyberlimbSchemaTests();
  const failed = results.filter(r => !r.passed).length;
  if (failed > 0) process.exit(1);
}
