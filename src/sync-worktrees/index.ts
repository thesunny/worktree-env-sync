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

export function syncEnvFiles(base: string, config: Config): void {
  for (const [sourceFile, targetFolder] of Object.entries(config.targetFolders)) {
    const sourcePath = join(base, sourceFile);
    const destPath = join(base, targetFolder, config.outputPath);

    const content = readFileSync(sourcePath, "utf-8");
    const parsed = dotenvx.parse(content);
    const serialized = serializeEnv(parsed);

    mkdirSync(dirname(destPath), { recursive: true });
    writeFileSync(destPath, serialized);
  }
}

export function syncWorktrees(base: string, configPath: string): void {
  const config = readConfig(base, configPath);
  syncEnvFiles(base, config);
}
