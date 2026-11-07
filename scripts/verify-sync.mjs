import { spawnSync } from "node:child_process"
for (const [command,args,cwd] of [
  ["npx",["vitest","run","packages/rpc/test"],process.cwd()],
  ["node",["bench/sync/shared-outbox-check.mjs"],process.cwd()],
  ["node",["bench/sync/execution-identity-check.mjs"],process.cwd()],
  ["node",["bench/sync/browser-check.mjs"],process.cwd()],
  ["node",["bench/render/input-history-check.mjs"],process.cwd()],
]) {
  const result=spawnSync(command,args,{cwd,stdio:"inherit"})
  if(result.status!==0)process.exit(result.status ?? 1)
}
