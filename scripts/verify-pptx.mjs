import { spawnSync } from "node:child_process"
const result = spawnSync("npx", ["vitest", "run", "packages/pptx/test/roundtrip.test.ts"], { stdio: "inherit" })
process.exit(result.status ?? 1)
