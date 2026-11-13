import { elementOrderLines } from "../element-order-export.mjs"
import { slideExportLines } from "../slide-export.mjs"

export const elementOrderExportName = "exported-element-order.pptx"

export default {
  specs: ["tests/browser/element-order.spec.ts"],
  exports: [elementOrderExportName],
  renders: [elementOrderExportName],
  lines(answers) {
    const kept = [...(answers.parts.get("blank.pptx")?.keys() ?? [])].filter((name) => name !== "ppt/slides/slide1.xml")
    return [
      ...slideExportLines({ ...answers, original: "blank.pptx", exported: elementOrderExportName, kept }).map((line) =>
        line.replace(/^slide export/, "element order"),
      ),
      ...elementOrderLines(answers),
    ]
  },
}
