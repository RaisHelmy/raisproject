import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: { globals: true, include: ["test/**/*.test.ts"], environment: "node" },
  resolve: { alias: { "@rais/shared-types": path.resolve(__dirname, "../../packages/shared-types/src/index.ts") } },
});
