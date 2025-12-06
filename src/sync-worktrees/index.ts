import { existsSync, readFileSync, writeFileSync, symlinkSync, unlinkSync, lstatSync } from "node:fs";
import { basename, dirname, join, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Navigate from packages/scripts/src to the monorepo root
const monorepoRoot = resolve(__dirname, "..", "..", "..");

const configSchema = z.object({
  destinations: z.array(z.string()),
  softlinksSource: z.string(),
  softlinksDestinations: z.array(z.string()),
});

/**
 * Parse a .env file content into a Map of key-value pairs.
 * Preserves comments and empty lines by storing them with special keys.
 */
function parseEnvFile(content: string): Map<string, string> {
  const result = new Map<string, string>();
  const lines = content.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines and comments for parsing (they won't be in the override)
    if (trimmed === "" || trimmed.startsWith("#")) {
      continue;
    }

    // Parse KEY=VALUE (handle values with = in them)
    const eqIndex = line.indexOf("=");
    if (eqIndex !== -1) {
      const key = line.slice(0, eqIndex).trim();
      const value = line.slice(eqIndex + 1);
      result.set(key, value);
    }
  }

  return result;
}

/**
 * Find duplicate keys between base and override files.
 * Returns an array of keys that exist in both.
 */
function findDuplicateKeys(
  baseContent: string,
  overrides: Map<string, string>
): string[] {
  const baseKeys = parseEnvFile(baseContent);
  const duplicates: string[] = [];

  for (const key of overrides.keys()) {
    if (baseKeys.has(key)) {
      duplicates.push(key);
    }
  }

  return duplicates;
}

/**
 * Merge base env content with overrides.
 * Base content is kept as-is, override content is appended at the end exactly as provided.
 */
function mergeEnvFiles(baseContent: string, overrideContent: string): string {
  // Ensure base content ends with a newline before appending
  const normalizedBase = baseContent.endsWith("\n")
    ? baseContent
    : baseContent + "\n";

  return normalizedBase + "\n" + overrideContent;
}

/**
 * Get the override filename for a destination path.
 * e.g., "../ifm1" -> ".env.overrides.ifm1"
 */
function getOverrideFilename(destPath: string): string {
  const name = basename(destPath);
  return `.env.overrides.${name}`;
}

/**
 * Compare keys across all destinations and report differences.
 */
function compareDestinationKeys(
  destinationKeys: Map<string, Set<string>>
): void {
  if (destinationKeys.size < 2) {
    return;
  }

  // Build a union of all keys
  const allKeys = new Set<string>();
  for (const keys of destinationKeys.values()) {
    for (const key of keys) {
      allKeys.add(key);
    }
  }

  // Check each destination for missing keys
  const differences: Array<{ dest: string; missing: string[]; extra: string[] }> = [];

  // Use the first destination as the reference
  const entries = Array.from(destinationKeys.entries());
  const firstEntry = entries[0];
  if (!firstEntry) {
    return;
  }
  const [referenceDest, referenceKeys] = firstEntry;

  for (const [dest, keys] of entries.slice(1)) {
    const missing: string[] = [];
    const extra: string[] = [];

    // Keys in reference but not in this destination
    for (const key of referenceKeys) {
      if (!keys.has(key)) {
        missing.push(key);
      }
    }

    // Keys in this destination but not in reference
    for (const key of keys) {
      if (!referenceKeys.has(key)) {
        extra.push(key);
      }
    }

    if (missing.length > 0 || extra.length > 0) {
      differences.push({ dest, missing, extra });
    }
  }

  if (differences.length > 0) {
    const red = "\x1b[31m";
    const reset = "\x1b[0m";

    console.warn(`\n${red}[WARN] Environment variable keys differ across destinations:${reset}`);
    console.warn(`${red}       Reference: ${referenceDest} (${referenceKeys.size} keys)${reset}`);

    for (const { dest, missing, extra } of differences) {
      if (missing.length > 0) {
        console.warn(`${red}       ${dest}: missing ${missing.join(", ")}${reset}`);
      }
      if (extra.length > 0) {
        console.warn(`${red}       ${dest}: extra ${extra.join(", ")}${reset}`);
      }
    }
  }
}

/**
 * Create softlinks from source to destinations within each worktree.
 */
function createSoftlinks(
  destinations: string[],
  softlinksSource: string,
  softlinksDestinations: string[]
): { successCount: number; skipCount: number } {
  let successCount = 0;
  let skipCount = 0;

  console.log(`\nCreating softlinks...`);

  for (const dest of destinations) {
    const destPath = resolve(monorepoRoot, dest);

    if (!existsSync(destPath)) {
      skipCount++;
      continue;
    }

    // Resolve the source file path within this destination
    const sourcePath = resolve(destPath, softlinksSource);

    if (!existsSync(sourcePath)) {
      console.log(`  [SKIP] ${dest}: source file does not exist (${softlinksSource})`);
      skipCount++;
      continue;
    }

    for (const softlinkDest of softlinksDestinations) {
      const linkPath = resolve(destPath, softlinkDest);
      const linkDir = dirname(linkPath);

      // Skip if link directory doesn't exist
      if (!existsSync(linkDir)) {
        console.log(`  [SKIP] ${dest}: ${softlinkDest} (parent directory does not exist)`);
        skipCount++;
        continue;
      }

      try {
        // Calculate relative path from link location to source
        const relativePath = relative(linkDir, sourcePath);

        // Remove existing file or symlink if it exists
        if (existsSync(linkPath) || lstatSync(linkPath).isSymbolicLink()) {
          unlinkSync(linkPath);
        }

        // Create the symlink
        symlinkSync(relativePath, linkPath);
        console.log(`  [OK]   ${dest}: ${softlinkDest} -> ${relativePath}`);
        successCount++;
      } catch (error) {
        // Handle case where lstatSync throws because file doesn't exist
        if (error instanceof Error && error.message.includes("ENOENT")) {
          try {
            // Calculate relative path from link location to source
            const relativePath = relative(linkDir, sourcePath);
            symlinkSync(relativePath, linkPath);
            console.log(`  [OK]   ${dest}: ${softlinkDest} -> ${relativePath}`);
            successCount++;
          } catch (innerError) {
            const message = innerError instanceof Error ? innerError.message : String(innerError);
            console.error(`  [FAIL] ${dest}: ${softlinkDest}: ${message}`);
          }
        } else {
          const message = error instanceof Error ? error.message : String(error);
          console.error(`  [FAIL] ${dest}: ${softlinkDest}: ${message}`);
        }
      }
    }
  }

  return { successCount, skipCount };
}

function main() {
  const sourceFile = join(monorepoRoot, ".env.local.base");
  const configPath = join(monorepoRoot, "sync-env.json");

  // Validate source file exists
  if (!existsSync(sourceFile)) {
    console.error(`Source file not found: ${sourceFile}`);
    process.exit(1);
  }

  // Read and parse config
  if (!existsSync(configPath)) {
    console.error(`Config file not found: ${configPath}`);
    process.exit(1);
  }

  const configRaw = readFileSync(configPath, "utf-8");
  const configParsed = configSchema.safeParse(JSON.parse(configRaw));

  if (!configParsed.success) {
    console.error("Invalid config file:", configParsed.error.message);
    process.exit(1);
  }

  const config = configParsed.data;

  // Upfront validation: check ALL override files exist before processing any
  const missingOverrides: string[] = [];
  for (const dest of config.destinations) {
    const overrideFilename = getOverrideFilename(dest);
    const overridePath = join(monorepoRoot, overrideFilename);
    if (!existsSync(overridePath)) {
      missingOverrides.push(overrideFilename);
    }
  }

  if (missingOverrides.length > 0) {
    console.error("Missing override files:");
    for (const file of missingOverrides) {
      console.error(`  - ${file}`);
    }
    process.exit(1);
  }

  // Read base file content once
  const baseContent = readFileSync(sourceFile, "utf-8");

  console.log(`Syncing .env.local.base + overrides to ${config.destinations.length} destinations...\n`);

  let successCount = 0;
  let skipCount = 0;

  // Track keys for each destination to compare at the end
  const destinationKeys = new Map<string, Set<string>>();

  for (const dest of config.destinations) {
    const destPath = resolve(monorepoRoot, dest);
    const destFile = join(destPath, ".env.local");

    if (!existsSync(destPath)) {
      console.log(`  [SKIP] ${dest} (directory does not exist)`);
      skipCount++;
      continue;
    }

    try {
      // Read override file
      const overrideFilename = getOverrideFilename(dest);
      const overridePath = join(monorepoRoot, overrideFilename);
      const overrideContent = readFileSync(overridePath, "utf-8");

      // Check for duplicate keys and warn
      const overrides = parseEnvFile(overrideContent);
      const duplicates = findDuplicateKeys(baseContent, overrides);
      if (duplicates.length > 0) {
        // Red color warning
        const red = "\x1b[31m";
        const reset = "\x1b[0m";
        console.warn(
          `${red}  [WARN] ${dest}: Overwriting variables from .env.local.base: ${duplicates.join(", ")}${reset}`
        );
      }

      // Merge base with overrides (append override content exactly as-is)
      const mergedContent = mergeEnvFiles(baseContent, overrideContent);

      // Track the final keys for this destination
      const finalKeys = parseEnvFile(mergedContent);
      destinationKeys.set(dest, new Set(finalKeys.keys()));

      // Write merged content
      writeFileSync(destFile, mergedContent);
      console.log(`  [OK]   ${dest} (merged with ${overrideFilename})`);
      successCount++;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`  [FAIL] ${dest}: ${message}`);
    }
  }

  // Compare keys across all destinations
  compareDestinationKeys(destinationKeys);

  console.log(`\nEnv sync done! ${successCount} synced, ${skipCount} skipped.`);

  // Create softlinks
  const softlinkResult = createSoftlinks(
    config.destinations,
    config.softlinksSource,
    config.softlinksDestinations
  );

  console.log(`\nSoftlinks done! ${softlinkResult.successCount} created, ${softlinkResult.skipCount} skipped.`);
}

main();
