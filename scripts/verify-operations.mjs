import { spawnSync } from "node:child_process"
const result = spawnSync("npx", ["vitest", "run", "apps/worker/test/operations.test.ts"], { stdio: "inherit" })
process.exit(result.status ?? 1)
