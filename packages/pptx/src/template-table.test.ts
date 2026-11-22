import { expect, it } from "vitest"
import { decodeUtf8 } from "./package-bytes.js"
import { readParts } from "./package-container.js"
import { readSlides } from "./read-shapes.js"
import { applyStructuralRoute } from "./structural-route.js"
import { defaultTableStyle, officeTableStyle, tableCellLook } from "./table-style-list.js"

declare const process: {
  cwd(): string
  getBuiltinModule(name: "node:fs"): { readFileSync(path: string): Uint8Array }
}

async function deck(path: string) {
  const fs = process.getBuiltinModule("node:fs")
  return readParts(new Uint8Array(fs.readFileSync(`${process.cwd()}/${path}`)))
}

const box = { x: 609600, y: 1905000, cx: 10972800, cy: 3556000, rows: 2, columns: 2 }
const text = (bytes: Uint8Array | undefined) => decodeUtf8(bytes ?? new Uint8Array())

it.each(["neutral", "midnight", "editorial"])(
  "gives a new table in a %s deck the template's own table style and its Body 2 size",
  async (id) => {
    const parts = await deck(`packages/templates/files/${id}-start.pptx`)
    const style = defaultTableStyle(parts)
    expect(style).not.toBeNull()
    expect(style).not.toBe(officeTableStyle)
    const styles = text(parts.get("ppt/tableStyles.xml"))
    expect(styles).not.toContain("a:band1H")
    expect(styles).toContain("<a:fill><a:noFill/></a:fill>")
    expect(styles).toContain('<a:fontRef idx="major">')
    expect(tableCellLook(parts, style ?? "")).toEqual({ size: 1400, middle: true })
    const slide = readSlides(parts)[0]!.part
    const added = applyStructuralRoute(parts, { name: "graphicFrame.addTable", part: slide, id: 9, ...box })
    const frame = text(added.get(slide))
    expect(frame).toContain(`<a:tableStyleId>${style ?? ""}</a:tableStyleId>`)
    expect(frame.match(/<a:endParaRPr lang="en-US" sz="1400"\/>/g)).toHaveLength(4)
    expect(frame.match(/<a:tcPr anchor="ctr"\/>/g)).toHaveLength(4)
    expect(text(added.get("ppt/tableStyles.xml"))).toBe(styles)
  },
)

it("writes no size into a new table when the deck's table style names none", async () => {
  const parts = await deck("scripts/pptx-fixtures/blank.pptx")
  const slide = readSlides(parts)[0]!.part
  const added = applyStructuralRoute(parts, { name: "graphicFrame.addTable", part: slide, id: 9, ...box })
  expect(tableCellLook(added, officeTableStyle)).toBeNull()
  expect(text(added.get(slide)).match(/<a:tcPr\/>/g)).toHaveLength(4)
  expect(text(added.get(slide)).match(/<a:tc>.*?<a:endParaRPr lang="en-US"\/>/g)).toHaveLength(4)
})
