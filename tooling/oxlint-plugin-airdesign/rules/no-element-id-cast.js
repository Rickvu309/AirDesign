const message = "Call elementId or readElementId from @airdesign/document instead of casting to ElementId."
const arrayNames = new Set(["Array", "ReadonlyArray"])

const filenameOf = (context) => String(context.filename ?? context.getFilename?.() ?? "").replaceAll("\\", "/")

const applies = (filename) => !filename.includes("/packages/document/src/")

const referenceName = (typeName) => (typeName?.type === "TSQualifiedName" ? typeName.right?.name : typeName?.name)

const namesElementId = (type) => {
  switch (type?.type) {
    case "TSTypeReference": {
      const name = referenceName(type.typeName)
      if (name === "ElementId") return true
      return arrayNames.has(name) && namesElementId(type.typeArguments?.params?.[0])
    }
    case "TSArrayType":
      return namesElementId(type.elementType)
    case "TSTypeOperator":
    case "TSParenthesizedType":
      return namesElementId(type.typeAnnotation)
    case "TSUnionType":
      return type.types.some(namesElementId)
    default:
      return false
  }
}

const rule = {
  meta: {
    type: "problem",
    docs: {
      description: "Reject a type assertion to ElementId outside packages/document/src.",
    },
  },
  create(context) {
    if (!applies(filenameOf(context))) return {}
    const check = (node) => {
      if (namesElementId(node.typeAnnotation)) context.report({ node, message })
    }
    return { TSAsExpression: check, TSTypeAssertion: check }
  },
}

export default rule
