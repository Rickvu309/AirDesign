import { execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { parseSync } from "oxc-parser"
import { packageFolder } from "./package-build.mjs"

export const loader = "scripts/package-build.mjs"
const loaderName = "packageBuild"
const kept = new Set([loader, "scripts/source-only.mjs", ".railway/railway.ts"])
const code = /\.(?:[cm]?[jt]sx?)$/
const testCode = /\.test\.[cm]?[jt]sx?$|(^|\/)[\w-]*fixtures\//
const buildPath = /(?:apps|packages)\/[\w-]+\/dist\/[\w./-]*\.js\b|["'`]dist\/[\w./-]*\.js["'`]/

const useLoader = `Load it with ${loaderName}(repo, "<package name>") from ${loader}, which finds the package by its name and its build by its package.json`

export const buildPathFaults = (file, source) =>
  source.split("\n").flatMap((text, at) => {
    const found = buildPath.exec(text)
    return found === null
      ? []
      : [`${file}:${at + 1}: ${found[0]} reaches into a package's build by its path. ${useLoader}.`]
  })

const runtimeExport = (node) => node.exportKind !== "type"

export const exportedNames = (file, source) => {
  const names = new Set()
  for (const statement of parseSync(file, source).program.body) {
    if (statement.type !== "ExportNamedDeclaration" || !runtimeExport(statement)) continue
    for (const specifier of statement.specifiers ?? []) {
      if (runtimeExport(specifier)) names.add(specifier.exported.name ?? specifier.exported.value)
    }
    const declaration = statement.declaration
    if (declaration?.type === "VariableDeclaration") {
      for (const each of declaration.declarations) if (each.id.type === "Identifier") names.add(each.id.name)
    } else if (declaration?.id?.name && !/^TS/.test(declaration.type)) names.add(declaration.id.name)
  }
  return names
}

const children = (node) =>
  Object.values(node).flatMap((value) =>
    Array.isArray(value)
      ? value.filter((each) => each && typeof each.type === "string")
      : value && typeof value.type === "string"
        ? [value]
        : [],
  )

const walk = (node, visit) => {
  visit(node)
  for (const child of children(node)) walk(child, visit)
}

const literal = (node) => node?.type === "Literal" && typeof node.value === "string"

const lineOf = (source, offset) => source.slice(0, offset).split("\n").length

export const loaderReads = (file, source) => {
  const program = parseSync(file, source).program
  const reads = []
  const bound = new Map()
  walk(program, (node) => {
    if (node.type !== "VariableDeclarator" || node.init === null) return
    const call = node.init.type === "AwaitExpression" ? node.init.argument : node.init
    if (call?.type !== "CallExpression" || call.callee.type !== "Identifier" || call.callee.name !== loaderName) return
    const [, named, file] = call.arguments
    if (!literal(named) || (file !== undefined && !literal(file))) return
    const from = { name: named.value, file: file?.value }
    const line = lineOf(source, node.start)
    if (node.id.type === "ObjectPattern") {
      for (const property of node.id.properties) {
        if (property.type === "Property" && property.key.type === "Identifier")
          reads.push({ line, ...from, read: property.key.name })
      }
    } else if (node.id.type === "Identifier") bound.set(node.id.name, from)
  })
  walk(program, (node) => {
    if (node.type !== "MemberExpression" || node.computed || node.object.type !== "Identifier") return
    const from = bound.get(node.object.name)
    if (from !== undefined) reads.push({ line: lineOf(source, node.start), ...from, read: node.property.name })
  })
  return reads
}

export const sourceOf = (built = "index.js") => built.replace(/\.js$/, ".ts")

export const readFaults = (file, source, exportsOf) =>
  loaderReads(file, source).flatMap(({ line, name, file: built, read }) => {
    const where = `${name}'s src/${sourceOf(built)}`
    const names = exportsOf(name, built)
    if (names === undefined) return [`${file}:${line}: ${where} does not exist. Load the file that holds ${read} now.`]
    return names.has(read)
      ? []
      : [`${file}:${line}: ${where} does not export ${read}. Load the file that exports it now.`]
  })

export const packageExports = (repo) => {
  const known = new Map()
  return (name, built) => {
    const key = `${name} ${built}`
    if (!known.has(key)) {
      try {
        const source = path.join(packageFolder(repo, name), "src", sourceOf(built))
        known.set(key, exportedNames(source, fs.readFileSync(source, "utf8")))
      } catch {
        known.set(key, undefined)
      }
    }
    return known.get(key)
  }
}

export const packageReadFaults = (root) => {
  const files = execFileSync("git", ["-C", root, "ls-files", "--cached", "--others", "--exclude-standard", "-z"], {
    encoding: "utf8",
  })
    .split("\0")
    .filter(
      (file) => code.test(file) && !testCode.test(file) && !kept.has(file) && fs.existsSync(path.join(root, file)),
    )
  const exportsOf = packageExports(root)
  return files.flatMap((file) => {
    const source = fs.readFileSync(path.join(root, file), "utf8")
    return [
      ...buildPathFaults(file, source),
      ...(source.includes(loaderName) ? readFaults(file, source, exportsOf) : []),
    ]
  })
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(process.argv[2] ?? path.join(path.dirname(fileURLToPath(import.meta.url)), ".."))
  const faults = packageReadFaults(root)
  for (const fault of faults) console.error(fault)
  if (faults.length > 0) process.exit(1)
}
