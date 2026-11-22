import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { parseSync } from "oxc-parser"

const roots = ["apps", "packages", "tests", ".agents/skills"]
const skipDirs = new Set(["node_modules", "dist", "fixtures", "boundary-fixtures", "test-results"])
const codeFile = /\.[cm]?[jt]sx?$/
const testFile = /\.test\.[cm]?[jt]sx?$/
const testNames = new Set(["it", "test"])
const hookNames = new Set(["beforeAll", "beforeEach", "afterAll", "afterEach"])
const tsWrappers = new Set([
  "TSAsExpression",
  "TSSatisfiesExpression",
  "TSNonNullExpression",
  "TSTypeAssertion",
  "TSInstantiationExpression",
])
const extensions = [".ts", ".tsx", ".mts", ".js", ".mjs"]
const defaultTestMs = 5_000
const defaultHookMs = 10_000

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
  } else {
    const pkg = /^@airdesign\/([a-z0-9-]+)(?:\/(.*))?$/.exec(specifier)
    if (!pkg) return undefined
    candidate = pkg[2] ? `packages/${pkg[1]}/src/${pkg[2]}` : `packages/${pkg[1]}/src/index.ts`
  }
  const stem = candidate.replace(codeFile, "")
  return [candidate, ...extensions.map((ext) => stem + ext), ...extensions.map((ext) => `${stem}/index${ext}`)].find(
    (item) => fileSet.has(item),
  )
}

const needlesFor = (file) => {
  const base = path.posix.basename(file).replace(codeFile, "")
  const found = [base]
  if (base === "index") found.push(path.posix.basename(path.posix.dirname(file)))
  const pkg = /^packages\/([a-z0-9-]+)\/src\/index\.ts$/.exec(file)
  if (pkg) found.push(`@airdesign/${pkg[1]}`)
  return found
}

const candidateFiles = (files, texts) => {
  const active = new Set(files.filter((file) => texts.get(file).includes("dumpSpec")))
  let frontier = [...active]
  while (frontier.length > 0) {
    const needles = [...new Set(frontier.flatMap(needlesFor))]
    frontier = []
    for (const file of files) {
      if (active.has(file)) continue
      if (needles.some((needle) => texts.get(file).includes(needle))) {
        active.add(file)
        frontier.push(file)
      }
    }
  }
  return [...active].sort()
}

const unwrap = (node) => {
  let current = node
  while (current && tsWrappers.has(current.type)) current = current.expression
  return current
}

const isFunction = (node) =>
  Boolean(
    node &&
    (node.type === "FunctionDeclaration" ||
      node.type === "FunctionExpression" ||
      node.type === "ArrowFunctionExpression"),
  )

const vitestCall = (callee) => {
  let current = unwrap(callee)
  let todo = false
  while (current) {
    if (current.type === "Identifier") {
      if (todo) return undefined
      if (testNames.has(current.name)) return { kind: "test", name: current.name }
      if (hookNames.has(current.name)) return { kind: "hook", name: current.name }
      return undefined
    }
    if (current.type === "MemberExpression" && !current.computed) {
      if (current.property.name === "todo") todo = true
      current = unwrap(current.object)
      continue
    }
    if (current.type === "CallExpression") {
      current = unwrap(current.callee)
      continue
    }
    return undefined
  }
  return undefined
}

const propertyNamed = (objectNode, name) =>
  objectNode?.type === "ObjectExpression"
    ? objectNode.properties.find(
        (prop) => prop.type === "Property" && !prop.computed && (prop.key.name ?? prop.key.value) === name,
      )?.value
    : undefined

const numericValue = (node, consts) => {
  const value = unwrap(node)
  if (!value) return undefined
  if (value.type === "Literal" && typeof value.value === "number") return value.value
  if (value.type === "Identifier" && consts.has(value.name)) return consts.get(value.name)
  if (value.type === "UnaryExpression" && value.operator === "-") {
    const inner = numericValue(value.argument, consts)
    return inner === undefined ? undefined : -inner
  }
  if (value.type === "BinaryExpression") {
    const left = numericValue(value.left, consts)
    const right = numericValue(value.right, consts)
    if (left === undefined || right === undefined) return undefined
    if (value.operator === "*") return left * right
    if (value.operator === "+") return left + right
    if (value.operator === "-") return left - right
    if (value.operator === "/") return left / right
  }
  return undefined
}

