import { spawnSync } from "node:child_process"
const result = spawnSync("npx", ["vitest", "run", "packages/change-log/test", "apps/server/test/history-store.test.ts", "apps/server/test/history-postgres.test.ts", "apps/server/test/commands-authenticated.test.ts"], { stdio: "inherit" })
process.exit(result.status ?? 1)
