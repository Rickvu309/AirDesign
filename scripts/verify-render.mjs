import { spawnSync } from "node:child_process"
for (const [command, args, cwd] of [
  ["npx", ["vitest", "run", "packages/render/test"], process.cwd()],
  ["npx", ["vite", "build"], `${process.cwd()}/apps/studio`],
  ["node", ["bench/render/browser-check.mjs"], process.cwd()],
  ["node", ["bench/render/editing-check.mjs"], process.cwd()],
]) {
  const result = spawnSync(command, args, { cwd, stdio: "inherit" })
  if (result.status !== 0) process.exit(result.status ?? 1)
}
