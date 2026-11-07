import path from "node:path"
import { MeasuredSequencer } from "./scripts/gate/unit-sharding.ts"
import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    alias: {
      "@airdesign/ui": path.resolve("packages/ui/src/index.ts"),
      "@airdesign/access/client": path.resolve("packages/access/src/client/index.ts"),
    },
  },
  test: {
    sequence: { sequencer: MeasuredSequencer },
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
            "packages/**/*.{test,spec}.{ts,mts,cts,js,mjs,cjs}",
            "apps/**/*.{test,spec}.{ts,mts,cts,js,mjs,cjs}",
          ],
        },
      },
      {
        test: {
          name: "dom",
          environment: "happy-dom",
          setupFiles: ["packages/ui/test/react-act.ts"],
          include: ["packages/**/*.{test,spec}.{tsx,jsx}", "apps/**/*.{test,spec}.{tsx,jsx}"],
        },
      },
    ],
  },
})
