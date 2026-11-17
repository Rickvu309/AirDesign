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

export const formatStaged = (root) => {
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
      whole.push(`./${file}`)
      continue
    }
    const staged = git("show", `:${file}`)
    const formatted = spawnSync(formatter, ["--stdin-filepath", file], { cwd: root, input: staged, encoding: "utf8" })
    if (formatted.status !== 0) throw new Error(formatted.stderr || `Could not format ${file}`)
    if (formatted.stdout !== staged) {
      throw new Error(
        `commit refused: ${file} is not formatted and has unstaged changes. Run pnpm exec oxfmt ${file}, stage it, and commit again.`,
      )
    }
  }
  if (whole.length > 0) {
    execFileSync("pnpm", ["exec", "oxfmt", "--no-error-on-unmatched-pattern", ...whole], {
      cwd: root,
      stdio: "inherit",
    })
    git("add", "--", ...whole)
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    formatStaged(path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."))
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
