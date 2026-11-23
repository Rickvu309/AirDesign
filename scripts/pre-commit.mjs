import { execFileSync, spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const extensions = new Set([
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".ts",
  ".tsx",
  ".mts",
  ".cts",
  ".json",
  ".jsonc",
  ".json5",
  ".css",
  ".scss",
  ".less",
  ".html",
  ".vue",
  ".md",
  ".mdx",
  ".yaml",
  ".yml",
  ".graphql",
  ".gql",
  ".astro",
])

const gateNote = "The gate's format step checks it before any push."

export const formatStaged = (root, say = (line) => console.error(line)) => {
  const formatter = path.join(root, "node_modules", ".bin", "oxfmt")
  if (!fs.existsSync(formatter)) return
  const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" })
  const files = git("diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z")
    .split("\0")
    .filter((file) => extensions.has(path.extname(file)))
  const unstaged = new Set(git("diff", "--name-only", "-z").split("\0"))
  const whole = []
  for (const file of files) {
    if (fs.existsSync(path.join(root, file)) && fs.lstatSync(path.join(root, file)).isSymbolicLink()) continue
    if (!unstaged.has(file)) {
      whole.push(file)
      continue
    }
    const staged = git("show", `:${file}`)
    const formatted = spawnSync(formatter, ["--stdin-filepath", file], { cwd: root, input: staged, encoding: "utf8" })
    if (formatted.status !== 0 || formatted.stdout !== staged)
      say(`left ${file} as staged: it has unstaged changes. ${gateNote}`)
  }
  const formatted = []
  for (const file of whole) {
    const run = spawnSync(formatter, ["--no-error-on-unmatched-pattern", `./${file}`], { cwd: root, encoding: "utf8" })
    if (run.status === 0) formatted.push(file)
    else say(`left ${file} as staged: it does not parse yet. ${gateNote}`)
  }
  if (formatted.length > 0) git("add", "--", ...formatted)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  formatStaged(path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."))
}
