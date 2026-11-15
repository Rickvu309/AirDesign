import { slideExportLines } from "../slide-export.mjs"

export const tableExportName = "exported-table.pptx"
export const tableCellsExportName = "exported-table-cells.pptx"
export const tableResizedExportName = "exported-table-resized.pptx"

const original = "blank.pptx"
const cellsOriginal = "table-added.pptx"
const slidePart = "ppt/slides/slide1.xml"
const styledParts = [slidePart, "[Content_Types].xml", "ppt/_rels/presentation.xml.rels"]
const office = "{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}"
const typed = [
  ["Region", "Sales", ""],
  ["", "", ""],
  ["", "", ""],
]
const accent1 = { solid: { scheme: "accent1" } }
const accent2 = { solid: { scheme: "accent2" } }
const thin = { width: 12700, fill: accent1 }
const opening = { width: 12700, fill: { solid: { scheme: "tx1" } } }
const cellsWanted = [
  [accent1, {}],
  [accent2, { bottom: thin }],
  [null, { top: thin }],
]

const words = (cell) => cell.map((paragraph) => paragraph.runs.map((run) => run.text).join("")).join("\n")

function keptLines(answers, before, after, name, changed = [slidePart]) {
  const kept = [...(answers.parts.get(before)?.keys() ?? [])].filter((part) => !changed.includes(part))
  return slideExportLines({ ...answers, original: before, exported: after, kept }).map((line) =>
    line.replace(/^slide export/, name),
  )
}

function onlyTable(pptx, exported, name) {
  const tables =
    exported === undefined ? [] : pptx.readShapes(exported).filter((shape) => shape.contentKind === "table")
  return tables.length === 1 ? { table: tables[0], lines: [] } : { lines: [`${name} holds ${tables.length} tables`] }
}

function cellLines(pptx, exported) {
  const found = onlyTable(pptx, exported, "table cells export")
  if (found.table === undefined) return found.lines
  const read = pptx.readCells(exported, found.table.part, found.table.shape)
  const lines = []
  read.forEach((row, at) => {
    const [fill, sides] = cellsWanted[at] ?? []
    const { bottom = opening, top = opening } = sides ?? {}
    const wanted = { left: opening, right: opening, top, bottom }
    for (const [column, cell] of row.entries()) {
      if (JSON.stringify(cell.fill) !== JSON.stringify(fill))
        lines.push(`table cells export row ${at} column ${column} fill ${JSON.stringify(cell.fill)}`)
      for (const side of ["left", "right", "top", "bottom"])
        if (JSON.stringify(cell.borders[side]) !== JSON.stringify(wanted[side]))
          lines.push(`table cells export row ${at} column ${column} ${side} ${JSON.stringify(cell.borders[side])}`)
    }
  })
  return lines
}

function styledLines(exported, name) {
  const decoded = (part) => new TextDecoder().decode(exported?.get(part) ?? new Uint8Array())
  const lines = []
  if (!decoded(slidePart).includes(`<a:tableStyleId>${office}</a:tableStyleId>`))
    lines.push(`${name} table has no default table style`)
  if (
    !decoded("ppt/tableStyles.xml").includes(`<a:tblStyle styleId="${office}" styleName="Medium Style 2 - Accent 1">`)
  )
    lines.push(`${name} does not define the default table style`)
  return lines
}

function sizedLines(pptx, exported) {
  const found = onlyTable(pptx, exported, "table resize export")
  if (found.table === undefined) return found.lines
  const xml = new TextDecoder().decode(exported.get(found.table.part))
  const sum = (pattern) => [...xml.matchAll(pattern)].reduce((total, match) => total + Number(match[1]), 0)
  const { cx, cy } = found.table.box ?? { cx: -1, cy: -1 }
  const lines = []
  if (sum(/<a:gridCol w="(\d+)"/g) !== cx) lines.push(`table resize export columns do not add up to ${cx}`)
  if (sum(/<a:tr h="(\d+)"/g) !== cy) lines.push(`table resize export rows do not add up to ${cy}`)
  return lines
}

export default {
  specs: [
    "tests/browser/table-edits.spec.ts",
    "tests/browser/table-cells.spec.ts",
    "tests/browser/gesture-size.spec.ts",
  ],
  exports: [tableExportName, tableCellsExportName, tableResizedExportName],
  originals: [cellsOriginal],
  covers: ["table.value"],
  lines(answers) {
    const { pptx, parts } = answers
    const lines = keptLines(answers, original, tableExportName, "table export", styledParts)
    const exported = parts.get(tableExportName)
    lines.push(...styledLines(exported, "table export"))
    const found = onlyTable(pptx, exported, "table export")
    lines.push(...found.lines)
    if (found.table !== undefined) {
      const cells = pptx
        .readTable(exported, found.table.part, found.table.shape)
        ?.rows.map((row) => row.cells.map(words))
      if (JSON.stringify(cells) !== JSON.stringify(typed)) lines.push(`table export cells ${JSON.stringify(cells)}`)
    }
    lines.push(...keptLines(answers, cellsOriginal, tableCellsExportName, "table cells export"))
    lines.push(...cellLines(pptx, parts.get(tableCellsExportName)))
    lines.push(...keptLines(answers, original, tableResizedExportName, "table resize export", styledParts))
    lines.push(...styledLines(parts.get(tableResizedExportName), "table resize export"))
    lines.push(...sizedLines(pptx, parts.get(tableResizedExportName)))
    return lines
  },
}
