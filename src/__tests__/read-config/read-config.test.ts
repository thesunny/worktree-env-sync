import { describe, expect, it } from "vitest";
import {
  type Config,
  generateEnvFiles,
  readConfig,
} from "../../sync-worktrees/index.js";

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

describe("generateEnvFiles", () => {
  const config: Config = {
    template: ".env.template",
    outputPath: "env.local",
    targetFolders: {
      ".env.worktree1": "temp/worktree1",
      ".env.worktree2": "temp/worktree2",
    },
    softLinks: [],
  };

  it("should generate output with input and template sections", () => {
    const fileMap = new Map([
      [
        ".env.template",
        `APP_NAME=myapp
APP_URL=http://localhost:3000
DATABASE_CONNECTION=\${DATABASE_URL}?pool=5`,
      ],
      [
        ".env.worktree1",
        `DATABASE_URL=postgres://localhost/worktree1
API_KEY=key1`,
      ],
      [
        ".env.worktree2",
        `DATABASE_URL=postgres://localhost/worktree2
API_KEY=key2`,
      ],
    ]);

    const result = generateEnvFiles(config, fileMap);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      path: "temp/worktree1/env.local",
      content: `# Input variables
DATABASE_URL="postgres://localhost/worktree1"
API_KEY="key1"

# Template variables
APP_NAME="myapp"
APP_URL="http://localhost:3000"
DATABASE_CONNECTION="postgres://localhost/worktree1?pool=5"`,
    });
    expect(result[1]).toEqual({
      path: "temp/worktree2/env.local",
      content: `# Input variables
DATABASE_URL="postgres://localhost/worktree2"
API_KEY="key2"

# Template variables
APP_NAME="myapp"
APP_URL="http://localhost:3000"
DATABASE_CONNECTION="postgres://localhost/worktree2?pool=5"`,
    });
  });

  it("should throw error when input files have inconsistent keys", () => {
    const fileMap = new Map([
      [".env.template", "APP=test"],
      [".env.worktree1", "FOO=1\nBAR=2"],
      [".env.worktree2", "FOO=1"],
    ]);

    expect(() => generateEnvFiles(config, fileMap)).toThrow(
      "Input files have inconsistent keys"
    );
  });

  it("should throw error when template and input have conflicting keys", () => {
    const singleConfig: Config = {
      ...config,
      targetFolders: { ".env.worktree1": "temp/worktree1" },
    };
    const fileMap = new Map([
      [".env.template", "APP=test"],
      [".env.worktree1", "APP=conflict"],
    ]);

    expect(() => generateEnvFiles(singleConfig, fileMap)).toThrow(
      "conflicting keys"
    );
  });

  it("should throw error when template references missing variable", () => {
    const singleConfig: Config = {
      ...config,
      targetFolders: { ".env.worktree1": "temp/worktree1" },
    };
    const fileMap = new Map([
      [".env.template", "APP=${MISSING_VAR}"],
      [".env.worktree1", "FOO=1"],
    ]);

    expect(() => generateEnvFiles(singleConfig, fileMap)).toThrow(
      "missing variable"
    );
  });
});
