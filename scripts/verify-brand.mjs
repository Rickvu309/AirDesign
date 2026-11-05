import { spawnSync } from "node:child_process"
const result = spawnSync("npx",["vitest","run","packages/brand/test","apps/server/test/template-application.test.ts"],{stdio:"inherit"})
process.exit(result.status ?? 1)
