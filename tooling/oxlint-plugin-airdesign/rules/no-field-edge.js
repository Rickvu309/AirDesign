const message =
  "Keep field edges in packages/theme/src/tokens.css; use Input/Textarea with layout and surface classes only, and aria-invalid for errors."
const edgeClass = /(?:^|:)(?:!?-?(?:border|ring|outline|shadow)(?:-|$)|\[(?:border|outline|box-shadow)(?:-|:))/
const edgeStyle = /^(?:border(?!Radius)|outline|boxShadow)/

const rule = {
  meta: {
    type: "problem",
    docs: { description: "Keep shared text field borders, focus and error edges under one owner." },
  },
  create(context) {
    const fields = new Set()
    const namespaces = new Set()
    const values = new Map()
    const elements = []
    const strings = (node, seen = new Set()) => {
      if (!node || typeof node !== "object" || seen.has(node)) return []
      seen.add(node)
      if (node.type === "Literal") return typeof node.value === "string" ? [node.value] : []
      if (node.type === "Identifier") return strings(values.get(node.name), seen)
      if (node.type === "TemplateElement") return [node.value.cooked ?? node.value.raw]
      return Object.entries(node).flatMap(([key, value]) =>
        key === "parent"
          ? []
          : Array.isArray(value)
            ? value.flatMap((item) => strings(item, seen))
            : strings(value, seen),
      )
    }
    const hasEdgeStyle = (node, seen = new Set()) => {
      if (!node || typeof node !== "object" || seen.has(node)) return false
      seen.add(node)
      if (node.type === "Identifier") return hasEdgeStyle(values.get(node.name), seen)
      if (node.type === "Property" && edgeStyle.test(node.key?.name ?? node.key?.value ?? "")) return true
      return Object.entries(node).some(
        ([key, value]) =>
          key !== "parent" &&
          (Array.isArray(value) ? value.some((item) => hasEdgeStyle(item, seen)) : hasEdgeStyle(value, seen)),
      )
    }
    return {
      ImportDeclaration(node) {
        if (!/\/components\/ui\/(?:input|textarea)$/.test(node.source.value)) return
        for (const specifier of node.specifiers) {
          if (specifier.type === "ImportNamespaceSpecifier") namespaces.add(specifier.local.name)
          if (specifier.type === "ImportSpecifier" && ["Input", "Textarea"].includes(specifier.imported.name)) {
            fields.add(specifier.local.name)
          }
        }
      },
      VariableDeclarator(node) {
        if (node.id.type === "Identifier") values.set(node.id.name, node.init)
      },
      JSXOpeningElement(node) {
        elements.push(node)
      },
      "Program:exit"() {
        for (const element of elements) {
          const name = element.name
          const field =
            fields.has(name.name) ||
            (name.type === "JSXMemberExpression" &&
              namespaces.has(name.object.name) &&
              ["Input", "Textarea"].includes(name.property.name))
          if (!field) continue
          for (const attribute of element.attributes) {
            const key = attribute.name?.name
            const competing =
              key === "data-focus-edge" ||
              key === "data-slot" ||
              (key === "className" &&
                strings(attribute.value).some((text) => text.split(/\s+/).some((token) => edgeClass.test(token)))) ||
              (key === "style" && hasEdgeStyle(attribute.value))
            if (competing) context.report({ node: attribute, message })
          }
        }
      },
    }
  },
}

export default rule
