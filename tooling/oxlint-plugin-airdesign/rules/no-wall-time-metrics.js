const message =
  'Read the page\'s engine metrics in thread time: send("Performance.enable", { timeDomain: "threadTicks" }). In wall time, a busy machine counts the time other processes hold the core as the page\'s work.'

const propertyName = (node) =>
  node?.type === "Identifier" ? node.name : node?.type === "Literal" ? String(node.value) : undefined

const stringOf = (node) => {
  if (node?.type === "Literal" && typeof node.value === "string") return node.value
  if (node?.type === "TemplateLiteral" && node.expressions.length === 0) return node.quasis[0]?.value.cooked
  return undefined
}

const inThreadTime = (options) =>
  options?.type === "ObjectExpression" &&
  options.properties.some(
    (property) =>
      property.type === "Property" &&
      propertyName(property.key) === "timeDomain" &&
      stringOf(property.value) === "threadTicks",
  )

const rule = {
  meta: {
    type: "problem",
    docs: {
      description: "Refuse Performance.enable over the DevTools protocol unless it reads metrics in thread time.",
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        const callee = node.callee
        if (callee.type !== "MemberExpression" || callee.computed || propertyName(callee.property) !== "send") return
        if (stringOf(node.arguments[0]) !== "Performance.enable") return
        if (!inThreadTime(node.arguments[1])) context.report({ node, message })
      },
    }
  },
}

export default rule
