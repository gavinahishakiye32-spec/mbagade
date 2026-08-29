import { defineConfig } from "vitest/config";

export default defineConfig({
  configLoader: "bundle",
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: [
        "src/services/feed-scoring.ts",
        "src/services/feed.service.ts",
        "src/services/growth.service.ts",
        "src/services/offer.service.ts",
        "src/lib/permissions.ts",
        "src/lib/rate-limit.ts",
        "src/lib/utils.ts",
      ],
      exclude: [],
    },
  },
  resolve: {
    alias: {
      "@": `${import.meta.dirname}/src`,
    },
  },
});
