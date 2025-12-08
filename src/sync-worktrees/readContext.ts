import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ZodError } from "zod";
import { type Config, configSchema, type Context } from "./types.js";

function formatZodError(error: ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? `"${issue.path.join(".")}"` : "root";
      return `  - ${path}: ${issue.message}`;
    })
    .join("\n");
}

/**
 * Reads and validates a sync-env config file.
 * Exits with an error code if the config file is missing or invalid.
 */
export function readConfig(base: string, configPath: string): Config {
  const fullPath = join(base, configPath);
  const content = readFileSync(fullPath, "utf-8");

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    console.error(`\nError: Failed to parse config file as JSON.\n`);
    console.error(`Config file location: ${fullPath}\n`);
    console.error(`Config file contents:\n${content}\n`);
    process.exit(1);
  }

  const result = configSchema.safeParse(parsed);

  if (!result.success) {
    console.error(`\nError: Invalid config file.\n`);
    console.error(`Config file location: ${fullPath}\n`);
    console.error(`Config file contents:\n${JSON.stringify(parsed, null, 2)}\n`);
    console.error(`Validation errors:\n${formatZodError(result.error)}\n`);
    process.exit(1);
  }

  return result.data;
}

/**
 * Reads the config file and all supporting files (template and input env files).
 * Returns a Context object containing the base path, config, and fileContentsMap.
 */
export function readContext(base: string, configPath: string): Context {
  const config = readConfig(base, configPath);
  const fileContentsMap = new Map<string, string>();

  // Read template file
  const templatePath = join(base, config.template);
  fileContentsMap.set(config.template, readFileSync(templatePath, "utf-8"));

  // Read all input files
  for (const sourceFile of Object.keys(config.inputFilesToFolders)) {
    const sourcePath = join(base, sourceFile);
    fileContentsMap.set(sourceFile, readFileSync(sourcePath, "utf-8"));
  }

  return { base, config, fileContentsMap };
}
