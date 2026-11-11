const loaders = new Set(["require", "getBuiltinModule"])
const wrappers = new Set([
  "TSAsExpression",
  "TSSatisfiesExpression",
  "TSNonNullExpression",
  "TSTypeAssertion",
  "ParenthesizedExpression",
])

export const apiFile = (context) =>
  /\/apps\/api\/src\/(.+)$/u.exec(String(context.filename ?? context.getFilename?.() ?? "").replaceAll("\\", "/"))?.[1]

export const outer = (node) => (wrappers.has(node.parent?.type) ? outer(node.parent) : node)

export const staticText = (node) => {
  if (node?.type === "Literal" && typeof node.value === "string") return node.value
  if (node?.type === "TemplateLiteral" && node.expressions.length === 0) return node.quasis[0].value.cooked
  return undefined
}

export const isType = (node) => node.importKind === "type" || node.exportKind === "type"

export const named = (node, accept) => node.specifiers?.length > 0 && node.specifiers.every(accept)

export const typeOnly = (node) => isType(node) || named(node, isType)

const loaderName = (callee) => (callee.type === "MemberExpression" ? callee.property.name : callee.name)

export const moduleVisitors = (reference) => ({
  ImportDeclaration: (node) => reference(node, node.source.value),
  ExportAllDeclaration: (node) => reference(node, node.source.value),
  ExportNamedDeclaration: (node) => {
    if (node.source) reference(node, node.source.value)
  },
  TSImportEqualsDeclaration: (node) => {
    if (node.moduleReference.type === "TSExternalModuleReference")
      reference(node, staticText(node.moduleReference.expression))
  },
  ImportExpression: (node) => reference(node, staticText(node.source)),
  CallExpression: (node) => {
    if (loaders.has(loaderName(node.callee))) reference(node, staticText(node.arguments[0]))
  },
})
