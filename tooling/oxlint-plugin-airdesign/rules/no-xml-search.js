const message = "Use the markup tokenizer instead of searching XML."
const methods = new Set(["indexOf", "lastIndexOf", "search", "matchAll"])

const filenameOf = (context) => String(context.filename ?? context.getFilename?.() ?? "").replaceAll("\\", "/")

const applies = (filename) => {
  if (!filename.includes("/packages/pptx/src/")) return false
  if (filename.endsWith("/element-span.ts")) return false
  if (filename.endsWith(".test.ts")) return false
  return true
}

const hasMarkup = (value) => typeof value === "string" && value.includes("<")

const literalMarkup = (node) => {
  if (node === undefined || node === null) return false
  if (node.type === "Literal") return hasMarkup(node.value)
  if (node.type === "TemplateLiteral") return node.quasis.some((piece) => hasMarkup(piece.value?.raw))
  return false
}

const patternMarkup = (node) => {
  if (node === undefined || node === null) return false
  if (node.type === "Literal" && node.regex) return hasMarkup(node.regex.pattern)
  if (node.type === "RegExpLiteral" || node.type === "Literal") return hasMarkup(node.regex?.pattern)
  return false
}

const xmlReceiver = (node) => node?.type === "Identifier" && /xml/i.test(node.name)

const propertyName = (property) => {
  if (property?.type === "Identifier") return property.name
  if (property?.type === "Literal") return property.value
  return null
}

const rule = {
  meta: {
    type: "problem",
    docs: {
      description: "Reject string and regex searches of XML outside the markup tokenizer.",
    },
  },
  create(context) {
    if (!applies(filenameOf(context))) return {}
    return {
      CallExpression(node) {
        const callee = node.callee
        if (callee?.type !== "MemberExpression" || callee.computed === true) return
        const name = propertyName(callee.property)
        if (!methods.has(name)) return
        const argument = node.arguments?.[0]
        if (literalMarkup(argument) || patternMarkup(argument) || xmlReceiver(callee.object)) {
          context.report({ node, message })
        }
      },
      Literal(node) {
        if (patternMarkup(node)) context.report({ node, message })
      },
      NewExpression(node) {
        const callee = node.callee
        if (callee?.type !== "Identifier" || callee.name !== "RegExp") return
        if (literalMarkup(node.arguments?.[0]) || patternMarkup(node.arguments?.[0])) context.report({ node, message })
      },
    }
  },
}

export default rule
