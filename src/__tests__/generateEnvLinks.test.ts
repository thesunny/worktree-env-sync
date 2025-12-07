import { describe, expect, it } from "vitest";
import { type Config, generateEnvLinks } from "../sync-worktrees/index.js";

describe("generateEnvLinks", () => {
  it("should generate symlink paths for each target folder", () => {
    const config: Config = {
      template: ".env.template",
      outputPath: ".env.local",
      targetFolders: {
        ".env.worktree1": "temp/worktree1",
        ".env.worktree2": "temp/worktree2",
      },
      symlinks: [
        "apps/web/.env.local",
        "apps/docs/.env.local",
        "packages/db/.env.local",
      ],
    };

    const result = generateEnvLinks(config);

    expect(result.size).toBe(2);
    expect(result.get("temp/worktree1/.env.local")).toEqual([
      "temp/worktree1/apps/web/.env.local",
      "temp/worktree1/apps/docs/.env.local",
      "temp/worktree1/packages/db/.env.local",
    ]);
    expect(result.get("temp/worktree2/.env.local")).toEqual([
      "temp/worktree2/apps/web/.env.local",
      "temp/worktree2/apps/docs/.env.local",
      "temp/worktree2/packages/db/.env.local",
    ]);
  });

  it("should return empty arrays when no symlinks configured", () => {
    const config: Config = {
      template: ".env.template",
      outputPath: ".env.local",
      targetFolders: {
        ".env.worktree1": "temp/worktree1",
      },
      symlinks: [],
    };

    const result = generateEnvLinks(config);

    expect(result.size).toBe(1);
    expect(result.get("temp/worktree1/.env.local")).toEqual([]);
  });
});
