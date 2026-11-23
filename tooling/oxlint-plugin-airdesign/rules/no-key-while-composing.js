const message =
  "Return early on `composing(event)` from apps/web/src/lib/composing.ts before reading Enter or Escape: an IME (Vietnamese Telex, Japanese, Chinese) commits its text with that Enter and cancels its conversion with that Escape, and Safari marks both only with keyCode 229."
const operators = new Set(["===", "!==", "==", "!="])
const functions = new Set(["FunctionDeclaration", "FunctionExpression", "ArrowFunctionExpression"])
const keyProperties = new Set(["key", "code", "keyCode", "which"])
const keyNames = new Set(["Enter", "NumpadEnter", "Escape"])
const keyCodes = new Set([13, 27])
const guardSource = "/lib/composing"

const filenameOf = (context) => String(context.filename ?? context.getFilename?.() ?? "").replaceAll("\\", "/")

const applies = (filename) =>
  filename.includes("/apps/web/src/") && !filename.includes(".test.") && !filename.includes(".spec.")

const keyLiteral = (node) =>
  node?.type === "Literal" && (keyNames.has(node.value) || (typeof node.value === "number" && keyCodes.has(node.value)))

const propertyName = (node) => {
  if (node?.type !== "MemberExpression") return undefined
  const property = node.property
  if (node.computed === true) return property?.type === "Literal" ? property.value : undefined
  return property?.type === "Identifier" ? property.name : undefined
}

const keyRead = (node) => keyProperties.has(propertyName(node))

const rootName = (node) => {
  let current = node
  while (current?.type === "MemberExpression") current = current.object
  return current?.type === "Identifier" ? current.name : undefined
}

const rangeOf = (node) => node.range ?? [node.start, node.end]

const enclosingFunction = (node) => {
  for (let parent = node.parent; parent; parent = parent.parent) if (functions.has(parent.type)) return parent
  return undefined
}

const contains = (outer, inner) => {
  const [from, to] = rangeOf(outer)
  const [at] = rangeOf(inner)
  return at >= from && at < to
}

const returnsEarly = (statement) => {
  if (statement?.type === "ReturnStatement" || statement?.type === "ThrowStatement") return true
  return (
    statement?.type === "BlockStatement" &&
    statement.body.some((inner) => inner.type === "ReturnStatement" || inner.type === "ThrowStatement")
  )
}

const disjuncts = (node) =>
  node?.type === "LogicalExpression" && node.operator === "||"
    ? [...disjuncts(node.left), ...disjuncts(node.right)]
    : [node]

const ifOf = (call) => {
  for (let parent = call.parent; parent; parent = parent.parent) {
    if (functions.has(parent.type)) return undefined
    if (parent.type === "IfStatement") return parent
    if (parent.type === "ExpressionStatement") return undefined
  }
  return undefined
}

const rule = {
  meta: {
    type: "problem",
    docs: { description: "Make every Enter or Escape check in apps/web return early while an IME composes." },
  },
  create(context) {
    if (!applies(filenameOf(context))) return {}
    const guardCalls = []
    const checks = []
    const aliases = []
    let imported = false
    let shadowed = false

    const alias = (name, owner, event) => aliases.push({ name, owner, event })

    const keyOperand = (node) => {
      if (keyRead(node)) return { event: rootName(node.object) }
      if (node?.type !== "Identifier") return undefined
      for (let owner = enclosingFunction(node); ; owner = enclosingFunction(owner)) {
        const match = aliases.find((entry) => entry.name === node.name && entry.owner === owner)
        if (match) return { event: match.event }
        if (owner === undefined) return undefined
      }
    }

    const record = (node, operand) => checks.push({ node, event: operand.event })

    const bindPattern = (pattern, init, owner) => {
      if (pattern?.type !== "ObjectPattern") return
      for (const property of pattern.properties) {
        if (property.type !== "Property" || property.key?.type !== "Identifier") continue
        if (!keyProperties.has(property.key.name)) continue
        const value = property.value?.type === "AssignmentPattern" ? property.value.left : property.value
        if (value?.type === "Identifier") alias(value.name, owner, init === undefined ? undefined : rootName(init))
      }
    }

    const declares = (identifier) => {
      if (identifier?.type === "Identifier" && identifier.name === "composing") shadowed = true
    }

    const visitFunction = (node) => {
      for (const param of node.params) {
        declares(param)
        bindPattern(param, undefined, node)
      }
    }

    return {
      ImportDeclaration(node) {
        if (!String(node.source.value).endsWith(guardSource)) return
        for (const specifier of node.specifiers)
          if (
            specifier.type === "ImportSpecifier" &&
            specifier.imported?.name === "composing" &&
            specifier.local?.name === "composing"
          )
            imported = true
      },
      VariableDeclarator(node) {
        declares(node.id)
        const owner = enclosingFunction(node)
        if (node.id?.type === "Identifier" && keyRead(node.init)) alias(node.id.name, owner, rootName(node.init.object))
        else bindPattern(node.id, node.init, owner)
      },
      FunctionDeclaration(node) {
        declares(node.id)
        visitFunction(node)
      },
      FunctionExpression: visitFunction,
      ArrowFunctionExpression: visitFunction,
      CallExpression(node) {
        const callee = node.callee
        if (callee?.type === "Identifier" && callee.name === "composing") guardCalls.push(node)
        if (propertyName(callee) === "includes" && callee.object?.type === "ArrayExpression") {
          const operand = keyOperand(node.arguments[0])
          if (operand && callee.object.elements.some(keyLiteral)) record(node, operand)
        }
      },
      BinaryExpression(node) {
        if (!operators.has(node.operator)) return
        const left = keyOperand(node.left)
        const right = keyOperand(node.right)
        if (left && keyLiteral(node.right)) record(node, left)
        else if (right && keyLiteral(node.left)) record(node, right)
      },
      SwitchCase(node) {
        const operand = keyOperand(node.parent?.discriminant)
        if (operand && keyLiteral(node.test)) record(node, operand)
      },
      "Program:exit"() {
        const guards = imported && !shadowed ? guardCalls : []
        for (const check of checks) {
          const owner = enclosingFunction(check.node)
          const [start] = rangeOf(check.node)
          const covered = guards.some((call) => {
            if (enclosingFunction(call) !== owner) return false
            if (check.event === undefined || rootName(call.arguments[0]) !== check.event) return false
            if (rangeOf(call)[0] >= start) return false
            const statement = ifOf(call)
            if (statement === undefined || !contains(statement.test, call)) return false
            if (!disjuncts(statement.test).includes(call) || !returnsEarly(statement.consequent)) return false
            const block = statement.parent
            if (block?.type !== "BlockStatement" && block?.type !== "Program") return false
            return contains(block, check.node)
          })
          if (!covered) context.report({ node: check.node, message })
        }
      },
    }
  },
}

export default rule
