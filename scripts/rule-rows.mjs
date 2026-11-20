import { execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { workingTree } from "./checked.mjs"
import { ruleFileSuffix } from "./rules.mjs"

const tableHeader = /^\|\s*Rule\s*\|\s*Enforced by\s*\|/
const separator = /^\|\s*:?-/

export const ruleRows = (source) => {
  const rows = []
  let inTable = false
  source.split("\n").forEach((text, index) => {
    if (tableHeader.test(text)) {
      inTable = true
      return
    }
    if (!text.startsWith("|")) {
      inTable = false
      return
    }
    if (!inTable || separator.test(text)) return
    const [rule, ...heldBy] = text
      .replace(/^\|\s*/, "")
      .replace(/\s*\|\s*$/, "")
      .split(/\s+\|\s+/)
    rows.push({ line: index + 1, text, rule, heldBy: heldBy.join(" | ") })
  })
  return rows
}

const reviewOnly = (heldBy) => /^review\b/.test(heldBy)

const scriptOf = (token, commands) => {
  const command = commands[/^pnpm ([\w:-]+)$/.exec(token)?.[1] ?? ""] ?? ""
  return command.match(/scripts\/[\w./-]+\.m?js/g)?.at(-1)
}

export const ruleFileFor = (heldBy, tracked, commands = {}) => {
  for (const [, token] of heldBy.matchAll(/`([^`]+)`/g)) {
    const file = scriptOf(token, commands) ?? tracked.find((each) => each === token || each.endsWith(`/${token}`))
    if (file === undefined) continue
    const name = path.posix.basename(file).replace(/(?:\.(?:test|spec))?\.[^.]+$/, "")
    return path.posix.join(path.posix.dirname(file), `${name}${ruleFileSuffix}`)
  }
  return `<name>${ruleFileSuffix} beside the check that holds it`
}

export const ruleRowFaults = ({ file, before, after }, tracked, commands) => {
  const kept = new Set(ruleRows(before).map((row) => row.text))
  return ruleRows(after)
    .filter((row) => !kept.has(row.text) && !reviewOnly(row.heldBy))
    .map(
      (row) =>
        `${file}:${row.line}: "${row.rule}" is held by a check, so its row does not go in a shared table. Put it in ${ruleFileFor(row.heldBy, tracked, commands)}: a "# <rule>" line, then what holds it. Only a rule review holds stays in CHECKS.md, and its "Enforced by" starts with review. \`pnpm rules\` lists every rule file.`,
    )
}

const git = (root, args) =>
  execFileSync("git", ["-C", root, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })

const contentAt = (root, tree, file) => {
  try {
    return git(root, ["show", `${tree}:${file}`])
  } catch {
    return ""
  }
}

export const changedTables = (root) => {
  let fork
  try {
    fork = git(root, ["merge-base", "HEAD", "origin/main"]).trim()
  } catch {
    return []
  }
  const head = workingTree(root)
  return git(root, ["diff", "--name-only", "-z", "--diff-filter=AM", fork, head, "--", "*.md"])
    .split("\0")
    .filter((file) => file !== "" && !file.endsWith(ruleFileSuffix))
    .map((file) => ({ file, before: contentAt(root, fork, file), after: contentAt(root, head, file) }))
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(process.argv[2] ?? path.join(path.dirname(fileURLToPath(import.meta.url)), ".."))
  const tracked = git(root, ["ls-files", "-z"]).split("\0")
  const commands = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).scripts
  const faults = changedTables(root).flatMap((table) => ruleRowFaults(table, tracked, commands))
  for (const fault of faults) console.error(fault)
  if (faults.length > 0) process.exit(1)
}
