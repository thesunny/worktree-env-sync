import { mkdirSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { type GeneratedFile } from "./types.js";

/**
 * Writes generated env files to disk.
 */
export function writeEnvFiles(base: string, envFiles: GeneratedFile[]): void {
  for (const { path, content } of envFiles) {
    const fullPath = join(base, path);
    mkdirSync(dirname(fullPath), { recursive: true });
    writeFileSync(fullPath, content);
  }
}

/**
 * Creates symlinks for env files.
 */
export function writeSymlinks(base: string, envLinks: Map<string, string[]>): void {
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
