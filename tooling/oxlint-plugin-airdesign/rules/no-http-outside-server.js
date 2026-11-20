import { apiFile, isType, moduleVisitors, named, typeOnly } from "../module-reference.js"

const message =
  "Open a server only in apps/api/src/server.ts: add a row to its `routes` table, and use `import type` for the node:http types."
const modules = new Set(["http", "https", "node:http", "node:https"])

const requestFiles = new Set(["harness.ts", "image-fetch.ts"])

const requestOnly = (node) =>
  node.type === "ImportDeclaration" &&
  named(node, (specifier) => isType(specifier) || (specifier.imported?.name ?? specifier.imported?.value) === "request")

const rule = {
  meta: {
    type: "problem",
    docs: {
      description: "Reject loading node:http or node:https in apps/api/src outside server.ts.",
    },
  },
  create(context) {
    const file = apiFile(context)
    if (file === undefined || file === "server.ts") return {}
    return moduleVisitors((node, source) => {
      if (source !== undefined && !modules.has(source)) return
      if (source !== undefined && typeOnly(node)) return
      if (requestFiles.has(file) && requestOnly(node)) return
      context.report({ node, message })
    })
  },
}

export default rule
