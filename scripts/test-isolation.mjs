import fs from "node:fs"
import path from "node:path"
import { parseSync } from "oxc-parser"

export const pureMembers = new Set([
  "fn",
  "mocked",
  "waitFor",
  "waitUntil",
  "isMockFunction",
  "isFakeTimers",
  "getTimerCount",
])

const globalNames = new Set(["globalThis", "global", "window", "self", "document", "navigator"])
const reflectNames = new Set(["Object", "Reflect"])
const reflectMembers = new Set([
  "defineProperty",
  "defineProperties",
  "assign",
  "set",
  "deleteProperty",
  "setPrototypeOf",
])

const unitGlobs = [
  "apps/**/*.test.ts",
  "apps/**/*.test.tsx",
  "packages/**/*.test.ts",
  "tests/**/*.test.ts",
  ".agents/skills/**/*.test.mjs",
]

export const unitTestFiles = (root) =>
  fs
    .globSync(unitGlobs, { cwd: root, exclude: (name) => name === "node_modules" || name === "dist" })
    .filter(
      (file) =>
        !file.startsWith("tests/browser/") && !file.startsWith("packages/render/") && !file.startsWith("apps/api/"),
    )
    .sort()

const children = (node) =>
  Object.values(node).flatMap((value) =>
    Array.isArray(value)
      ? value.filter((item) => item !== null && typeof item === "object" && typeof item.type === "string")
      : value !== null && typeof value === "object" && typeof value.type === "string"
        ? [value]
        : [],
  )

const walk = (node, visit) => {
  visit(node)
  for (const child of children(node)) walk(child, visit)
}

const unwrap = (node) =>
  node &&
  [
    "ParenthesizedExpression",
    "TSNonNullExpression",
    "TSAsExpression",
    "TSSatisfiesExpression",
    "ChainExpression",
  ].includes(node.type)
    ? unwrap(node.expression)
    : node

const nameOf = (node) => {
  if (node?.type === "Identifier") return node.name
  if (node?.type === "Literal" && typeof node.value === "string") return node.value
  return undefined
}

const memberOf = (node) => {
  if (node?.type !== "MemberExpression") return undefined
  if (!node.computed) return nameOf(node.property)
  return node.property.type === "Literal" ? nameOf(node.property) : null
}

const isVitestSource = (node) => node?.type === "Literal" && node.value === "vitest"

const loadsVitest = (node) => {
  const inner = unwrap(node)
  if (inner?.type === "AwaitExpression") return loadsVitest(inner.argument)
  if (inner?.type === "ImportExpression") return isVitestSource(inner.source)
  return (
    inner?.type === "CallExpression" &&
    inner.callee.type === "Identifier" &&
    inner.callee.name === "require" &&
    isVitestSource(inner.arguments[0])
  )
}

const bindingsOf = (program) => {
  const viNames = new Set(["vi"])
  const moduleNames = new Set()
  walk(program, (node) => {
    if (node.type === "ImportDeclaration" && isVitestSource(node.source)) {
      for (const specifier of node.specifiers) {
        if (specifier.type === "ImportSpecifier" && nameOf(specifier.imported) === "vi")
          viNames.add(specifier.local.name)
        if (specifier.type === "ImportNamespaceSpecifier") moduleNames.add(specifier.local.name)
      }
    }
    if (node.type === "VariableDeclarator" && node.init) {
      if (loadsVitest(node.init)) {
        if (node.id.type === "Identifier") moduleNames.add(node.id.name)
        if (node.id.type === "ObjectPattern") {
          for (const property of node.id.properties) {
            if (property.type === "Property" && nameOf(property.key) === "vi" && property.value.type === "Identifier")
              viNames.add(property.value.name)
          }
        }
      }
    }
  })
  let grew = true
  while (grew) {
    grew = false
    walk(program, (node) => {
      if (node.type !== "VariableDeclarator" || node.id.type !== "Identifier" || !node.init) return
      const init = unwrap(node.init)
      const alias = init.type === "Identifier" && viNames.has(init.name)
      const picked = memberOf(init) === "vi" && init.object.type === "Identifier" && moduleNames.has(init.object.name)
      if ((alias || picked) && !viNames.has(node.id.name)) {
        viNames.add(node.id.name)
        grew = true
      }
    })
  }
  return { viNames, moduleNames }
}

const isVi = (node, { viNames, moduleNames }) => {
  const inner = unwrap(node)
  if (inner?.type === "Identifier") return viNames.has(inner.name)
  return memberOf(inner) === "vi" && inner.object.type === "Identifier" && moduleNames.has(inner.object.name)
}

const rootOf = (node) => {
  let current = unwrap(node)
  while (current?.type === "MemberExpression") current = unwrap(current.object)
  return current?.type === "Identifier" ? current.name : undefined
}

const writtenTarget = (node) => {
  if (node.type === "AssignmentExpression") return node.left
  if (node.type === "UpdateExpression") return node.argument
  if (node.type === "UnaryExpression" && node.operator === "delete") return node.argument
  return undefined
}

const touchesGlobal = (target) => {
  const root = rootOf(target)
  if (root === undefined) return undefined
  if (globalNames.has(root)) return root
  if (root === "process" && unwrap(target).type === "MemberExpression") return root
  return undefined
}

export const isolationReasons = (text, fileName = "file.test.ts") => {
  const { program } = parseSync(fileName, text)
  const bindings = bindingsOf(program)
  const reasons = new Set()
  walk(program, (node) => {
    if (node.type === "MemberExpression" && isVi(node.object, bindings)) {
      const member = memberOf(node)
      if (member === null) reasons.add("vi[...]")
      else if (!pureMembers.has(member)) reasons.add(`vi.${member}`)
    }
    if (
      node.type === "VariableDeclarator" &&
      node.id.type === "ObjectPattern" &&
      node.init &&
      isVi(node.init, bindings)
    ) {
      for (const property of node.id.properties) {
        const member = property.type === "Property" ? nameOf(property.key) : undefined
        if (member === undefined || !pureMembers.has(member)) reasons.add(`vi.${member ?? "..."}`)
      }
    }
    if (node.type === "CallExpression" && node.arguments.some((argument) => isVi(argument, bindings)))
      reasons.add("vi passed on")
    const target = writtenTarget(node)
    if (target !== undefined) {
      const touched = touchesGlobal(target)
      if (touched !== undefined) reasons.add(`write to ${touched}`)
    }
    if (node.type === "CallExpression") {
      const callee = unwrap(node.callee)
      const object = callee.type === "MemberExpression" ? unwrap(callee.object) : undefined
      if (
        object?.type === "Identifier" &&
        reflectNames.has(object.name) &&
        reflectMembers.has(memberOf(callee)) &&
        node.arguments[0] !== undefined &&
        (globalNames.has(rootOf(node.arguments[0])) || rootOf(node.arguments[0]) === "process")
      )
        reasons.add("reflect on a global")
    }
  })
  return [...reasons].sort()
}

const readsGlobals = (file) => file.startsWith("apps/web/") || file.startsWith("apps/site/")

export const splitUnitTests = (root) => {
  const files = unitTestFiles(root)
  const shared = files.filter(
    (file) =>
      !readsGlobals(file) && isolationReasons(fs.readFileSync(path.join(root, file), "utf8"), file).length === 0,
  )
  return { shared, isolated: files.filter((file) => !shared.includes(file)) }
}
