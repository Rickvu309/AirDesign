import { spawnSync } from "node:child_process"
import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import YAML from "yaml"
import { knowsMain } from "./checked.mjs"

const skip = new Set(["node_modules", "dist", ".git"])

export const todoEntries = (parsed) => {
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return 0
  let count = 0
  for (const targets of Object.values(parsed)) {
    if (targets === null || typeof targets !== "object" || Array.isArray(targets)) continue
    for (const listed of Object.values(targets)) {
      const rules = Array.isArray(listed?.violations) ? listed.violations.length : 0
      const files = Array.isArray(listed?.files) ? listed.files.length : 0
      count += rules * files
    }
  }
  return count
}

const todoFiles = (directory) => {
  const found = []
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (skip.has(entry.name)) continue
    const full = path.join(directory, entry.name)
    if (entry.isDirectory()) found.push(...todoFiles(full))
    else if (entry.name === "pack_todo.yml") found.push(full)
  }
  return found
}

export const todoCount = (root) =>
  todoFiles(root).reduce((sum, file) => sum + todoEntries(YAML.parse(readFileSync(file, "utf8"))), 0)

export const readCeiling = (text) => {
  const raw = YAML.parse(text) ?? {}
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) throw new Error("packwerk.yml must hold a mapping")
  const value = raw.todo_ceiling
  if (value === undefined) return undefined
  if (!Number.isInteger(value) || value < 0) throw new Error("packwerk.yml todo_ceiling must be a whole number")
  return value
}

export const ceilingFault = ({ count, ceiling, mainCeiling }) => {
  if (ceiling === undefined) return "packwerk.yml needs todo_ceiling, the number of pack_todo.yml entries"
  if (ceiling !== count) return `todo_ceiling is ${ceiling} but pack_todo.yml lists ${count}`
  if (mainCeiling !== undefined && ceiling > mainCeiling)
    return `todo_ceiling ${ceiling} is above origin/main (${mainCeiling}); the baseline only shrinks`
  return undefined
}

export const mainCeiling = (root) => {
  if (!knowsMain(root)) return { missing: true }
  const shown = spawnSync("git", ["show", "origin/main:packwerk.yml"], { cwd: root, encoding: "utf8" })
  if (shown.status !== 0) return { missing: true }
  return { ceiling: readCeiling(shown.stdout) }
}

const run = () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
  const main = mainCeiling(root)
  if (main.missing) {
    console.error("origin/main is missing, so the pack_todo baseline cannot be compared")
    return 1
  }
  const count = todoCount(root)
  const fault = ceilingFault({
    count,
    ceiling: readCeiling(readFileSync(path.join(root, "packwerk.yml"), "utf8")),
    mainCeiling: main.ceiling,
  })
  if (fault !== undefined) {
    console.error(fault)
    return 1
  }
  console.log(
    main.ceiling === undefined
      ? `todo_ceiling ${String(count)} (no ceiling on origin/main yet)`
      : `todo_ceiling ${String(count)}, origin/main allows ${String(main.ceiling)}`,
  )
  return 0
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = run()
}
