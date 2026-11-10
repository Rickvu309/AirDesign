const clockMessage = "Take the time as a `now` option, the way `ApiOptions.now` in apps/api/src/server.ts does."
const randomMessage = "Take randomness as an option, the way `ApiOptions.mint` in apps/api/src/server.ts does."
const folderMessage = "Take the folder as an option. A shared temp folder leaks between runs."

const members = {
  "Date.now": clockMessage,
  "performance.now": clockMessage,
  "Temporal.Now": clockMessage,
  "Math.random": randomMessage,
  "crypto.randomUUID": randomMessage,
  "crypto.getRandomValues": randomMessage,
  "env.TMPDIR": folderMessage,
}
const imports = {
  randomUUID: randomMessage,
  getRandomValues: randomMessage,
  tmpdir: folderMessage,
}
const modules = new Set(["os", "node:os", "crypto", "node:crypto"])

const filenameOf = (context) => String(context.filename ?? context.getFilename?.() ?? "").replaceAll("\\", "/")

const applies = (filename) => {
  if (filename.includes(".test.") || filename.includes(".spec.")) return false
  return /\/(?:packages|apps)\/[^/]+\/(?:src|worker)\//u.test(filename)
}

const keyName = (node, computed) => {
  if (!computed && node?.type === "Identifier") return node.name
  if (computed && node?.type === "Literal" && typeof node.value === "string") return node.value
  return undefined
}

const nameOf = (node) => {
  if (node?.type === "Identifier") return node.name
  if (node?.type === "MemberExpression") return keyName(node.property, node.computed === true)
  return undefined
}

const seam = (node) => {
  const parent = node.parent
  if (parent?.type === "LogicalExpression") return parent.operator === "??" && parent.right === node
  return parent?.type === "AssignmentPattern" && parent.right === node
}

const rule = {
  meta: {
    type: "problem",
    docs: {
      description: "Reject reading the clock, randomness or the shared temp folder in product code.",
    },
  },
  create(context) {
    if (!applies(filenameOf(context))) return {}
    const imported = new Map()
    const report = (node, message) => {
      if (!seam(node)) context.report({ node, message })
    }
    return {
      ImportDeclaration(node) {
        if (!modules.has(node.source.value)) return
        for (const specifier of node.specifiers) {
          const name = specifier.type === "ImportSpecifier" ? nameOf(specifier.imported) : undefined
          if (name !== undefined && imports[name] !== undefined) imported.set(specifier.local.name, imports[name])
        }
      },
      Identifier(node) {
        const message = imported.get(node.name)
        if (message === undefined) return
        const parent = node.parent
        if (parent?.type === "ImportSpecifier") return
        if (parent?.type === "MemberExpression" && parent.property === node && parent.computed !== true) return
        if (parent?.type === "Property" && parent.key === node && parent.value !== node) return
        report(node, message)
      },
      MemberExpression(node) {
        const property = keyName(node.property, node.computed === true)
        if (property === "tmpdir") return report(node, folderMessage)
        const message = members[`${nameOf(node.object)}.${property}`]
        if (message !== undefined) report(node, message)
      },
      VariableDeclarator(node) {
        if (node.id?.type !== "ObjectPattern") return
        const object = nameOf(node.init)
        for (const property of node.id.properties) {
          const message = members[`${object}.${keyName(property.key, property.computed === true)}`]
          if (message !== undefined) context.report({ node: property, message })
        }
      },
      CallExpression(node) {
        if (nameOf(node.callee) === "Date") context.report({ node, message: clockMessage })
      },
      NewExpression(node) {
        if (nameOf(node.callee) === "Date" && node.arguments.length === 0)
          context.report({ node, message: clockMessage })
      },
    }
  },
}

export default rule
