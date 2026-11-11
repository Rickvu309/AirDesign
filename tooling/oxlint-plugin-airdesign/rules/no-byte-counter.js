const message =
  "Count a value's bytes only with bytesOf from @airdesign/document, and compare the count against a row of its `limits` table."

const wrappers = new Set([
  "TSAsExpression",
  "TSSatisfiesExpression",
  "TSNonNullExpression",
  "TSTypeAssertion",
  "ParenthesizedExpression",
])
const sizes = new Set(["length", "byteLength"])
const widthBounds = new Set([0x7ff, 0x800])
const relations = new Set(["<", "<=", ">", ">="])
const textEncodings = new Set(["utf8", "utf-8"])

const exempt = (filename) =>
  /\/packages\/document\//u.test(filename) || /\.(test|spec|proof)\.[cm]?[jt]sx?$/u.test(filename)

const bare = (node) => (node && wrappers.has(node.type) ? bare(node.expression) : node)

const propertyName = (node) => (node.computed ? node.property.value : node.property.name)

const isNew = (node, name) => {
  const bareNode = bare(node)
  return bareNode?.type === "NewExpression" && bareNode.callee.type === "Identifier" && bareNode.callee.name === name
}

const memberCall = (node, objectName, method) => {
  const bareNode = bare(node)
  if (bareNode?.type !== "CallExpression" || bareNode.callee.type !== "MemberExpression") return undefined
  if (propertyName(bareNode.callee) !== method) return undefined
  const object = bare(bareNode.callee.object)
  if (objectName !== undefined && (object.type !== "Identifier" || object.name !== objectName)) return undefined
  return bareNode
}

const isNumber = (node) => node?.type === "Literal" && typeof node.value === "number"

const stringified = (node) => {
  const bareNode = bare(node)
  if (bareNode?.type === "Literal" && typeof bareNode.value === "string") return true
  if (bareNode?.type === "TemplateLiteral") return true
  return memberCall(bareNode, "JSON", "stringify") !== undefined
}

const onlyStatement = (node) => (node?.type === "BlockStatement" && node.body.length === 1 ? node.body[0] : node)

const addsNumber = (statement) => {
  const expression = statement?.type === "ExpressionStatement" ? statement.expression : undefined
  return expression?.type === "AssignmentExpression" && expression.operator === "+=" && isNumber(expression.right)
}

const rule = {
  meta: {
    type: "problem",
    docs: {
      description: "Reject counting a value's bytes by hand outside packages/document.",
    },
  },
  create(context) {
    const filename = String(context.filename ?? context.getFilename?.() ?? "").replaceAll("\\", "/")
    if (exempt(filename)) return {}
    const encoders = new Set()
    const encoded = new Set()
    const blobs = new Set()
    const pending = []
    const uses = new Map()
    const measured = new Map()

    const tally = (table, name) => table.set(name, (table.get(name) ?? 0) + 1)
    const onlyMeasured = (name) => (uses.get(name) ?? 0) === (measured.get(name) ?? 0)

    const encodes = (node) => {
      const call = memberCall(node, undefined, "encode")
      if (call === undefined) return false
      const object = bare(call.callee.object)
      return isNew(object, "TextEncoder") || (object.type === "Identifier" && encoders.has(object.name))
    }

    const bufferText = (node) => {
      const call = memberCall(node, "Buffer", "from")
      if (call === undefined) return false
      const encoding = bare(call.arguments[1])
      if (encoding?.type === "Literal" && textEncodings.has(String(encoding.value).toLowerCase())) return true
      return stringified(call.arguments[0])
    }

    const counts = (object, property) => {
      const bareObject = bare(object)
      if (sizes.has(property)) {
        if (encodes(bareObject) || bufferText(bareObject)) return true
        return bareObject.type === "Identifier" && encoded.has(bareObject.name) && onlyMeasured(bareObject.name)
      }
      if (property === "size") {
        if (isNew(bareObject, "Blob")) return true
        return bareObject.type === "Identifier" && blobs.has(bareObject.name)
      }
      return false
    }

    const widthTable = (node) => {
      const parent = node.parent
      if (parent?.type === "IfStatement" && parent.test === node) return addsNumber(onlyStatement(parent.consequent))
      if (parent?.type === "ConditionalExpression" && parent.test === node) return isNumber(bare(parent.consequent))
      return false
    }

    return {
      VariableDeclarator(node) {
        if (node.id.type === "ObjectPattern") {
          pending.push({
            node,
            check: () =>
              node.id.properties.some((item) => item.type === "Property" && counts(node.init, item.key.name)),
          })
          return
        }
        if (node.id.type !== "Identifier" || node.init == null) return
        if (isNew(node.init, "TextEncoder")) encoders.add(node.id.name)
        if (isNew(node.init, "Blob")) blobs.add(node.id.name)
        pending.push({
          node,
          check: () => {
            if (encodes(node.init) || bufferText(node.init)) encoded.add(node.id.name)
            return false
          },
        })
      },
      Identifier(node) {
        const parent = node.parent
        if (parent?.type === "MemberExpression" && parent.property === node && !parent.computed) return
        if (parent?.type === "Property" && parent.key === node && !parent.computed && !parent.shorthand) return
        if (parent?.type === "VariableDeclarator" && parent.id === node) return
        tally(uses, node.name)
      },
      MemberExpression(node) {
        const property = propertyName(node)
        if (typeof property !== "string") return
        const object = bare(node.object)
        if (sizes.has(property) && object.type === "Identifier") tally(measured, object.name)
        pending.push({ node, check: () => counts(node.object, property) })
      },
      CallExpression(node) {
        if (memberCall(node, "Buffer", "byteLength") !== undefined) context.report({ node, message })
      },
      BinaryExpression(node) {
        if (!relations.has(node.operator)) return
        const bound = [node.left, node.right].some((side) => isNumber(side) && widthBounds.has(side.value))
        if (bound && widthTable(node)) context.report({ node, message })
      },
      "Program:exit"() {
        const declarations = pending.filter((item) => item.node.type === "VariableDeclarator")
        for (const item of declarations) item.check()
        for (const item of pending) {
          if (item.node.type === "VariableDeclarator" && item.node.id.type !== "ObjectPattern") continue
          if (item.check()) context.report({ node: item.node, message })
        }
      },
    }
  },
}

export default rule