const hasOwnTimeout = (arg, minMs, consts) => {
  const value = unwrap(arg)
  if (!value || (value.type === "Identifier" && value.name === "undefined")) return false
  if (value.type === "Literal" && value.value === null) return false
  const number = numericValue(value, consts)
  return number === undefined ? true : number > minMs
}

const vitestParts = (callNode, callInfo, consts) => {
  const args = callNode.arguments
  if (callInfo.kind === "hook") {
    return { callback: args[0], timed: hasOwnTimeout(args[1], defaultHookMs, consts) }
  }
  const second = unwrap(args[1])
  if (second?.type === "ObjectExpression") {
    return { callback: args[2], timed: hasOwnTimeout(propertyNamed(second, "timeout"), defaultTestMs, consts) }
  }
  const third = unwrap(args[2])
  const timeoutArg = third?.type === "ObjectExpression" ? propertyNamed(third, "timeout") : third
  return { callback: args[1], timed: hasOwnTimeout(timeoutArg, defaultTestMs, consts) }
}

const literalText = (node) =>
  node?.type === "Literal" && typeof node.value === "string"
    ? node.value
    : node?.type === "TemplateLiteral"
      ? node.quasis.map((quasi) => quasi.value.raw).join("")
      : undefined

const lineAt = (source, offset) => source.slice(0, offset).split("\n").length

