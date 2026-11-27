import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { parseSync } from "oxc-parser"

export const ceilingFile = "scripts/doom-never-knows.json"

const formulaFiles = /^preset-[a-z-]+\.ts$/
const supportFiles = /(?:\.test\.ts|^sample-deck\.ts|^testing\/.*)$/
const hostWords = /(?:^|[^a-z])(?:agent|mcp|tool|answer|prompt|hint)|(?:Agent|Mcp|MCP|Tool|Answer|Prompt|Hint)/
const wholeFontFamilies = new Set(["Archivo Black", "Love Light", "Shadows Into Light"])
const kindOrder = ["taste", "host", "words"]
const weightNames = new Set([
  "Thin",
  "ExtraLight",
  "Light",
  "Regular",
  "Medium",
  "SemiBold",
  "Bold",
  "ExtraBold",
  "Black",
  "Italic",
])

const walk = (node, visit, parent) => {
  if (!node || typeof node !== "object") return
  visit(node, parent)
  for (const value of Object.values(node))
    if (Array.isArray(value)) value.forEach((child) => walk(child, visit, node))
    else if (value && typeof value === "object") walk(value, visit, node)
}

const textOf = (node) =>
  node.type === "Literal" && typeof node.value === "string"
    ? node.value
    : node.type === "TemplateLiteral"
      ? node.quasis.map((quasi) => quasi.value.cooked).join("${}")
      : undefined

