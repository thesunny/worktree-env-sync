/**
 * Serializes an env object to a string with quoted values.
 * Output format: KEY="value" on each line.
 */
export function serializeEnv(env: Record<string, string>): string {
  return Object.entries(env)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => {
      const escaped = value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      return `${key}="${escaped}"`;
    })
    .join("\n");
}
