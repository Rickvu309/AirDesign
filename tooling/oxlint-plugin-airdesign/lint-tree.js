import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { scanSource, scannedExtensions } from "./scan-comments.js"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const lintPaths = ["apps", "packages", "scripts", "tests", "tooling", "playwright.config.ts", "vitest.config.mts"]
const skipDirectories = new Set(["node_modules", "dist"])

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

const filesUnder = (absolute) => {
  const info = fs.statSync(absolute, { throwIfNoEntry: false })
  if (!info || skipDirectories.has(path.basename(absolute))) return []
  if (!info.isDirectory()) return info.isFile() ? [absolute] : []
  return fs.readdirSync(absolute).flatMap((name) => filesUnder(path.join(absolute, name)))
}

const hits = []
for (const relativePath of lintPaths) {
  for (const file of filesUnder(path.resolve(root, relativePath))) {
    if (!scannedExtensions.has(path.extname(file).toLowerCase())) continue
    const relative = path.relative(root, file).split(path.sep).join("/")
    hits.push(...(await scanSource(relative, fs.readFileSync(file, "utf8"))))
  }
}

for (const item of hits) console.error(item)
if ((oxlint.status ?? 1) !== 0) process.exit(oxlint.status ?? 1)
if (hits.length > 0) process.exit(1)
