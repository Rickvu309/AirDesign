import { spawnSync } from "node:child_process"
for(const [command,args,cwd] of [
 ["npx",["vitest","run","apps/server/test/deck-catalog.test.ts","apps/server/test/p05-fix1.test.ts","apps/studio/src/editor/p05-fix1.test.tsx","apps/studio/src/decks/workspace.test.tsx","apps/studio/src/sync/transport.test.tsx","apps/studio/src/import/import-card.test.tsx","tests/lint/editor-stacking.test.ts","packages/rpc/test/snapshot-delta.test.ts","apps/studio/src/editor/editor-model.test.ts","packages/rpc/test/reconnect.test.ts","apps/server/test/history-store.test.ts"],process.cwd()],
 ["node",["bench/studio/browser-check.mjs"],process.cwd()],
]){const result=spawnSync(command,args,{cwd,stdio:"inherit"});if(result.status!==0)process.exit(result.status ?? 1)}
