import { spawnSync } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

const steps = [
  ["format", "pnpm", ["exec", "oxfmt", "--check"]],
  ["lint", "pnpm", ["lint"]],
  ["actionlint", "node", ["scripts/actionlint.mjs"]],
  ["typecheck", "pnpm", ["typecheck"]],
  ["boundaries", "pnpm", ["check:boundaries"]],
  ["bug-rule", "node", ["scripts/bug-rule.mjs"]],
  ["specs", "pnpm", ["check:specs"]],
  ["test", "pnpm", ["test"]],
  ["browser", "pnpm", ["test:browser"]],
  ["build", "pnpm", ["build"]],
]

const showOnSuccess = new Set(["bug-rule", "specs"])

for (const [name, command, args] of steps) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    env: process.env,
  })
  if (result.status !== 0) {
    if (result.stdout) {
      process.stdout.write(result.stdout)
    }
    if (result.stderr) {
      process.stderr.write(result.stderr)
    }
    console.error(`fail ${name}`)
    process.exit(result.status ?? 1)
  }
  if (showOnSuccess.has(name) && result.stdout) process.stdout.write(result.stdout)
  console.log(`ok ${name}`)
}
