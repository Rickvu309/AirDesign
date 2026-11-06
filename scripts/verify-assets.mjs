import { spawnSync } from "node:child_process"
const result=spawnSync("npx",["vitest","run","packages/files/test/assets.test.ts","apps/server/test/image-assets.test.ts","apps/studio/src/images","apps/worker/test/image-mode.test.ts"],{stdio:"inherit"})
process.exit(result.status ?? 1)
