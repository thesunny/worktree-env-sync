import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { readConfig, syncWorktrees } from "../../sync-worktrees/index.js";

const BASE_PATH = __dirname;
const ERROR_CASES_PATH = join(BASE_PATH, "error-cases");

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

  it("should generate output with input and template sections", () => {
    syncWorktrees(BASE_PATH, "sync-env.json");

    const file1 = join(BASE_PATH, "temp/worktree1/env.local");
    const file2 = join(BASE_PATH, "temp/worktree2/env.local");

    expect(existsSync(file1)).toBe(true);
    expect(existsSync(file2)).toBe(true);

    const content1 = readFileSync(file1, "utf-8");
    const content2 = readFileSync(file2, "utf-8");

    expect(content1).toBe(`# Input variables
DATABASE_URL="postgres://localhost/worktree1"
API_KEY="key1"

# Template variables
APP_NAME="myapp"
APP_URL="http://localhost:3000"
DATABASE_CONNECTION="postgres://localhost/worktree1?pool=5"`);

    expect(content2).toBe(`# Input variables
DATABASE_URL="postgres://localhost/worktree2"
API_KEY="key2"

# Template variables
APP_NAME="myapp"
APP_URL="http://localhost:3000"
DATABASE_CONNECTION="postgres://localhost/worktree2?pool=5"`);
  });

  it("should throw error when input files have inconsistent keys", () => {
    mkdirSync(ERROR_CASES_PATH, { recursive: true });

    writeFileSync(
      join(ERROR_CASES_PATH, "inconsistent.json"),
      JSON.stringify({
        template: ".env.template",
        outputPath: "env.local",
        targetFolders: {
          ".env.a": "temp/a",
          ".env.b": "temp/b",
        },
        softLinks: [],
      })
    );
    writeFileSync(join(ERROR_CASES_PATH, ".env.template"), "APP=test");
    writeFileSync(join(ERROR_CASES_PATH, ".env.a"), "FOO=1\nBAR=2");
    writeFileSync(join(ERROR_CASES_PATH, ".env.b"), "FOO=1");

    expect(() => syncWorktrees(ERROR_CASES_PATH, "inconsistent.json")).toThrow(
      "Input files have inconsistent keys"
    );

    rmSync(ERROR_CASES_PATH, { recursive: true, force: true });
  });

  it("should throw error when template and input have conflicting keys", () => {
    mkdirSync(ERROR_CASES_PATH, { recursive: true });

    writeFileSync(
      join(ERROR_CASES_PATH, "conflict.json"),
      JSON.stringify({
        template: ".env.template",
        outputPath: "env.local",
        targetFolders: { ".env.a": "temp/a" },
        softLinks: [],
      })
    );
    writeFileSync(join(ERROR_CASES_PATH, ".env.template"), "APP=test");
    writeFileSync(join(ERROR_CASES_PATH, ".env.a"), "APP=conflict");

    expect(() => syncWorktrees(ERROR_CASES_PATH, "conflict.json")).toThrow(
      "conflicting keys"
    );

    rmSync(ERROR_CASES_PATH, { recursive: true, force: true });
  });

  it("should throw error when template references missing variable", () => {
    mkdirSync(ERROR_CASES_PATH, { recursive: true });

    writeFileSync(
      join(ERROR_CASES_PATH, "missing.json"),
      JSON.stringify({
        template: ".env.template",
        outputPath: "env.local",
        targetFolders: { ".env.a": "temp/a" },
        softLinks: [],
      })
    );
    writeFileSync(
      join(ERROR_CASES_PATH, ".env.template"),
      "APP=${MISSING_VAR}"
    );
    writeFileSync(join(ERROR_CASES_PATH, ".env.a"), "FOO=1");

    expect(() => syncWorktrees(ERROR_CASES_PATH, "missing.json")).toThrow(
      "missing variable"
    );

    rmSync(ERROR_CASES_PATH, { recursive: true, force: true });
  });
});
