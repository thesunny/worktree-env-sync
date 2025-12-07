import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readlinkSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { syncWorktrees } from "../sync-worktrees/index.js";

const TEST_DIR = join(__dirname, "temp/syncWorktrees-test");

describe("syncWorktrees", () => {
  beforeEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
    mkdirSync(TEST_DIR, { recursive: true });

    // Create config file
    writeFileSync(
      join(TEST_DIR, "sync-env.json"),
      JSON.stringify({
        template: ".env.template",
        outputPath: ".env.local",
        targetFolders: {
          ".env.worktree1": "worktrees/wt1",
          ".env.worktree2": "worktrees/wt2",
        },
        symlinks: [
          "apps/web/.env.local",
          "apps/docs/.env.local",
          "packages/db/.env.local",
        ],
      })
    );

    // Create template file
    writeFileSync(
      join(TEST_DIR, ".env.template"),
      `APP_NAME=myapp
APP_URL=http://localhost:3000
DATABASE_CONNECTION=\${DATABASE_URL}?pool=5`
    );

    // Create input env files
    writeFileSync(
      join(TEST_DIR, ".env.worktree1"),
      `DATABASE_URL=postgres://localhost/worktree1
API_KEY=key1`
    );
    writeFileSync(
      join(TEST_DIR, ".env.worktree2"),
      `DATABASE_URL=postgres://localhost/worktree2
API_KEY=key2`
    );
  });

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it("should generate env files and create symlinks for all worktrees", () => {
    syncWorktrees(TEST_DIR, "sync-env.json");

    // Check env files were created
    const envFile1 = join(TEST_DIR, "worktrees/wt1/.env.local");
    const envFile2 = join(TEST_DIR, "worktrees/wt2/.env.local");

    expect(existsSync(envFile1)).toBe(true);
    expect(existsSync(envFile2)).toBe(true);

    // Check env file contents
    expect(readFileSync(envFile1, "utf-8")).toBe(`# Input variables
DATABASE_URL="postgres://localhost/worktree1"
API_KEY="key1"

# Template variables
APP_NAME="myapp"
APP_URL="http://localhost:3000"
DATABASE_CONNECTION="postgres://localhost/worktree1?pool=5"`);

    expect(readFileSync(envFile2, "utf-8")).toBe(`# Input variables
DATABASE_URL="postgres://localhost/worktree2"
API_KEY="key2"

# Template variables
APP_NAME="myapp"
APP_URL="http://localhost:3000"
DATABASE_CONNECTION="postgres://localhost/worktree2?pool=5"`);

    // Check symlinks for worktree1
    const wt1Links = [
      "worktrees/wt1/apps/web/.env.local",
      "worktrees/wt1/apps/docs/.env.local",
      "worktrees/wt1/packages/db/.env.local",
    ];
    for (const link of wt1Links) {
      const fullPath = join(TEST_DIR, link);
      expect(existsSync(fullPath)).toBe(true);
      expect(lstatSync(fullPath).isSymbolicLink()).toBe(true);
      // Verify symlink resolves to the correct content
      expect(readFileSync(fullPath, "utf-8")).toContain("worktree1");
    }

    // Check symlinks for worktree2
    const wt2Links = [
      "worktrees/wt2/apps/web/.env.local",
      "worktrees/wt2/apps/docs/.env.local",
      "worktrees/wt2/packages/db/.env.local",
    ];
    for (const link of wt2Links) {
      const fullPath = join(TEST_DIR, link);
      expect(existsSync(fullPath)).toBe(true);
      expect(lstatSync(fullPath).isSymbolicLink()).toBe(true);
      // Verify symlink resolves to the correct content
      expect(readFileSync(fullPath, "utf-8")).toContain("worktree2");
    }

    // Verify symlinks point to relative paths
    const sampleLink = join(TEST_DIR, "worktrees/wt1/apps/web/.env.local");
    const linkTarget = readlinkSync(sampleLink);
    expect(linkTarget).toBe("../../.env.local");
  });
});
