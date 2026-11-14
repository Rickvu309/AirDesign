import { slideExportLines } from "../slide-export.mjs"

export const tableExportName = "exported-table.pptx"

const original = "blank.pptx"
const slidePart = "ppt/slides/slide1.xml"
const typed = [
  ["Region", "Sales", ""],
  ["", "", ""],
  ["", "", ""],
]

const words = (cell) => cell.map((paragraph) => paragraph.runs.map((run) => run.text).join("")).join("\n")

export default {
  specs: ["tests/browser/table-edits.spec.ts"],
  exports: [tableExportName],
  covers: ["table.value"],
  lines(answers) {
    const { pptx, parts } = answers
    const kept = [...(parts.get(original)?.keys() ?? [])].filter((name) => name !== slidePart)
    const lines = slideExportLines({ ...answers, original, exported: tableExportName, kept }).map((line) =>
      line.replace(/^slide export/, "table export"),
    )
    const exported = parts.get(tableExportName)
    const tables =
      exported === undefined ? [] : pptx.readShapes(exported).filter((shape) => shape.contentKind === "table")
    const [table] = tables
    if (tables.length !== 1 || table === undefined) return [...lines, `table export holds ${tables.length} tables`]
    const cells = pptx.readTable(exported, table.part, table.shape)?.rows.map((row) => row.cells.map(words))
    if (JSON.stringify(cells) !== JSON.stringify(typed)) lines.push(`table export cells ${JSON.stringify(cells)}`)
    return lines
  },
}
