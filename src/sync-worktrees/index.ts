import { mkdirSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import dotenvx from "@dotenvx/dotenvx";
import { readConfig, readContext } from "./readContext.js";
import { type Config, type Context, type GeneratedFile } from "./types.js";
import { serializeEnv } from "./utils.js";

export { readConfig, readContext } from "./readContext.js";
export type { Config, Context, GeneratedFile } from "./types.js";

/**
 * Validates that all input files have the same set of keys.
 * Logs details and throws an error if any inconsistencies are found.
 */
function validateInputFilesConsistency(
  inputFiles: Map<string, Record<string, string>>
): void {
  const entries = Array.from(inputFiles.entries());
  if (entries.length < 2) return;

  const [firstFile, firstVars] = entries[0]!;
  const firstKeys = new Set(Object.keys(firstVars));

  for (const [file, vars] of entries.slice(1)) {
    const keys = new Set(Object.keys(vars));

    const missingKeys = [...firstKeys].filter((k) => !keys.has(k));
    const extraKeys = [...keys].filter((k) => !firstKeys.has(k));

    if (missingKeys.length > 0 || extraKeys.length > 0) {
      console.log(`Input file inconsistency detected:`);
      console.log(`  Comparing ${file} to ${firstFile}`);
      if (missingKeys.length > 0) {
        console.log(`  Missing keys: ${missingKeys.join(", ")}`);
      }
      if (extraKeys.length > 0) {
        console.log(`  Extra keys: ${extraKeys.join(", ")}`);
      }
      throw new Error("Input files have inconsistent keys");
    }
  }
}

/**
 * Validates that template and input variables don't share any keys.
 * Throws an error if any conflicts are found.
 */
function validateNoConflicts(
  templateVars: Record<string, string>,
  inputVars: Record<string, string>,
  inputFile: string
): void {
  const templateKeys = new Set(Object.keys(templateVars));
  const inputKeys = Object.keys(inputVars);

  const conflicts = inputKeys.filter((k) => templateKeys.has(k));
  if (conflicts.length > 0) {
    throw new Error(
      `Template and input file "${inputFile}" have conflicting keys: ${conflicts.join(
        ", "
      )}`
    );
  }
}

/**
 * Validates all input files and template variables.
 * Ensures input files have consistent keys and don't conflict with template.
 */
function validateEnvInputs(
  templateVars: Record<string, string>,
  inputFiles: Map<string, Record<string, string>>
): void {
  validateInputFilesConsistency(inputFiles);

  for (const [sourceFile, vars] of inputFiles) {
    validateNoConflicts(templateVars, vars, sourceFile);
  }
}

/**
 * Processes the template by interpolating input variables using dotenvx.
 * Throws an error if the template references any variables not in inputVars.
 */
function processTemplate(
  templateContent: string,
  inputVars: Record<string, string>
): Record<string, string> {
  // Find all variable references in template before processing
  const varRefs = templateContent.matchAll(/\$\{(\w+)\}/g);
  for (const match of varRefs) {
    const varName = match[1]!;
    if (!(varName in inputVars)) {
      throw new Error(`Template references missing variable: ${varName}`);
    }
  }

  return dotenvx.parse(templateContent, { processEnv: inputVars });
}

/**
 * Pure function that generates env file contents from config and file contents.
 * Takes a fileMap of relative paths to file contents and returns an array of
 * generated files with their paths and content. Does not perform any file I/O.
 */
export function generateEnvFiles(
  config: Config,
  fileMap: Map<string, string>
): GeneratedFile[] {
  // Get template content
  const templateContent = fileMap.get(config.template);
  if (!templateContent) {
    throw new Error(`Template file not found: ${config.template}`);
  }
  const templateVars = dotenvx.parse(templateContent, { processEnv: {} });

  // Parse all input files
  const inputFiles = new Map<string, Record<string, string>>();
  for (const sourceFile of Object.keys(config.targetFolders)) {
    const content = fileMap.get(sourceFile);
    if (!content) {
      throw new Error(`Input file not found: ${sourceFile}`);
    }
    inputFiles.set(sourceFile, dotenvx.parse(content, { processEnv: {} }));
  }

  validateEnvInputs(templateVars, inputFiles);

  // Generate output for each target folder
  const results: GeneratedFile[] = [];
  for (const [sourceFile, targetFolder] of Object.entries(
    config.targetFolders
  )) {
    const inputVars = inputFiles.get(sourceFile)!;
    const destPath = join(targetFolder, config.outputPath);

    // Process template with input vars
    const processedTemplate = processTemplate(templateContent, inputVars);

    // Build output with sections
    const content = [
      "# Input variables",
      serializeEnv(inputVars),
      "",
      "# Template variables",
      serializeEnv(processedTemplate),
    ].join("\n");

    results.push({ path: destPath, content });
  }

  return results;
}

/**
 * Pure function that generates a mapping of env file paths to their symlink paths.
 * Returns a Map where each key is the path to a generated env file and the value
 * is an array of paths where symlinks should be created pointing to that env file.
 */
export function generateEnvLinks(config: Config): Map<string, string[]> {
  const result = new Map<string, string[]>();

  for (const targetFolder of Object.values(config.targetFolders)) {
    const envFilePath = join(targetFolder, config.outputPath);
    const linkPaths = config.softLinks.map((softLink) =>
      join(targetFolder, softLink)
    );
    result.set(envFilePath, linkPaths);
  }

  return result;
}

/**
 * Writes generated env files to disk.
 */
function writeEnvFiles(base: string, envFiles: GeneratedFile[]): void {
  for (const { path, content } of envFiles) {
    const fullPath = join(base, path);
    mkdirSync(dirname(fullPath), { recursive: true });
    writeFileSync(fullPath, content);
  }
}

/**
 * Creates symlinks for env files.
 */
function writeSymlinks(base: string, envLinks: Map<string, string[]>): void {
  for (const [envFilePath, linkPaths] of envLinks) {
    const fullEnvPath = join(base, envFilePath);
    for (const linkPath of linkPaths) {
      const fullLinkPath = join(base, linkPath);
      mkdirSync(dirname(fullLinkPath), { recursive: true });
      const relativePath = relative(dirname(fullLinkPath), fullEnvPath);
      symlinkSync(relativePath, fullLinkPath);
    }
  }
}

/**
 * Generates env files, writes them to disk, and creates symlinks using a pre-loaded context.
 * This is the main orchestration function that performs all write operations.
 */
export function syncEnvFilesFromContext(context: Context): void {
  const { base, config, fileMap } = context;

  const envFiles = generateEnvFiles(config, fileMap);
  const envLinks = generateEnvLinks(config);

  writeEnvFiles(base, envFiles);
  writeSymlinks(base, envLinks);
}

/**
 * Main entry point. Reads the config file and syncs all env files and symlinks.
 */
export function syncWorktrees(base: string, configPath: string): void {
  const context = readContext(base, configPath);
  syncEnvFilesFromContext(context);
}
