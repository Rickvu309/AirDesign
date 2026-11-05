import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "node",
          environment: "node",
          include: [
            "tests/**/*.test.ts",
            "packages/access/**/*.test.ts",
            "packages/contract-rules/**/*.test.ts",
            "packages/ui/test/**/*.test.mjs",
          ],
        },
      },
      {
        test: {
          name: "dom",
          environment: "happy-dom",
          include: ["packages/ui/**/*.test.tsx", "apps/studio/**/*.test.tsx"],
        },
      },
    ],
  },
})
