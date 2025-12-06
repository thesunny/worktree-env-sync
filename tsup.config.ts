// tsup.config.ts
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.tsx"], // or .ts if no React
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
});
