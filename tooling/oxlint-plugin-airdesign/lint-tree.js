import { spawnSync } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const scanner = path.join(path.dirname(fileURLToPath(import.meta.url)), "scan-comments.js")

const lintPaths = ["apps", "packages", "scripts", "tests", "tooling", "playwright.config.ts", "vitest.config.mts"]

const oxlint = spawnSync(
  "pnpm",
  ["exec", "oxlint", "--config", "tooling/oxlint-plugin-airdesign/oxlintrc.json", ...lintPaths],
  { cwd: root, encoding: "utf8", env: process.env },
)

if (oxlint.stdout) process.stdout.write(oxlint.stdout)
if (oxlint.stderr) process.stderr.write(oxlint.stderr)
if (oxlint.error) {
  console.error(oxlint.error.message)
  process.exit(1)
}

const scan = spawnSync(process.execPath, [scanner, ...lintPaths], {
  cwd: root,
  encoding: "utf8",
  env: process.env,
})

if (scan.stdout) process.stdout.write(scan.stdout)
if (scan.stderr) process.stderr.write(scan.stderr)
if (scan.error) {
  console.error(scan.error.message)
  process.exit(1)
}

if ((oxlint.status ?? 1) !== 0) process.exit(oxlint.status ?? 1)
process.exit(scan.status ?? 1)
