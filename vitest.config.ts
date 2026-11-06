import path from "node:path"
import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    alias: {
      "@airdesign/ui": path.resolve("packages/ui/src/index.ts"),
      "@airdesign/access/client": path.resolve("packages/access/src/client/index.ts"),
    },
  },
  test: {
    maxWorkers: Number(process.env.VITEST_MAX_WORKERS ?? 2),
    projects: [
      {
        test: {
          name: "node",
          environment: "node",
          testTimeout: 20_000,
          include: [
            "tests/**/*.test.ts",
            "bench/**/*.test.ts",
            "packages/**/*.test.ts",
            "apps/**/*.test.ts",
            "packages/ui/test/**/*.test.mjs",
          ],
        },
      },
      {
        test: {
          name: "dom",
          environment: "happy-dom",
          setupFiles: ["packages/ui/test/react-act.ts"],
          include: ["packages/ui/**/*.test.tsx", "apps/studio/**/*.test.tsx"],
        },
      },
    ],
  },
})
