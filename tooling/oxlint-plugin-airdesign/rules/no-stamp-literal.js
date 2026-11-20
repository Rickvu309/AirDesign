const message = "Assert a stamp floor, an ordering, or a relation to format instead of equating it to a number."
const stampNames = new Set(["row", "index", "command"])
const equality = new Set(["toBe", "toEqual", "toStrictEqual", "toMatchObject"])

const keyOf = ({ computed, key }) =>
  key?.type === "Literal" ? key.value : !computed && key?.type === "Identifier" ? key.name : undefined

const memberOf = (node) =>
  node?.type === "MemberExpression" ? keyOf({ computed: node.computed, key: node.property }) : undefined

const identifier = (node) => (node?.type === "Identifier" ? node.name : undefined)
const numberLiteral = (node) => node?.type === "Literal" && typeof node.value === "number"
const properties = (node) => (node?.type === "ObjectExpression" ? node.properties : [])

const rule = {
  meta: {
    type: "problem",
    docs: {
      description: "Reject equality between a live document stamp or format and a numeric literal in tests.",
    },
  },
  create(context) {
    const filename = String(context.filename ?? context.getFilename?.() ?? "").replaceAll("\\", "/")
    if (!/(?:^|\/)(apps|packages)\/.*\.(test|spec)\.[cm]?[jt]sx?$/.test(filename)) return {}

    const stamps = new Set()
    const formats = new Set()
    const fromDocument = (source) =>
      source === "@airdesign/document" ||
      (filename.includes("/packages/document/src/") && (source === "./format.js" || source === "./index.js"))

    const isStamp = (node) => stampNames.has(memberOf(node)) && stamps.has(identifier(node.object))
    const pins = (actual, expected) => {
      if (numberLiteral(expected)) return isStamp(actual) || formats.has(identifier(actual))
      if (stamps.has(identifier(actual))) {
        return properties(expected).some((field) => stampNames.has(keyOf(field)) && numberLiteral(field.value))
      }
      return properties(expected).some((field) => {
        const name = keyOf(field)
        if (name === undefined) return false
        const match = properties(actual).find((candidate) => keyOf(candidate) === name)
        return match !== undefined && pins(match.value, field.value)
      })
    }

    return {
      ImportDeclaration(node) {
        if (!fromDocument(node.source.value)) return
        for (const { type, imported, local } of node.specifiers) {
          if (type !== "ImportSpecifier") continue
          if (imported.name === "stamps") stamps.add(local.name)
          if (imported.name === "format") formats.add(local.name)
        }
      },
      CallExpression(node) {
        if (!equality.has(memberOf(node.callee))) return
        const receiver = node.callee.object
        const assertion = memberOf(receiver) === "not" ? receiver.object : receiver
        if (assertion.type !== "CallExpression" || identifier(assertion.callee) !== "expect") return
        const [actual] = assertion.arguments
        const [expected] = node.arguments
        if (pins(actual, expected) || pins(expected, actual)) context.report({ node, message })
      },
    }
  },
}

export default rule
