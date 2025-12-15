import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readConfig } from "../sync-worktrees/index.js";

const BASE_PATH = join(__dirname, "readConfig");

describe("readConfig", () => {
  it("should read and validate sync-env.json", () => {
    const config = readConfig(BASE_PATH, "worktree-env-sync.json");

    expect(config).toEqual({
      template: ".env.template",
      inputFilesToFolders: {
        ".env.worktree1": "../worktree1",
        ".env.worktree2": "../worktree2",
      },
      outputFile: "env.local",
      symlinksToOuputFile: ["apps/web/.env.local", "apps/docs/.env.local", "packages/db/.env.local"],
    });
  });

  describe("error handling", () => {
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
    let processExitSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      processExitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    });

    afterEach(() => {
      consoleErrorSpy.mockRestore();
      processExitSpy.mockRestore();
    });

    it("should show friendly error for invalid JSON", () => {
      readConfig(BASE_PATH, "invalid-json.json");

      expect(processExitSpy).toHaveBeenCalledWith(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Error: Failed to parse config file as JSON.")
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Config file location:")
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("invalid-json.json")
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Config file contents:")
      );
    });

    it("should show friendly error for invalid config schema", () => {
      readConfig(BASE_PATH, "invalid-config.json");

      expect(processExitSpy).toHaveBeenCalledWith(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Error: Invalid config file.")
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Config file location:")
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("invalid-config.json")
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Config file contents:")
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Validation errors:")
      );
    });

    it("should show specific validation errors for missing fields", () => {
      readConfig(BASE_PATH, "invalid-config.json");

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('"inputFilesToFolders"')
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('"outputFile"')
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('"symlinksToOuputFile"')
      );
    });

    it("should show validation error for folder paths not starting with '../'", () => {
      readConfig(BASE_PATH, "invalid-folder-paths.json");

      expect(processExitSpy).toHaveBeenCalledWith(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Error: Invalid config file.")
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Folder path must start with "../" to indicate a sibling directory')
      );
    });
  });
});
