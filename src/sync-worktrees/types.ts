import { z } from "zod";

export const configSchema = z.object({
  template: z.string(),
  inputFilesToFolders: z.record(z.string(), z.string()),
  outputFile: z.string(),
  symlinksToOuputFile: z.array(z.string()),
});

export type Config = z.infer<typeof configSchema>;

export interface GeneratedFile {
  path: string;
  content: string;
}

export interface Context {
  base: string;
  config: Config;
  fileContentsMap: Map<string, string>;
}
