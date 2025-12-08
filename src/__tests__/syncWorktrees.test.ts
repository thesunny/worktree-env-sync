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
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { syncWorktrees } from "../sync-worktrees/index.js";

const TEST_DIR = join(__dirname, "temp/syncWorktrees-test");

describe("syncWorktrees", () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    rmSync(TEST_DIR, { recursive: true, force: true });
    mkdirSync(TEST_DIR, { recursive: true });

    // Create config file
    writeFileSync(
      join(TEST_DIR, "worktree-env-sync.json"),
      JSON.stringify({
        template: ".env.template",
        inputFilesToFolders: {
          ".env.worktree1": "worktrees/wt1",
          ".env.worktree2": "worktrees/wt2",
        },
        outputFile: ".env.local",
        symlinksToOuputFile: [
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
DATABASE_URL=\${DATABASE_URL}
API_KEY=\${API_KEY}
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
    consoleLogSpy.mockRestore();
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it("should generate env files and create symlinks for all worktrees", () => {
    syncWorktrees(TEST_DIR, "worktree-env-sync.json");

    // Check env files were created
    const envFile1 = join(TEST_DIR, "worktrees/wt1/.env.local");
    const envFile2 = join(TEST_DIR, "worktrees/wt2/.env.local");

    expect(existsSync(envFile1)).toBe(true);
    expect(existsSync(envFile2)).toBe(true);

    // Check env file contents (alphabetically sorted)
    expect(readFileSync(envFile1, "utf-8")).toBe(`API_KEY="key1"
APP_NAME="myapp"
APP_URL="http://localhost:3000"
DATABASE_CONNECTION="postgres://localhost/worktree1?pool=5"
DATABASE_URL="postgres://localhost/worktree1"`);

    expect(readFileSync(envFile2, "utf-8")).toBe(`API_KEY="key2"
APP_NAME="myapp"
APP_URL="http://localhost:3000"
DATABASE_CONNECTION="postgres://localhost/worktree2?pool=5"
DATABASE_URL="postgres://localhost/worktree2"`);

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

  describe("success message", () => {
    it("should output success message with template, generated files, and symlinks", () => {
      syncWorktrees(TEST_DIR, "worktree-env-sync.json");

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("Sync completed successfully!")
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("Template: .env.template")
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("Generated env files:")
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining(".env.worktree1 -> worktrees/wt1/.env.local")
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining(".env.worktree2 -> worktrees/wt2/.env.local")
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("Created symlinks:")
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("worktrees/wt1/apps/web/.env.local")
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("worktrees/wt2/packages/db/.env.local")
      );
    });
  });
});
