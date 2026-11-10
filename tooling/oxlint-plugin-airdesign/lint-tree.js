import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { rawExtensions, rawFindings } from "./rules/no-raw.js"
import { scanSource, scannedExtensions } from "./scan-comments.js"
import { glossaryFindings, nameFindings, wordExtensions, wordFindings } from "./scan-names.js"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const lintPaths = ["apps", "packages", "scripts", "tests", "tooling", "playwright.config.ts", "vitest.config.mts"]
const wordPaths = ["AGENTS.md", ".github", "specs", "metrics.json", "package.json"]
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

const hits = glossaryFindings(new Date().toISOString().slice(0, 10))
for (const relativePath of [...lintPaths, ...wordPaths]) {
  const wordsOnly = wordPaths.includes(relativePath)
  for (const file of filesUnder(path.resolve(root, relativePath))) {
    const relative = path.relative(root, file).split(path.sep).join("/")
    hits.push(...nameFindings(relative))
    const extension = path.extname(file).toLowerCase()
    const comment = !wordsOnly && scannedExtensions.has(extension)
    const raw = !wordsOnly && rawExtensions.has(extension)
    const words = scannedExtensions.has(extension) || rawExtensions.has(extension) || wordExtensions.has(extension)
    if (!words) continue
    const source = fs.readFileSync(file, "utf8")
    hits.push(...wordFindings(relative, source))
    if (comment) hits.push(...(await scanSource(relative, source)))
    if (raw) {
      for (const finding of rawFindings(relative, source)) {
        hits.push(`${relative}:${finding.line}: ${finding.message}`)
      }
    }
  }
}

for (const item of hits) console.error(item)
if ((oxlint.status ?? 1) !== 0) process.exit(oxlint.status ?? 1)
if (hits.length > 0) process.exit(1)
