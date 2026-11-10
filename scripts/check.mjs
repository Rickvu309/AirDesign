import { spawn } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

const stages = [
  [
    ["format", "pnpm", ["exec", "oxfmt", "--check"]],
    ["lint", "pnpm", ["lint"]],
    ["actionlint", "node", ["scripts/actionlint.mjs"]],
    ["test", "pnpm", ["test:unit"]],
    ["tooling", "pnpm", ["test:tooling"]],
    ["bug-rule", "node", ["scripts/bug-rule.mjs"]],
    ["sticks", "node", ["scripts/sticks.mjs"]],
    ["specs", "pnpm", ["check:specs"]],
    ["browser", "pnpm", ["test:browser"]],
  ],
  [["typecheck", "pnpm", ["typecheck"]]],
  [
    ["boundaries", "pnpm", ["check:boundaries"]],
    ["build", "pnpm", ["build"]],
  ],
]

const showOnSuccess = new Set(["bug-rule", "sticks", "specs"])
const all = process.argv.includes("--all")
const failed = []

const run = ([name, command, args]) =>
  new Promise((resolve) => {
    const started = Date.now()
    const child = spawn(command, args, { cwd: root, env: process.env })
    let output = ""
    child.stdout.on("data", (chunk) => (output += chunk))
    child.stderr.on("data", (chunk) => (output += chunk))
    const finish = (status) => {
      const seconds = ((Date.now() - started) / 1000).toFixed(1)
      if (status !== 0) {
        process.stderr.write(`${output}fail ${name} ${seconds}s\n`)
        failed.push(name)
      } else {
        process.stdout.write(`${showOnSuccess.has(name) ? output : ""}ok ${name} ${seconds}s\n`)
      }
      resolve()
    }
    child.on("error", (error) => {
      output += `${error.message}\n`
      finish(1)
    })
    child.on("close", (status) => finish(status ?? 1))
  })

for (const stage of stages) {
  await Promise.all(stage.map(run))
  if (failed.length > 0 && !all) break
}

if (failed.length > 0) {
  console.error(`failed: ${failed.join(", ")}`)
  process.exit(1)
}
