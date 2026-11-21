const folder = "../../packages/templates/files/"

export const templateExports = ["neutral", "midnight", "editorial"].flatMap((id) => [
  { original: `${id}.pptx`, exported: `exported-template-${id}.pptx`, slides: 6 },
  { original: `${id}-start.pptx`, exported: `exported-template-${id}-start.pptx`, slides: 1 },
])

export default {
  specs: ["tests/browser/deck-templates.spec.ts"],
  exports: templateExports.map((each) => each.exported),
  originals: templateExports.map((each) => `${folder}${each.original}`),
  cases: templateExports.map((each) => ({
    name: each.exported.slice(0, -5),
    before: `${folder}${each.original}`,
    after: each.exported,
    visible: true,
    targeted: [],
    errors: 0,
    dupes: 0,
    pages: true,
  })),
  renders: templateExports.flatMap((each) => [`${folder}${each.original}`, each.exported]),
  lines(answers) {
    return templateExports.flatMap((each) => {
      const before = answers.parts.get(`${folder}${each.original}`)
      const after = answers.parts.get(each.exported)
      if (before === undefined || after === undefined) return [`${each.original} export missing`]
      const changed = [...new Set([...before.keys(), ...after.keys()])].filter(
        (name) => !Buffer.from(before.get(name) ?? []).equals(Buffer.from(after.get(name) ?? [])),
      )
      const errors = [
        ...(answers.lists.get(`${folder}${each.original}`) ?? []),
        ...(answers.lists.get(each.exported) ?? []),
      ]
      return [
        ...(changed.length === 0 ? [] : [`${each.original} export changed ${changed.join(", ")}`]),
        ...errors.map((error) => `${each.original} validator ${error}`),
      ]
    })
  },
}
