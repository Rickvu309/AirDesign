import { apiFile, moduleVisitors, outer, staticText, typeOnly } from "../module-reference.js"

const message =
  "Read the environment only by passing process.env whole from start.ts, setup.ts or bootstrap.ts to its reader, then take the values as a parameter, the way readStartSettings does."
const readers = new Map([
  ["start.ts", { name: "readStartSettings", source: "./start-settings.js" }],
  ["setup.ts", { name: "runSetup", source: "./provision.js" }],
  ["bootstrap.ts", { name: "runBootstrap", source: "./provision.js" }],
])
const modules = new Set(["process", "node:process"])
const globals = new Set(["globalThis", "global"])
const harnessFile = "postgres-setup.ts"
const harnessKeys = new Set(["LD_LIBRARY_PATH", "AIRDESIGN_POSTGRES_BIN"])
const importSpecifiers = new Set(["ImportSpecifier", "ImportDefaultSpecifier", "ImportNamespaceSpecifier"])

const keyOf = (member) => (member.computed ? staticText(member.property) : member.property.name)

const isMemberOf = (parent, node) => parent?.type === "MemberExpression" && parent.object === node

const isReference = (node) => {
  const parent = node.parent
  if (importSpecifiers.has(parent?.type) || parent?.type === "TSTypeQuery" || parent?.type === "TSQualifiedName")
    return false
  if (parent?.type === "MemberExpression" && parent.property === node && !parent.computed) return false
  return !(parent?.key === node && !parent.computed)
}

const harnessAllows = (env) => {
  const top = outer(env)
  if (isMemberOf(top.parent, top)) return harnessKeys.has(keyOf(top.parent))
  return top.parent?.type === "ReturnStatement" || top.parent?.type === "SpreadElement"
}

const rule = {
  meta: {
    type: "problem",
    docs: {
      description: "Reject reading process.env in apps/api/src except whole, from an entry, into its reader.",
    },
  },
  create(context) {
    const file = apiFile(context)
    if (file === undefined) return {}
    const reader = readers.get(file)
    let readerName
    const noteReader = (node) => {
      if (node.source.value !== reader?.source) return
      for (const specifier of node.specifiers) {
        if (specifier.imported?.name === reader.name) readerName = specifier.local.name
      }
    }
    const passedToReader = (env) => {
      const top = outer(env)
      const call = top.parent
      if (readerName === undefined || call?.type !== "CallExpression") return false
      return call.callee.name === readerName && call.arguments.includes(top)
    }
    const checkEnv = (env) => {
      if (file === harnessFile ? harnessAllows(env) : passedToReader(env)) return
      context.report({ node: env, message })
    }
    const checkProcess = (reference) => {
      const top = outer(reference)
      if (!isMemberOf(top.parent, top)) return context.report({ node: top, message })
      const key = keyOf(top.parent)
      if (key === "env") return checkEnv(top.parent)
      if (key === undefined && reader === undefined) context.report({ node: top.parent, message })
    }
    return {
      ...moduleVisitors((node, source) => {
        if (node.type === "ImportDeclaration") noteReader(node)
        if (modules.has(source) && !typeOnly(node)) context.report({ node, message })
      }),
      Identifier(node) {
        if (node.name === "process" && isReference(node)) checkProcess(node)
      },
      MemberExpression(node) {
        if (globals.has(node.object.name) && keyOf(node) === "process") checkProcess(node)
      },
    }
  },
}

export default rule
