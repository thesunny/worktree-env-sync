import { z } from "zod";

export const configSchema = z.object({
  template: z.string(),
  outputPath: z.string(),
  targetFolders: z.record(z.string(), z.string()),
  softLinks: z.array(z.string()),
});

export type Config = z.infer<typeof configSchema>;

export interface GeneratedFile {
  path: string;
  content: string;
}
