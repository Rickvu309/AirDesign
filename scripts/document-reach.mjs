import { execFileSync } from "node:child_process"
import { existsSync } from "node:fs"
import path from "node:path"
import { parseSync } from "oxc-parser"

const readers = ["packages/pptx/", "packages/document/"]
const sources = /\.[cm]?[jt]sx?$/
const dependencyFields = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"]
const mockCalls = new Set(["mock", "doMock", "unmock", "doUnmock", "importActual", "importMock"])

export const documentAdvice =
  "Only packages/pptx reads @airdesign/document, the PowerPoint model. Take slide data from @airdesign/doom (packages/doom/src/index.ts) and UI tokens from @airdesign/theme."

const namesDocument = (specifier) => specifier === "@airdesign/document" || specifier.startsWith("@airdesign/document/")

const stringOf = (node) => {
  if (node?.type === "Literal" && typeof node.value === "string") return node.value
  if (node?.type === "TemplateLiteral" && node.expressions.length === 0 && node.quasis.length === 1)
    return node.quasis[0].value.cooked ?? node.quasis[0].value.raw
  return undefined
}

const isLoaderCall = (callee) => {
  if (callee?.type === "Identifier") return callee.name === "require"
  if (callee?.type !== "MemberExpression" || callee.computed || callee.object?.type !== "Identifier") return false
  const method = callee.property?.type === "Identifier" ? callee.property.name : undefined
  return (
    (callee.object.name === "require" && method === "resolve") || (callee.object.name === "vi" && mockCalls.has(method))
  )
}

const specifierOf = (node) => {
  switch (node.type) {
    case "ImportDeclaration":
    case "ExportAllDeclaration":
    case "ExportNamedDeclaration":
    case "ImportExpression":
    case "TSImportType":
      return node.source
    case "TSExternalModuleReference":
      return node.expression
    case "CallExpression":
      return isLoaderCall(node.callee) ? node.arguments[0] : undefined
    default:
      return undefined
  }
}

const lineOf = (source, offset) => source.slice(0, offset).split("\n").length

const walk = (node, visit) => {
  if (!node || typeof node !== "object") return
  if (typeof node.type === "string") visit(node)
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) {
      for (const each of value) walk(each, visit)
    } else walk(value, visit)
  }
}

const documentImportLines = (file, source) => {
  if (!source.includes("@airdesign/document")) return []
  const parsed = parseSync(file, source)
  if (parsed.errors.length > 0) return undefined
  const lines = []
  walk(parsed.program, (node) => {
    const target = specifierOf(node)
    const specifier = stringOf(target)
    if (specifier !== undefined && namesDocument(specifier)) lines.push(lineOf(source, target.start))
  })
  return lines
}

const dependsOnDocument = (text) => {
  const manifest = JSON.parse(text)
  return dependencyFields.some((field) => Object.hasOwn(manifest[field] ?? {}, "@airdesign/document"))
}

export function documentReachFaults(files, read) {
  return files.flatMap((file) => {
    if (readers.some((reader) => file.startsWith(reader))) return []
    if (path.basename(file) === "package.json")
      return dependsOnDocument(read(file)) ? [`${file} depends on @airdesign/document. ${documentAdvice}`] : []
    if (!sources.test(file)) return []
    const lines = documentImportLines(file, read(file))
    if (lines === undefined)
      return [`${file} names @airdesign/document and does not parse, so its imports cannot be checked. Fix its syntax.`]
    return lines.map((line) => `${file}:${String(line)} imports @airdesign/document. ${documentAdvice}`)
  })
}

export function repoFiles(root) {
  return execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], {
    cwd: root,
    encoding: "utf8",
  })
    .split("\0")
    .filter((file) => file !== "" && existsSync(path.join(root, file)))
}
