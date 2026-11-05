import { spawnSync } from "node:child_process"
for(const [command,args,cwd] of [
 ["npx",["vitest","run","apps/server/test/deck-catalog.test.ts","apps/studio/src/editor/editor-model.test.ts","packages/rpc/test/reconnect.test.ts","apps/server/test/history-store.test.ts"],process.cwd()],
 ["npx",["vite","build"],`${process.cwd()}/apps/studio`],
 ["node",["bench/studio/browser-check.mjs"],process.cwd()],
]){const result=spawnSync(command,args,{cwd,stdio:"inherit"});if(result.status!==0)process.exit(result.status ?? 1)}