const analyzeFile = (file, source, fileSet) => {
  const parsed = parseSync(file, source)
  if (parsed.errors.length > 0) throw new Error(`Cannot parse ${file}: ${parsed.errors[0].message}`)
  const hasCheckSpecs = source.includes("check-specs.mjs")
  const directDumpNames = new Set(["dumpSpec"])
  const imports = new Map()
  const namespaces = new Map()
  const exports = new Map()
  const reexports = new Map()
  const starReexports = []
  const constNumbers = new Map()
  const scopes = new Map()
  const untimedHooks = []
  const pendingFunctions = []
  let nextScopeId = 0

  const makeScope = (label) => {
    const id = `${file}#${String(nextScopeId++)}:${label}`
    const scope = { id, file, label, direct: false, localRefs: [], extRefs: [] }
    scopes.set(id, scope)
    return scope
  }

  for (const stmt of parsed.program.body) {
    if (stmt.type === "ImportDeclaration" && stmt.importKind !== "type") {
      if (typeof stmt.source.value === "string" && stmt.source.value.endsWith("check-specs.mjs")) {
        for (const spec of stmt.specifiers) {
          if (spec.importKind !== "type" && spec.type === "ImportSpecifier") {
            if ((spec.imported.name ?? spec.imported.value) === "dumpSpec") directDumpNames.add(spec.local.name)
          }
        }
      }
      const target = resolveTarget(file, stmt.source.value, fileSet)
      if (!target) continue
      for (const spec of stmt.specifiers) {
        if (spec.importKind === "type") continue
        if (spec.type === "ImportSpecifier") {
          imports.set(spec.local.name, { target, name: spec.imported.name ?? spec.imported.value })
        } else if (spec.type === "ImportDefaultSpecifier") {
          imports.set(spec.local.name, { target, name: "default" })
        } else if (spec.type === "ImportNamespaceSpecifier") {
          namespaces.set(spec.local.name, target)
        }
      }
    } else if (stmt.type === "ExportAllDeclaration" && stmt.exportKind !== "type") {
      const target = resolveTarget(file, stmt.source.value, fileSet)
      if (target) starReexports.push(target)
    } else if (stmt.type === "ExportNamedDeclaration" && stmt.exportKind !== "type" && stmt.source) {
      const target = resolveTarget(file, stmt.source.value, fileSet)
      if (!target) continue
      for (const spec of stmt.specifiers) {
        if (spec.exportKind !== "type") {
          reexports.set(spec.exported.name ?? spec.exported.value, {
            target,
            name: spec.local.name ?? spec.local.value,
          })
        }
      }
    }
  }

  const bindStatements = (statements, parentEnv) => {
    const env = new Map(parentEnv)
    const declared = new Set()
    for (const raw of statements) {
      const stmt =
        raw.type === "ExportNamedDeclaration" && raw.declaration
          ? raw.declaration
          : raw.type === "ExportDefaultDeclaration"
            ? raw.declaration
            : raw
      if (stmt.type === "FunctionDeclaration" && stmt.id) {
        const fnScope = makeScope(stmt.id.name)
        env.set(stmt.id.name, fnScope.id)
        pendingFunctions.push({ fnScope, body: stmt.body, env })
        declared.add(raw)
        if (raw.type === "ExportNamedDeclaration") exports.set(stmt.id.name, fnScope.id)
        if (raw.type === "ExportDefaultDeclaration") exports.set("default", fnScope.id)
      } else if (stmt.type === "VariableDeclaration") {
        for (const decl of stmt.declarations) {
          if (decl.id.type !== "Identifier") continue
          const init = unwrap(decl.init)
          if (isFunction(init)) {
            const fnScope = makeScope(decl.id.name)
            env.set(decl.id.name, fnScope.id)
            pendingFunctions.push({ fnScope, body: init.body, env })
            declared.add(decl)
            if (raw.type === "ExportNamedDeclaration") exports.set(decl.id.name, fnScope.id)
          } else if (stmt.kind === "const") {
            const number = numericValue(init, constNumbers)
            if (number !== undefined) constNumbers.set(decl.id.name, number)
          }
        }
      } else if (raw.type === "ExportDefaultDeclaration" && isFunction(unwrap(stmt))) {
        const init = unwrap(stmt)
        const fnScope = makeScope("default")
        pendingFunctions.push({ fnScope, body: init.body, env })
        declared.add(raw)
        exports.set("default", fnScope.id)
      }
    }
    return { env, declared }
  }

  const visit = (node, currentScope, env, skipNodes) => {
    if (!node || typeof node !== "object" || skipNodes.has(node)) return
    if (node.type?.startsWith("TS")) {
      if (tsWrappers.has(node.type)) visit(node.expression, currentScope, env, skipNodes)
      return
    }
    if (node.type === "ImportDeclaration") return
    if (node.type === "BlockStatement") {
      const { env: nextEnv, declared } = bindStatements(node.body, env)
      for (const stmt of node.body) visit(stmt, currentScope, nextEnv, declared)
      return
    }
    if (node.type === "FunctionDeclaration" && node.id) return
    if (node.type === "VariableDeclarator" && node.id.type === "Identifier" && isFunction(unwrap(node.init))) return

    if (node.type === "CallExpression") {
      const callee = unwrap(node.callee)
      if (callee?.type === "Identifier" && directDumpNames.has(callee.name)) currentScope.direct = true
      if (
        callee?.type === "MemberExpression" &&
        !callee.computed &&
        callee.property.type === "Identifier" &&
        callee.property.name === "dumpSpec"
      ) {
        currentScope.direct = true
      }
      const vCall = vitestCall(callee)
      if (vCall) {
        const { callback, timed } = vitestParts(node, vCall, constNumbers)
        const cb = unwrap(callback)
        if (!timed && cb) {
          const line = lineAt(source, node.start)
          const hookScope = makeScope(`${vCall.name}@${String(line)}`)
          untimedHooks.push({ file, line, kind: vCall.kind, name: vCall.name, scopeId: hookScope.id })
          visit(isFunction(cb) ? cb.body : cb, hookScope, env, skipNodes)
        }
        return
      }
    }

    if (hasCheckSpecs) {
      const text = literalText(node)
      if (text && /\bdumpSpec\b/.test(text)) currentScope.direct = true
    }

    if (node.type === "MemberExpression" && !node.computed && node.object.type === "Identifier") {
      const target = namespaces.get(node.object.name)
      if (target && node.property.type === "Identifier") {
        currentScope.extRefs.push({ target, name: node.property.name })
        return
      }
    }

    if (node.type === "Identifier") {
      if (directDumpNames.has(node.name)) currentScope.direct = true
      else if (env.has(node.name)) currentScope.localRefs.push(env.get(node.name))
      else if (imports.has(node.name)) currentScope.extRefs.push(imports.get(node.name))
      return
    }

    for (const [key, value] of Object.entries(node)) {
      if (key === "type" || key === "start" || key === "end") continue
      if (node.type === "MemberExpression" && !node.computed && key === "property") continue
      if (node.type === "Property" && !node.computed && key === "key") continue
      if (node.type === "VariableDeclarator" && key === "id") continue
      if (
        (node.type === "FunctionExpression" || node.type === "ArrowFunctionExpression") &&
        (key === "params" || key === "id")
      )
        continue
      if (Array.isArray(value)) {
        for (const child of value) visit(child, currentScope, env, skipNodes)
      } else if (value && typeof value === "object") {
        visit(value, currentScope, env, skipNodes)
      }
    }
  }

  const rootScope = makeScope("<top>")
  const { env: rootEnv, declared: rootDeclared } = bindStatements(parsed.program.body, new Map())
  for (const stmt of parsed.program.body) {
    if (stmt.type === "ExportNamedDeclaration" && !stmt.source && !stmt.declaration) {
      for (const spec of stmt.specifiers) {
        if (spec.exportKind === "type") continue
        const local = spec.local.name ?? spec.local.value
        const exported = spec.exported.name ?? spec.exported.value
        if (rootEnv.has(local)) exports.set(exported, rootEnv.get(local))
        else if (imports.has(local)) reexports.set(exported, imports.get(local))
      }
    }
  }
  for (const stmt of parsed.program.body) visit(stmt, rootScope, rootEnv, rootDeclared)
  while (pendingFunctions.length > 0) {
    const { fnScope, body, env } = pendingFunctions.shift()
    visit(body, fnScope, env, new Set())
  }

  return { file, rootScopeId: rootScope.id, scopes, exports, reexports, starReexports, untimedHooks }
}