const wordsIn = (text) => text.match(/(?<![\w#$-])[A-Za-z]{2,}(?![\w-])/g) ?? []
const isProse = (text) => {
  const words = wordsIn(text)
  return words.length >= 3 && words.some((word) => word.length >= 4)
}
const isTitleWord = (text) => /^[A-Z][a-z]+(?: [a-z]+)*$/.test(text) && !weightNames.has(text) && !(text in globalThis)
const styleRule = (node) => {
  if (node.type !== "BinaryExpression" || !/^[!=]==?$/.test(node.operator)) return undefined
  const sides = [node.left, node.right]
  const named = sides.some(
    (side) => side.type === "MemberExpression" && !side.computed && side.property.name === "style",
  )
  const style = sides.find((side) => side.type === "Literal" && typeof side.value === "string")
  return named ? style?.value : undefined
}
const thrown = (node) =>
  node?.type === "NewExpression" && node.callee.type === "Identifier" && /Error$/.test(node.callee.name)

export function offences(file, source) {
  const found = []
  const line = (at) => source.slice(0, at).split("\n").length
  const add = (kind, at, what) => found.push({ file, line: line(at), kind, what })
  if (hostWords.test(path.basename(file, ".ts"))) add("host", 0, `file ${file}`)
  const parsed = parseSync(file, source)
  if (parsed.errors.length) throw new Error(`Cannot scan ${file}: ${parsed.errors[0].message}`)
  walk(parsed.program, (node, parent) => {
    if (parent?.type === "ImportDeclaration" || (parent?.type === "ExportNamedDeclaration" && parent.source === node))
      return
    if (node.type === "ExportNamedDeclaration" && node.declaration) {
      const declared = node.declaration.declarations?.map((each) => each.id.name) ?? [node.declaration.id?.name]
      for (const name of declared) if (name && hostWords.test(name)) add("host", node.start, `export ${name}`)
    }
    if (node.type === "ExportNamedDeclaration" && !node.declaration)
      for (const spec of node.specifiers)
        if (hostWords.test(spec.exported.name)) add("host", node.start, `export ${spec.exported.name}`)
    if ((node.type === "TSPropertySignature" || node.type === "Property") && node.key?.name === "note")
      add("host", node.start, "a note for a reader")
    if (
      node.type === "VariableDeclarator" &&
      node.id.type === "Identifier" &&
      /Share$/.test(node.id.name) &&
      parent?.kind === "const"
    )
      if (node.init && (node.init.type === "Literal" || node.init.type === "BinaryExpression"))
        add("taste", node.start, `${node.id.name}, a share of the slide`)
    const style = styleRule(node)
    if (style !== undefined) add("taste", node.start, `a rule for "${style}" text`)
    const text = textOf(node)
    if (
      text === undefined ||
      formulaFiles.test(path.basename(file)) ||
      thrown(parent) ||
      (file === "painted-face.ts" && wholeFontFamilies.has(text))
    )
      return
    if (/^#[0-9a-fA-F]{6}$/.test(text)) add("taste", node.start, `colour ${text}`)
    else if (isProse(text))
      add("words", node.start, (text.length > 70 ? `${text.slice(0, 67)}...` : text).replace(/\n/g, "\\n"))
    else if (isTitleWord(text)) add("taste", node.start, `"${text}"`)
  })
  return found
}

export function doomOffences(root) {
  const src = path.join(root, "packages/doom/src")
  const files = fs
    .readdirSync(src, { recursive: true })
    .map((file) => String(file).replaceAll("\\", "/"))
    .toSorted()
  const found = files
    .filter((file) => /\.json$/.test(file) && !supportFiles.test(file))
    .map((file) => ({ file, line: 1, kind: "taste", what: "a data file of design values" }))
  for (const file of files.filter((file) => file.endsWith(".ts") && !supportFiles.test(file)))
    found.push(...offences(file, fs.readFileSync(path.join(src, file), "utf8")))
  return found
}

export function countsByFile(found) {
  const counts = new Map()
  for (const each of found) counts.set(each.file, (counts.get(each.file) ?? 0) + 1)
  return Object.fromEntries([...counts.entries()].toSorted(([left], [right]) => left.localeCompare(right)))
}

export function readCeiling(text) {
  const parsed = JSON.parse(text)
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed))
    throw new Error(`${ceilingFile} must hold a JSON object`)
  for (const [file, value] of Object.entries(parsed))
    if (!Number.isInteger(value) || value <= 0)
      throw new Error(`${ceilingFile}: ${file} must map to a positive integer`)
  return parsed
}

export function baseCeiling(root) {
  const base = spawnSync("git", ["-C", root, "merge-base", "HEAD", "origin/main"], { encoding: "utf8" })
  if (base.status !== 0) return { missing: true }
  const commit = base.stdout.trim()
  const present = spawnSync("git", ["-C", root, "cat-file", "-e", `${commit}:${ceilingFile}`], { encoding: "utf8" })
  if (present.status !== 0) return { ceiling: undefined }
  const shown = spawnSync("git", ["-C", root, "show", `${commit}:${ceilingFile}`], { encoding: "utf8" })
  if (shown.status !== 0) return { missing: true }
  return { ceiling: readCeiling(shown.stdout) }
}

const plural = (count, singular, many) => `${count} ${count === 1 ? singular : many}`

export function ceilingFaults({ found, ceiling, base }) {
  const counts = countsByFile(found)
  const files = [...new Set([...Object.keys(counts), ...Object.keys(ceiling)])].toSorted()
  const faults = []
  const exceeded = []
  for (const file of files) {
    const actual = counts[file] ?? 0
    const allowed = ceiling[file] ?? 0
    const was = base?.[file] ?? 0
    if (base !== undefined && allowed > was)
      faults.push(
        `packages/doom/src/${file}: ceiling ${allowed} is above origin/main (${was}); the ceiling may only shrink.`,
      )
    if (actual > allowed) {
      exceeded.push(file)
      faults.push(`packages/doom/src/${file}: ${plural(actual, "offence", "offences")}, above ceiling ${allowed}.`)
    } else if (actual < allowed) {
      faults.push(
        actual === 0
          ? `packages/doom/src/${file}: 0 offences, below ceiling ${allowed}. Remove it from ${ceilingFile}.`
          : `packages/doom/src/${file}: ${plural(actual, "offence", "offences")}, below ceiling ${allowed}. Lower its ceiling in ${ceilingFile}.`,
      )
    }
  }
  return { faults, exceeded }
}

const breakdown = (found) => {
  const kinds = Object.groupBy(found, (each) => each.kind)
  const parts = kindOrder.filter((kind) => kinds[kind]?.length).map((kind) => `${kinds[kind].length} ${kind}`)
  const fileCount = new Set(found.map((each) => each.file)).size
  return `${found.length} (${parts.join(", ")}) in ${plural(fileCount, "file", "files")}`
}

const run = (root) => {
  const base = baseCeiling(root)
  if (base.missing) {
    console.error("origin/main is missing, so the doom-never-knows ceiling cannot be compared.")
    return 1
  }
  const ceiling = readCeiling(fs.readFileSync(path.join(root, ceilingFile), "utf8"))
  const found = doomOffences(root)
  const { faults, exceeded } = ceilingFaults({ found, ceiling, base: base.ceiling })
  if (faults.length > 0) {
    const over = new Set(exceeded)
    for (const each of found)
      if (over.has(each.file)) console.error(`packages/doom/src/${each.file}:${each.line}\t${each.kind}\t${each.what}`)
    for (const fault of faults) console.error(fault)
    console.error(`Doom knows what it must not: ${breakdown(found)}.`)
    return 1
  }
  console.log(
    found.length === 0 ? "Doom knows no host, words or taste." : `Doom never-knows ceiling: ${breakdown(found)}.`,
  )
  return 0
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(process.argv[2] ?? path.join(path.dirname(fileURLToPath(import.meta.url)), ".."))
  process.exitCode = run(root)
}
