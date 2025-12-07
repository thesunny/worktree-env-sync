import { join } from "node:path";
import dotenvx from "@dotenvx/dotenvx";
import { readContext } from "./readContext.js";
import { type Config, type Context, type GeneratedFile } from "./types.js";
import { serializeEnv } from "./utils.js";
import { validateEnvInputs } from "./validateEnvInputs.js";
import { writeEnvFiles, writeSymlinks } from "./write-utils.js";

export { readConfig, readContext } from "./readContext.js";
export type { Config, Context, GeneratedFile } from "./types.js";

/**
 * Processes the template by interpolating input variables using dotenvx.
 * Throws an error if the template references any variables not in inputVars.
 * Throws an error if any input variables are not used in the template.
 */
function processTemplate(
  templateContent: string,
  inputVars: Record<string, string>
): Record<string, string> {
  // Find all variable references in template before processing
  const usedVars = new Set<string>();
  const varRefs = templateContent.matchAll(/\$\{(\w+)\}/g);
  for (const match of varRefs) {
    const varName = match[1]!;
    if (!(varName in inputVars)) {
      throw new Error(`Template references missing variable: ${varName}`);
    }
    usedVars.add(varName);
  }

  // Warn about unused input variables
  const inputKeys = Object.keys(inputVars);
  const unusedVars = inputKeys.filter((key) => !usedVars.has(key));
  if (unusedVars.length > 0) {
    console.warn(
      `\n⚠️  WARNING: Input variables not used in template: ${unusedVars.join(", ")}\n`
    );
  }

  return dotenvx.parse(templateContent, { processEnv: inputVars });
}

/**
 * Pure function that generates env file contents from config and file contents.
 * Takes a fileContentsMap of relative paths to file contents and returns an array of
 * generated files with their paths and content. Does not perform any file I/O.
 */
export function generateEnvFiles(
  config: Config,
  fileContentsMap: Map<string, string>
): GeneratedFile[] {
  // Get template content
  const templateContent = fileContentsMap.get(config.template);
  if (!templateContent) {
    throw new Error(`Template file not found: ${config.template}`);
  }
  const templateVars = dotenvx.parse(templateContent, { processEnv: {} });

  // Parse all input files
  const inputFiles = new Map<string, Record<string, string>>();
  for (const sourceFile of Object.keys(config.inputFilesToFolders)) {
    const content = fileContentsMap.get(sourceFile);
    if (!content) {
      throw new Error(`Input file not found: ${sourceFile}`);
    }
    inputFiles.set(sourceFile, dotenvx.parse(content, { processEnv: {} }));
  }

  validateEnvInputs(templateVars, inputFiles, templateContent);

  // Generate output for each target folder
  const results: GeneratedFile[] = [];
  for (const [sourceFile, targetFolder] of Object.entries(
    config.inputFilesToFolders
  )) {
    const inputVars = inputFiles.get(sourceFile)!;
    const destPath = join(targetFolder, config.outputFile);

    // Process template with input vars
    const processedTemplate = processTemplate(templateContent, inputVars);

    // Build output with processed template only
    const content = serializeEnv(processedTemplate);

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

  for (const targetFolder of Object.values(config.inputFilesToFolders)) {
    const envFilePath = join(targetFolder, config.outputFile);
    const linkPaths = config.symlinksToOuputFile.map((symlink) =>
      join(targetFolder, symlink)
    );
    result.set(envFilePath, linkPaths);
  }

  return result;
}

/**
 * Generates env files, writes them to disk, and creates symlinks using a pre-loaded context.
 * This is the main orchestration function that performs all write operations.
 */
export function syncEnvFilesFromContext(context: Context): void {
  const { base, config, fileContentsMap } = context;

  const envFiles = generateEnvFiles(config, fileContentsMap);
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
