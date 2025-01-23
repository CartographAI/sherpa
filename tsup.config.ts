import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "server/src/index.ts",
  },
  sourcemap: true,
  clean: true,
  publicDir: "web/dist/",
  format: ["cjs"],
});
