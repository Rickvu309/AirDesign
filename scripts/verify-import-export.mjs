import { spawnSync } from "node:child_process"
for(const [command,args,cwd] of [
 ["npx",["vitest","run","apps/server/test/export-jobs.test.ts","packages/pptx/test/saved-export.test.ts","packages/render/test/static-render.test.ts"],process.cwd()],
 ["npm",["run","build:export-renderer"],process.cwd()],
 ["npx",["vite","build"],`${process.cwd()}/apps/studio`],
 ["node",["bench/import-export/browser-check.mjs"],process.cwd()],
]){const result=spawnSync(command,args,{cwd,stdio:"inherit"});if(result.status!==0)process.exit(result.status ?? 1)}
