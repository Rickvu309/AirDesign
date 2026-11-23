const message =
  "Return early on `composing(event)` from apps/web/src/lib/composing.ts before reading Enter: an IME (Vietnamese Telex, Japanese, Chinese) commits its text with that Enter, and Safari marks it only with keyCode 229."
const operators = new Set(["===", "!==", "==", "!="])
const functions = new Set(["FunctionDeclaration", "FunctionExpression", "ArrowFunctionExpression"])

const filenameOf = (context) => String(context.filename ?? context.getFilename?.() ?? "").replaceAll("\\", "/")

const applies = (filename) =>
  filename.includes("/apps/web/src/") && !filename.includes(".test.") && !filename.includes(".spec.")

const enterLiteral = (node) => node?.type === "Literal" && (node.value === "Enter" || node.value === "NumpadEnter")

const keyRead = (node) => {
  if (node?.type !== "MemberExpression") return false
  const property = node.property
  if (node.computed === true)
    return property?.type === "Literal" && (property.value === "key" || property.value === "code")
  return property?.type === "Identifier" && (property.name === "key" || property.name === "code")
}

const rangeOf = (node) => node.range ?? [node.start, node.end]

const enclosingFunction = (node) => {
  for (let parent = node.parent; parent; parent = parent.parent) if (functions.has(parent.type)) return parent
  return undefined
}

const rule = {
  meta: {
    type: "problem",
    docs: { description: "Make every Enter check in apps/web return early while an IME composes." },
  },
  create(context) {
    if (!applies(filenameOf(context))) return {}
    const guards = []
    const checks = []
    return {
      CallExpression(node) {
        if (node.callee?.type === "Identifier" && node.callee.name === "composing") guards.push(rangeOf(node))
      },
      BinaryExpression(node) {
        if (!operators.has(node.operator)) return
        if ((keyRead(node.left) && enterLiteral(node.right)) || (keyRead(node.right) && enterLiteral(node.left)))
          checks.push(node)
      },
      SwitchCase(node) {
        if (enterLiteral(node.test) && keyRead(node.parent?.discriminant)) checks.push(node)
      },
      "Program:exit"() {
        for (const check of checks) {
          const owner = enclosingFunction(check)
          const [start] = rangeOf(check)
          const [from, to] = owner === undefined ? [0, start] : rangeOf(owner)
          const guarded = guards.some(([at]) => at >= from && at < to && at < start)
          if (!guarded) context.report({ node: check, message })
        }
      },
    }
  },
}

export default rule
