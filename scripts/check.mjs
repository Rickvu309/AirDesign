import { spawnSync } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

const steps = [
  ["format", "pnpm", ["exec", "oxfmt", "--check"]],
  ["lint", "pnpm", ["lint"]],
  ["actionlint", "node", ["scripts/actionlint.mjs"]],
  ["test", "pnpm", ["test"]],
  ["typecheck", "pnpm", ["typecheck"]],
  ["boundaries", "pnpm", ["check:boundaries"]],
  ["bug-rule", "node", ["scripts/bug-rule.mjs"]],
  ["specs", "pnpm", ["check:specs"]],
  ["browser", "pnpm", ["test:browser"]],
  ["build", "pnpm", ["build"]],
]

const showOnSuccess = new Set(["bug-rule", "specs"])
const all = process.argv.includes("--all")
const failed = []

for (const [name, command, args] of steps) {
  const started = Date.now()
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    env: process.env,
  })
  const seconds = ((Date.now() - started) / 1000).toFixed(1)
  if (result.status !== 0) {
    if (result.stdout) {
      process.stdout.write(result.stdout)
    }
    if (result.stderr) {
      process.stderr.write(result.stderr)
    }
    console.error(`fail ${name} ${seconds}s`)
    if (!all) process.exit(result.status ?? 1)
    failed.push(name)
    continue
  }
  if (showOnSuccess.has(name) && result.stdout) process.stdout.write(result.stdout)
  console.log(`ok ${name} ${seconds}s`)
}

if (failed.length > 0) {
  console.error(`failed: ${failed.join(", ")}`)
  process.exit(1)
}
