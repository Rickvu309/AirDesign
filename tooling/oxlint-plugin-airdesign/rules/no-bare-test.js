const message =
  'Import test from "./deck-test" (or "./api-stack" for a spec that needs the stack), not from "@playwright/test". Only that test attaches deck-state.json when a browser test fails; keep expect and the types from "@playwright/test".'

const filenameOf = (context) => String(context.filename ?? context.getFilename?.() ?? "").replaceAll("\\", "/")

const applies = (filename) => /\/tests\/browser\/[^/]+\.spec\.ts$/u.test(filename)

const importedName = (specifier) =>
  specifier.type === "ImportSpecifier"
    ? (specifier.imported?.name ?? specifier.imported?.value)
    : specifier.type === "ImportDefaultSpecifier"
      ? "default"
      : undefined

const rule = {
  meta: {
    type: "problem",
    docs: {
      description: "In tests/browser specs, take test from deck-test or api-stack, never from @playwright/test.",
    },
  },
  create(context) {
    if (!applies(filenameOf(context))) return {}
    return {
      ImportDeclaration(node) {
        if (node.source.value !== "@playwright/test" || node.importKind === "type") return
        for (const specifier of node.specifiers)
          if (specifier.importKind !== "type" && importedName(specifier) === "test")
            context.report({ node: specifier, message })
      },
    }
  },
}

export default rule
