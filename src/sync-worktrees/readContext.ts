import { readFileSync } from "node:fs";
import { join } from "node:path";
import { type Config, configSchema, type Context } from "./types.js";

/**
 * Reads and validates a sync-env config file.
 * Throws an error if the config file is missing or invalid.
 */
export function readConfig(base: string, configPath: string): Config {
  const fullPath = join(base, configPath);
  const content = readFileSync(fullPath, "utf-8");
  const parsed = JSON.parse(content);
  const result = configSchema.safeParse(parsed);

  if (!result.success) {
    throw new Error(`Invalid config file: ${result.error.message}`);
  }

  return result.data;
}

/**
 * Reads the config file and all supporting files (template and input env files).
 * Returns a Context object containing the base path, config, and fileMap.
 */
export function readContext(base: string, configPath: string): Context {
  const config = readConfig(base, configPath);
  const fileMap = new Map<string, string>();

  // Read template file
  const templatePath = join(base, config.template);
  fileMap.set(config.template, readFileSync(templatePath, "utf-8"));

  // Read all input files
  for (const sourceFile of Object.keys(config.targetFolders)) {
    const sourcePath = join(base, sourceFile);
    fileMap.set(sourceFile, readFileSync(sourcePath, "utf-8"));
  }

  return { base, config, fileMap };
}
