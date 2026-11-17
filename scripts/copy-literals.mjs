import { execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { parseSync } from "oxc-parser"

const walk = (node, visit, names = []) => {
  if (!node || typeof node !== "object") return
  const next =
    node.type === "VariableDeclarator" && node.id.type === "Identifier"
      ? [...names, node.id.name]
      : node.type === "FunctionDeclaration" && node.id
        ? [...names, node.id.name]
        : node.type === "Property" && !node.computed
          ? [...names, node.key.name ?? node.key.value]
          : names
  visit(node, next)
  for (const [key, value] of Object.entries(node)) {
    if (key === "key") continue
    if (Array.isArray(value)) value.forEach((child) => walk(child, visit, next))
    else if (value && typeof value === "object") walk(value, visit, next)
  }
}

const valueOf = (node) =>
  node.type === "Literal" && typeof node.value === "string"
    ? node.value
    : node.type === "TemplateLiteral"
      ? node.quasis[0].value.cooked
      : undefined

export const literals = (file, source) => {
  const parsed = parseSync(file, source)
  if (parsed.errors.length) throw new Error(`Cannot scan ${file}: ${parsed.errors[0].message}`)
  const found = []
  const keys = new Set()
  walk(parsed.program, (node) => {
    if (
      node.type === "CallExpression" &&
      node.callee.type === "MemberExpression" &&
      !node.callee.computed &&
      node.callee.property.name === "press"
    )
      keys.add(node.arguments[0])
    if (keys.has(node)) return
    const value = valueOf(node)
    if (value) found.push({ value, start: node.start, end: node.end })
  })
  return found
}

export const copyWords = (file, source) => {
  const words = new Map()
  for (const statement of parseSync(file, source).program.body) {
    if (statement.type !== "ExportNamedDeclaration") continue
    walk(statement.declaration, (node, names) => {
      const value = valueOf(node)
      if (value && names.length) words.set(value, { file, export: names.join(".") })
    })
  }
  return words
}

const tested = (file) =>
  /^(?:tests\/(?:browser|journeys)\/|\.agents\/skills\/verify-airdesign\/(?:journeys\/|look\/states\/)).*\.[cm]?[jt]sx?$/.test(
    file,
  )
const counts = (items) => {
  const result = new Map()
  for (const { value } of items) result.set(value, (result.get(value) ?? 0) + 1)
  return result
}

export const literalFaults = (file, before, after, words) => {
  if (!tested(file)) return []
  const remaining = counts(literals(file, before))
  return literals(file, after).flatMap(({ value, start }) => {
    const kept = remaining.get(value) ?? 0
    remaining.set(value, kept - 1)
    const owner = words.get(value)
    if (kept > 0 || !owner) return []
    return [
      `${file}:${after.slice(0, start).split("\n").length}: ${JSON.stringify(value)} is product copy. Import ${owner.export} from ${owner.file}, so the test follows a change of words.`,
    ]
  })
}

const git = (root, args) => execFileSync("git", args, { cwd: root, encoding: "utf8", maxBuffer: 20 * 1024 * 1024 })
const at = (root, tree, file) => {
  const exists = git(root, ["ls-tree", tree, "--", file]).trim()
  return exists ? git(root, ["show", `${tree}:${file}`]) : ""
}

export const scanCopyLiterals = (root) => {
  const base = git(root, ["merge-base", "HEAD", "origin/main"]).trim()
  const files = git(root, ["ls-files", "--cached", "--others", "--exclude-standard", "-z"]).split("\0").filter(Boolean)
  const copy = files.filter(
    (file) => /^apps\/web\/src\/copy\/.*\.ts$/.test(file) && fs.existsSync(path.join(root, file)),
  )
  const words = new Map()
  for (const file of copy) {
    for (const [value, owner] of copyWords(file, at(root, base, file))) words.set(value, owner)
    for (const [value, owner] of copyWords(file, fs.readFileSync(path.join(root, file), "utf8")))
      words.set(value, owner)
  }
  let existing = 0
  const faults = []
  for (const file of files.filter(tested)) {
    if (!fs.existsSync(path.join(root, file))) continue
    const before = at(root, base, file)
    const after = fs.readFileSync(path.join(root, file), "utf8")
    existing += literals(file, after).filter(({ value }) => words.has(value)).length
    faults.push(...literalFaults(file, before, after, words))
  }
  return { existing, faults }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
  const { existing, faults } = scanCopyLiterals(root)
  console.log(`Product copy literals in tests: ${existing} (existing counted; additions refused)`)
  for (const fault of faults) console.error(fault)
  if (faults.length) process.exitCode = 1
}
