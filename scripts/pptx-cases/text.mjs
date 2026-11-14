export const textExportName = "exported-deck.pptx"

const shape = "2"
const text = "Hello!"

export default {
  specs: ["tests/browser/thin-deck.spec.ts"],
  exports: [textExportName],
  covers: ["text.value"],
  cases: [
    {
      name: "browser-text-export",
      before: "clean.pptx",
      after: textExportName,
      visible: true,
      targeted: [1],
      errors: 0,
      dupes: 0,
      pages: true,
    },
  ],
  renders: [textExportName],
  lines: ({ pptx, parts }) => {
    const clean = parts.get("clean.pptx")
    const exported = parts.get(textExportName)
    if (clean === undefined || exported === undefined) throw new Error("browser export")
    return pptx.browserExportFailures(clean, exported, shape, text)
  },
}
