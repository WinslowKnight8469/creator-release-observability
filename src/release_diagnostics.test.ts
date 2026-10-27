import test from "node:test";
import assert from "node:assert/strict";
import { releaseRequest, shouldRelease } from "./release_diagnostics.ts";

test("a creator release waits when its smoke test is red", () => {
  const input = releaseRequest.parse({
    project: "creator-studio",
    version: "draft-17",
    changedFiles: ["src/publish.ts"],
    smokeTestPassed: false,
  });
  assert.equal(shouldRelease(input), false);
});

test("a small green release is approved", () => {
  assert.equal(shouldRelease({
    project: "creator-studio",
    version: "draft-18",
    changedFiles: ["src/publish.ts"],
    smokeTestPassed: true,
  }), true);
});
