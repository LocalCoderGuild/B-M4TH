import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const WEB_DIR = join(import.meta.dir, "..");

describe("web client scaffold", () => {
  test("package.json declares the expected runtime stack", async () => {
    const raw = await readFile(join(WEB_DIR, "package.json"), "utf8");
    const pkg = JSON.parse(raw) as { dependencies?: Record<string, string> };
    const deps = pkg.dependencies ?? {};
    for (const name of [
      "react",
      "react-dom",
      "react-router-dom",
      "pixi.js",
      "@colyseus/sdk",
      "@mantine/core",
      "zustand",
    ]) {
      expect(deps[name]).toBeDefined();
    }
  });
});
