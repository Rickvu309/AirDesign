const message = "Compare a run id to the id stored on the node."
const operators = new Set(["===", "!==", "==", "!="])

const filenameOf = (context) => String(context.filename ?? context.getFilename?.() ?? "").replaceAll("\\", "/")

const applies = (filename) => {
  if (filename.includes(".test.")) return false
  return filename.includes("/packages/document/src/") || filename.includes("/packages/pptx/src/")
}

const stringLiteral = (node) => node?.type === "Literal" && typeof node.value === "string"

const runIdNode = (node) => {
  if (node?.type === "Identifier" && node.name === "runId") return true
  if (node?.type !== "MemberExpression" || node.computed === true) return false
  const property = node.property
  return property?.type === "Identifier" && property.name === "runId"
}

const rule = {
  meta: {
    type: "problem",
    docs: {
      description: "Reject a run id compared to a string literal outside tests.",
    },
  },
  create(context) {
    if (!applies(filenameOf(context))) return {}
    return {
      BinaryExpression(node) {
        if (!operators.has(node.operator)) return
        if (
          (runIdNode(node.left) && stringLiteral(node.right)) ||
          (runIdNode(node.right) && stringLiteral(node.left))
        ) {
          context.report({ node, message })
        }
      },
    }
  },
}

export default rule
