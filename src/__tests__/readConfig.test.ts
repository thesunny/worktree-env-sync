import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readConfig } from "../sync-worktrees/index.js";

const BASE_PATH = join(__dirname, "readConfig");

describe("readConfig", () => {
  it("should read and validate sync-env.json", () => {
    const config = readConfig(BASE_PATH, "worktree-env-sync.json");

    expect(config).toEqual({
      template: ".env.template",
      inputFilesToFolders: {
        ".env.worktree1": "temp/worktree1",
        ".env.worktree2": "temp/worktree2",
      },
      outputFile: "env.local",
      symlinksToOuputFile: ["apps/web/.env.local", "apps/docs/.env.local", "packages/db/.env.local"],
    });
  });

  it("should throw an error for invalid config", () => {
    expect(() => readConfig(BASE_PATH, "invalid-config.json")).toThrow();
  });
});
