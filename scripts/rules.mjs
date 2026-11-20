import { execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

export const ruleFileSuffix = ".rule.md"

export const readRule = (source) => {
  const [first, ...rest] = source.trim().split("\n")
  const rule = first.startsWith("# ") ? first.slice(2).trim() : ""
  const heldBy = rest.join(" ").replace(/\s+/g, " ").trim()
  return rule !== "" && heldBy !== "" ? { rule, heldBy } : undefined
}

export const ruleFiles = (root) =>
  execFileSync(
    "git",
    ["-C", root, "ls-files", "--cached", "--others", "--exclude-standard", "-z", `*${ruleFileSuffix}`],
    {
      encoding: "utf8",
    },
  )
    .split("\0")
    .filter((file) => file !== "" && fs.existsSync(path.join(root, file)))
    .toSorted()

export const rules = (root) =>
  ruleFiles(root).map((file) => ({ file, ...readRule(fs.readFileSync(path.join(root, file), "utf8")) }))

export const ruleTable = (entries) => [
  "| Rule | Enforced by | File |",
  "| --- | --- | --- |",
  ...entries.map(({ rule, heldBy, file }) => `| ${rule} | ${heldBy} | \`${file}\` |`),
]

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
  const word = process.argv[2]?.toLowerCase()
  const entries = rules(root).filter(
    (entry) => word === undefined || `${entry.rule} ${entry.heldBy} ${entry.file}`.toLowerCase().includes(word),
  )
  console.log(ruleTable(entries).join("\n"))
}
