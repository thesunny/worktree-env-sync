import { describe, expect, it, vi } from "vitest";
import {
  type Config,
  generateEnvFiles,
} from "../sync-worktrees/index.js";

describe("generateEnvFiles", () => {
  const config: Config = {
    template: ".env.template",
    inputFilesToFolders: {
      ".env.worktree1": "temp/worktree1",
      ".env.worktree2": "temp/worktree2",
    },
    outputFile: "env.local",
    symlinksToOuputFile: [],
  };

  it("should generate output with processed template only", () => {
    const fileMap = new Map([
      [
        ".env.template",
        `APP_NAME=myapp
APP_URL=http://localhost:3000
DATABASE_URL=\${DATABASE_URL}
API_KEY=\${API_KEY}
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
      content: `API_KEY="key1"
APP_NAME="myapp"
APP_URL="http://localhost:3000"
DATABASE_CONNECTION="postgres://localhost/worktree1?pool=5"
DATABASE_URL="postgres://localhost/worktree1"`,
    });
    expect(result[1]).toEqual({
      path: "temp/worktree2/env.local",
      content: `API_KEY="key2"
APP_NAME="myapp"
APP_URL="http://localhost:3000"
DATABASE_CONNECTION="postgres://localhost/worktree2?pool=5"
DATABASE_URL="postgres://localhost/worktree2"`,
    });
  });

  it("should allow input files with different keys", () => {
    const fileMap = new Map([
      [".env.template", "FOO=${FOO}\nBAR=${BAR}"],
      [".env.worktree1", "FOO=1\nBAR=2"],
      [".env.worktree2", "FOO=1\nBAR=3"],
    ]);

    const result = generateEnvFiles(config, fileMap);
    expect(result).toHaveLength(2);
  });

  it("should throw error when template has literal value for key also in input", () => {
    const singleConfig: Config = {
      ...config,
      inputFilesToFolders: { ".env.worktree1": "temp/worktree1" },
    };
    const fileMap = new Map([
      [".env.template", "APP=test"],
      [".env.worktree1", "APP=conflict"],
    ]);

    expect(() => generateEnvFiles(singleConfig, fileMap)).toThrow(
      "literal values"
    );
  });

  it("should allow template key matching input when template references input variable", () => {
    const singleConfig: Config = {
      ...config,
      inputFilesToFolders: { ".env.worktree1": "temp/worktree1" },
    };
    const fileMap = new Map([
      [".env.template", "PORT=${PORT}"],
      [".env.worktree1", "PORT=3000"],
    ]);

    const result = generateEnvFiles(singleConfig, fileMap);
    expect(result[0]?.content).toBe('PORT="3000"');
  });

  it("should warn when input variable is not used in template", () => {
    const singleConfig: Config = {
      ...config,
      inputFilesToFolders: { ".env.worktree1": "temp/worktree1" },
    };
    const fileMap = new Map([
      [".env.template", "APP=test"],
      [".env.worktree1", "UNUSED_VAR=value"],
    ]);

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = generateEnvFiles(singleConfig, fileMap);

    expect(result).toHaveLength(1);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("UNUSED_VAR")
    );
    warnSpy.mockRestore();
  });

  it("should throw error when template references missing variable", () => {
    const singleConfig: Config = {
      ...config,
      inputFilesToFolders: { ".env.worktree1": "temp/worktree1" },
    };
    const fileMap = new Map([
      [".env.template", "APP=${MISSING_VAR}\nFOO=${FOO}"],
      [".env.worktree1", "FOO=1"],
    ]);

    expect(() => generateEnvFiles(singleConfig, fileMap)).toThrow(
      "missing variable"
    );
  });

  it("should not expand system environment variables in input files", () => {
    const singleConfig: Config = {
      ...config,
      inputFilesToFolders: { ".env.worktree1": "temp/worktree1" },
    };
    const fileMap = new Map([
      [".env.template", `PATH=\${PATH}
HOME=\${HOME}`],
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
      inputFilesToFolders: { ".env.worktree1": "temp/worktree1" },
    };
    const fileMap = new Map([
      [".env.template", `MESSAGE=\${MESSAGE}
WIN_PATH=\${WIN_PATH}
MIXED=\${MIXED}`],
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
