import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { parseSync } from "oxc-parser"

const roots = ["apps", "packages", "tests"]
const skipDirs = new Set(["node_modules", "dist", "fixtures", "boundary-fixtures", "test-results"])
const codeFile = /\.[cm]?[jt]sx?$/
const testFile = /\.test\.[cm]?[jt]sx?$/
const hookNames = new Set(["beforeAll", "beforeEach", "afterAll", "afterEach"])
const barrels = new Set(["@airdesign/doom", "@airdesign/catalog"])
const extensions = [".ts", ".tsx", ".mts", ".js", ".mjs"]

const collectFiles = (root, folder, found = []) => {
  const full = path.join(root, folder)
  if (!fs.existsSync(full)) return found
  for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
    if (skipDirs.has(entry.name)) continue
    const next = path.posix.join(folder, entry.name)
    if (entry.isDirectory()) collectFiles(root, next, found)
    else if (codeFile.test(entry.name)) found.push(next)
  }
  return found
}

const resolveTarget = (fromFile, specifier, fileSet) => {
  if (typeof specifier !== "string") return undefined
  let candidate
  if (specifier.startsWith("./") || specifier.startsWith("../")) {
    candidate = path.posix.normalize(path.posix.join(path.posix.dirname(fromFile), specifier))
  } else if (specifier.startsWith("@/")) {
    candidate = `apps/web/src/${specifier.slice(2)}`
  } else return undefined
  const stem = candidate.replace(codeFile, "")
  return [candidate, ...extensions.map((ext) => stem + ext), ...extensions.map((ext) => `${stem}/index${ext}`)].find(
    (item) => fileSet.has(item),
  )
}

const lineAt = (source, offset) => source.slice(0, offset).split("\n").length

const literalSource = (node) => (node?.type === "Literal" && typeof node.value === "string" ? node.value : undefined)

const walk = (node, visit) => {
  if (!node || typeof node !== "object") return
  visit(node)
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) {
      for (const item of value) walk(item, visit)
    } else if (value && typeof value === "object" && value.type) walk(value, visit)
  }
}

const hookCall = (node) => {
  let current = node?.callee
  while (current) {
    if (current.type === "Identifier") return hookNames.has(current.name) ? current.name : undefined
    if (current.type === "MemberExpression" && !current.computed) {
      current = current.object
      continue
    }
    if (current.type === "CallExpression") {
      current = current.callee
      continue
    }
    return undefined
  }
  return undefined
}

const typeWrappers = new Set([
  "TSAsExpression",
  "TSTypeAssertion",
  "TSSatisfiesExpression",
  "TSNonNullExpression",
  "TSInstantiationExpression",
])

const opensType = (type) => typeof type === "string" && type.startsWith("TS") && !typeWrappers.has(type)

const usedAsValue = (program, local) => {
  let found = false
  const visit = (node, typed) => {
    if (found || !node || typeof node !== "object") return
    if (node.type === "ImportDeclaration") return
    const typedHere = typed || opensType(node.type)
    if (!typedHere && node.type === "Identifier" && node.name === local) {
      found = true
      return
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) {
        for (const item of value) visit(item, typedHere)
      } else if (value && typeof value === "object" && value.type) visit(value, typedHere)
    }
  }
  visit(program, false)
  return found
}

const valueImports = (file, source) => {
  const parsed = parseSync(file, source)
  if (parsed.errors.length > 0) throw new Error(`Cannot parse ${file}: ${parsed.errors[0].message}`)
  const barrelsHit = []
  const local = []
  const doomValueNamed = parsed.program.body.some(
    (stmt) =>
      stmt.type === "ImportDeclaration" &&
      stmt.importKind !== "type" &&
      stmt.source?.value === "@airdesign/doom" &&
      stmt.specifiers.some((spec) => spec.type === "ImportSpecifier" && spec.importKind !== "type"),
  )
  for (const stmt of parsed.program.body) {
    if (stmt.type !== "ImportDeclaration" || stmt.importKind === "type") continue
    const specifier = stmt.source.value
    const live = stmt.specifiers.length === 0 || stmt.specifiers.some((spec) => spec.importKind !== "type")
    if (!live) continue
    const localName = stmt.specifiers.find((spec) => spec.type === "ImportNamespaceSpecifier")?.local.name
    const needlessDoom =
      specifier === "@airdesign/doom" &&
      localName !== undefined &&
      !doomValueNamed &&
      !usedAsValue(parsed.program, localName)
    if (specifier === "@airdesign/catalog" || needlessDoom) barrelsHit.push(specifier)
    else if (!barrels.has(specifier)) local.push(specifier)
  }
  return { barrelsHit, local }
}

const barrelThrough = (file, texts, fileSet, seen) => {
  if (seen.has(file)) return undefined
  seen.add(file)
  const { barrelsHit, local } = valueImports(file, texts.get(file) ?? fs.readFileSync(file, "utf8"))
  if (barrelsHit.length > 0) return { file, barrel: barrelsHit[0] }
  for (const specifier of local) {
    const target = resolveTarget(file, specifier, fileSet)
    if (!target) continue
    const found = barrelThrough(target, texts, fileSet, seen)
    if (found) return found
  }
  return undefined
}

export const hookHeavyFaults = (root) => {
  const files = roots.flatMap((folder) => collectFiles(root, folder))
  const fileSet = new Set(files)
  const texts = new Map(files.map((file) => [file, fs.readFileSync(path.join(root, file), "utf8")]))
  const faults = []
  for (const file of files.filter((item) => testFile.test(item))) {
    const source = texts.get(file)
    const parsed = parseSync(file, source)
    if (parsed.errors.length > 0) throw new Error(`Cannot parse ${file}: ${parsed.errors[0].message}`)
    walk(parsed.program, (node) => {
      if (node.type !== "CallExpression") return
      const hook = hookCall(node)
      const callback = node.arguments[0]
      if (!hook || !callback) return
      walk(callback, (inner) => {
        if (inner.type !== "ImportExpression") return
        const specifier = literalSource(inner.source)
        if (!specifier) return
        const loaded = barrels.has(specifier) ? specifier : resolveTarget(file, specifier, fileSet)
        if (!loaded) return
        const hit = barrels.has(specifier)
          ? { file, barrel: specifier }
          : barrelThrough(loaded, texts, fileSet, new Set())
        if (!hit) return
        const line = lineAt(source, node.start)
        faults.push(
          `${file}:${String(line)}: ${hook} imports ${specifier}, and ${hit.file} loads ${hit.barrel}. That import runs inside the 10s hook limit and times out when the suite starts in parallel. Import a type from @airdesign/doom, or @airdesign/catalog/icon-names. Leave the dynamic import after the DOM exists.`,
        )
      })
    })
  }
  return [...new Set(faults)].sort()
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
  const faults = hookHeavyFaults(root)
  if (faults.length > 0) {
    console.error(faults.join("\n"))
    process.exit(1)
  }
  console.log("vitest hooks do not load the doom or catalog barrel")
}
