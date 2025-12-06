import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { readConfig, syncWorktrees } from "../../sync-worktrees/index.js";

const BASE_PATH = __dirname;

describe("readConfig", () => {
  it("should read and validate sync-env.json", () => {
    const config = readConfig(BASE_PATH, "sync-env.json");

    expect(config).toEqual({
      template: ".env.template",
      outputPath: "env.local",
      targetFolders: {
        ".env.worktree1": "temp/worktree1",
        ".env.worktree2": "temp/worktree2",
      },
      softLinks: ["apps/web", "apps/docs", "packages/db"],
    });
  });

  it("should throw an error for invalid config", () => {
    expect(() => readConfig(BASE_PATH, "invalid-config.json")).toThrow();
  });
});

describe("syncWorktrees", () => {
  beforeEach(() => {
    rmSync(join(BASE_PATH, "temp"), { recursive: true, force: true });
  });

  it("should copy env files to target folders with quoted values", () => {
    syncWorktrees(BASE_PATH, "sync-env.json");

    const file1 = join(BASE_PATH, "temp/worktree1/env.local");
    const file2 = join(BASE_PATH, "temp/worktree2/env.local");

    expect(existsSync(file1)).toBe(true);
    expect(existsSync(file2)).toBe(true);

    const content1 = readFileSync(file1, "utf-8");
    const content2 = readFileSync(file2, "utf-8");

    expect(content1).toBe(`DATABASE_URL="postgres://localhost/worktree1"
API_KEY="key1"`);
    expect(content2).toBe(`DATABASE_URL="postgres://localhost/worktree2"
API_KEY="key2"`);
  });
});
