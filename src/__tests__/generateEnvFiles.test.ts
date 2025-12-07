import { describe, expect, it } from "vitest";
import {
  type Config,
  generateEnvFiles,
} from "../sync-worktrees/index.js";

describe("generateEnvFiles", () => {
  const config: Config = {
    template: ".env.template",
    outputPath: "env.local",
    targetFolders: {
      ".env.worktree1": "temp/worktree1",
      ".env.worktree2": "temp/worktree2",
    },
    symlinks: [],
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

  it("should not expand system environment variables in input files", () => {
    const singleConfig: Config = {
      ...config,
      targetFolders: { ".env.worktree1": "temp/worktree1" },
    };
    const fileMap = new Map([
      [".env.template", "APP=simple"],
      [".env.worktree1", `PATH=/custom/path
HOME=/custom/home`],
    ]);

    const result = generateEnvFiles(singleConfig, fileMap);

    // Should contain the literal values, not system env vars
    expect(result[0]?.content).toContain(`PATH="/custom/path"`);
    expect(result[0]?.content).toContain(`HOME="/custom/home"`);
    // Should NOT contain actual system paths
    expect(result[0]?.content).not.toContain("/usr/bin");
    expect(result[0]?.content).not.toContain("/Users/");
  });

  it("should escape quotes and backslashes in values", () => {
    const singleConfig: Config = {
      ...config,
      targetFolders: { ".env.worktree1": "temp/worktree1" },
    };
    const fileMap = new Map([
      [".env.template", "APP=simple"],
      [".env.worktree1", `MESSAGE=hello "world"
WIN_PATH=C:\\Users\\test
MIXED=say \\"hi\\"`],
    ]);

    const result = generateEnvFiles(singleConfig, fileMap);

    expect(result[0]?.content).toContain(`MESSAGE="hello \\"world\\""`);
    expect(result[0]?.content).toContain(`WIN_PATH="C:\\\\Users\\\\test"`);
    expect(result[0]?.content).toContain(`MIXED="say \\\\\\"hi\\\\\\""`);
  });
});