const resolveExport = (file, name, analyzed, seen = new Set()) => {
  const key = `${file}::${name}`
  if (seen.has(key)) return undefined
  seen.add(key)
  const info = analyzed.get(file)
  if (!info) return undefined
  if (info.exports.has(name)) return info.exports.get(name)
  if (info.reexports.has(name)) {
    const next = info.reexports.get(name)
    return resolveExport(next.target, next.name, analyzed, seen)
  }
  for (const target of info.starReexports) {
    const found = resolveExport(target, name, analyzed, seen)
    if (found) return found
  }
  return undefined
}

export const specTimeoutFaults = (root) => {
  const files = roots.flatMap((folder) => collectFiles(root, folder)).sort()
  const fileSet = new Set(files)
  const texts = new Map(files.map((file) => [file, fs.readFileSync(path.join(root, file), "utf8")]))
  const analyzed = new Map(
    candidateFiles(files, texts).map((file) => [file, analyzeFile(file, texts.get(file), fileSet)]),
  )

  const allScopes = new Map()
  const callers = new Map()
  const addEdge = (from, to) => {
    if (!callers.has(to)) callers.set(to, new Set())
    callers.get(to).add(from)
  }
  for (const info of analyzed.values()) {
    for (const scope of info.scopes.values()) allScopes.set(scope.id, scope)
  }
  for (const info of analyzed.values()) {
    for (const scope of info.scopes.values()) {
      for (const localTarget of scope.localRefs) addEdge(scope.id, localTarget)
      for (const ext of scope.extRefs) {
        const resolved = resolveExport(ext.target, ext.name, analyzed)
        if (resolved) addEdge(scope.id, resolved)
      }
    }
  }

  const witness = new Map()
  const queue = []
  for (const scope of allScopes.values()) {
    if (scope.direct) {
      witness.set(scope.id, [scope.label, "dumpSpec"])
      queue.push(scope.id)
    }
  }
  while (queue.length > 0) {
    const current = queue.shift()
    const chain = witness.get(current)
    for (const caller of callers.get(current) ?? []) {
      if (witness.has(caller)) continue
      witness.set(caller, [allScopes.get(caller).label, ...chain])
      queue.push(caller)
    }
  }

  const faults = []
  for (const info of analyzed.values()) {
    for (const hook of info.untimedHooks) {
      const chain = witness.get(hook.scopeId)
      if (!chain) continue
      const limit = hook.kind === "hook" ? "10 s" : "5 s"
      faults.push(
        `${hook.file}:${String(hook.line)}: ${hook.name} reaches dumpSpec (${chain.slice(1).join(" -> ")}) without its own timeout above Vitest's ${limit} default. Move the spec dump into beforeAll(..., 60_000) or give the ${hook.kind} an explicit timeout sized for TLC.`,
      )
    }
    if (testFile.test(info.file)) {
      const chain = witness.get(info.rootScopeId)
      if (chain) {
        faults.push(
          `${info.file}:1: top-level code reaches dumpSpec (${chain.slice(1).join(" -> ")}) outside a timed hook or test. Move the spec dump into beforeAll(..., 60_000).`,
        )
      }
    }
  }
  return faults.sort()
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(process.argv[2] ?? path.join(path.dirname(fileURLToPath(import.meta.url)), ".."))
  const faults = specTimeoutFaults(root)
  for (const fault of faults) console.error(fault)
  if (faults.length > 0) process.exit(1)
}
