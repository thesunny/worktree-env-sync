import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import dotenvx from "@dotenvx/dotenvx";
import { z } from "zod";

const configSchema = z.object({
  template: z.string(),
  outputPath: z.string(),
  targetFolders: z.record(z.string(), z.string()),
  softLinks: z.array(z.string()),
});

export type Config = z.infer<typeof configSchema>;

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

function serializeEnv(env: Record<string, string>): string {
  return Object.entries(env)
    .map(([key, value]) => `${key}="${value}"`)
    .join("\n");
}

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
      `Template and input file "${inputFile}" have conflicting keys: ${conflicts.join(", ")}`
    );
  }
}

function processTemplate(
  templateContent: string,
  inputVars: Record<string, string>
): Record<string, string> {
  // Find all variable references in template before processing
  const varRefs = templateContent.matchAll(/\$\{(\w+)\}/g);
  for (const match of varRefs) {
    const varName = match[1]!;
    if (!(varName in inputVars)) {
      throw new Error(
        `Template references missing variable: ${varName}`
      );
    }
  }

  return dotenvx.parse(templateContent, { processEnv: inputVars });
}

export function syncEnvFiles(base: string, config: Config): void {
  // Read template
  const templatePath = join(base, config.template);
  const templateContent = readFileSync(templatePath, "utf-8");
  const templateVars = dotenvx.parse(templateContent, { processEnv: {} });

  // Read all input files
  const inputFiles = new Map<string, Record<string, string>>();
  for (const sourceFile of Object.keys(config.targetFolders)) {
    const sourcePath = join(base, sourceFile);
    const content = readFileSync(sourcePath, "utf-8");
    inputFiles.set(sourceFile, dotenvx.parse(content));
  }

  // Validate input files have consistent keys
  validateInputFilesConsistency(inputFiles);

  // Validate no conflicts between template and input vars
  for (const [sourceFile, vars] of inputFiles) {
    validateNoConflicts(templateVars, vars, sourceFile);
  }

  // Process each target folder
  for (const [sourceFile, targetFolder] of Object.entries(config.targetFolders)) {
    const inputVars = inputFiles.get(sourceFile)!;
    const destPath = join(base, targetFolder, config.outputPath);

    // Process template with input vars
    const processedTemplate = processTemplate(templateContent, inputVars);

    // Build output with sections
    const output = [
      "# Input variables",
      serializeEnv(inputVars),
      "",
      "# Template variables",
      serializeEnv(processedTemplate),
    ].join("\n");

    mkdirSync(dirname(destPath), { recursive: true });
    writeFileSync(destPath, output);
  }
}

export function syncWorktrees(base: string, configPath: string): void {
  const config = readConfig(base, configPath);
  syncEnvFiles(base, config);
}
