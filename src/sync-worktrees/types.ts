import { z } from "zod";

const folderPathSchema = z.string().refine(
  (path) => path.startsWith("../"),
  {
    message: 'Folder path must start with "../" to indicate a sibling directory',
  }
);

export const configSchema = z.object({
  template: z.string(),
  inputFilesToFolders: z.record(z.string(), folderPathSchema),
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
