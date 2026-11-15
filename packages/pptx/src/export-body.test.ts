import { decide, format, openRegister, type Command, type ElementPatch, type Register } from "@airdesign/document"
import { describe, expect, it } from "vitest"
import { exportParts } from "./export-parts.js"
import { indexPackage } from "./index-package.js"
import { shownBody } from "./body-read.js"
import { readParts } from "./package-container.js"
import { decodeUtf8 } from "./package-bytes.js"
import { readSlides } from "./read-shapes.js"

declare const process: {
  cwd(): string
  getBuiltinModule(name: "node:fs"): { readFileSync(path: string): Uint8Array }
}

type Parts = ReadonlyMap<string, Uint8Array>

async function deck(name: string): Promise<Parts> {
  const fs = process.getBuiltinModule("node:fs")
  return readParts(new Uint8Array(fs.readFileSync(`${process.cwd()}/scripts/pptx-fixtures/${name}`)))
}

function at(parts: Parts, slide: number, shape: string) {
  const read = readSlides(parts)[slide - 1]
  if (read === undefined) throw new Error("slide")
  const element = indexPackage(parts).elements.find((each) => each.node === `${read.slide}.${shape}`)
  if (element === undefined) throw new Error("element")
  return { node: element.node, part: read.part, shape }
}

function exported(parts: Parts, node: ReturnType<typeof at>["node"], patch: ElementPatch): Parts {
  const index = indexPackage(parts)
  const opened: Register = {
    ...openRegister("", "clean"),
    index: { ...index, total: index.elements.length, pages: [] },
  }
  const commands: readonly Command[] = [
    { command: "add", node, floor: "", route: "clean" },
    { command: "person", node, v: format, patch },
  ]
  const register = commands.reduce((current, command) => {
    const decision = decide(current, command)
    if (decision.decision === "refuse") throw new Error(decision.code)
    return decision.register
  }, opened)
  return exportParts(parts, register)
}

function text(parts: Parts, part: string): string {
  return decodeUtf8(parts.get(part)!)
}

const every: ElementPatch = {
  body: {
    insets: { set: { left: 0, top: 12700, right: 25400, bottom: 38100 } },
    anchor: { set: "b" },
    wrap: { set: false },
    autofit: { set: "shrink" },
    vertical: { set: "vert270" },
    columns: { set: 2 },
  },
}
const inherited: ElementPatch = {
  body: {
    insets: "inherit",
    anchor: "inherit",
    wrap: "inherit",
    autofit: "inherit",
    vertical: "inherit",
    columns: "inherit",
  },
}

describe("exportParts on a text box's body", () => {
  it("writes every field into an empty body and reads each back as own, and inherit puts the bytes back", async () => {
    const parts = await deck("clean.pptx")
    const shape = at(parts, 1, "2")
    const out = exported(parts, shape.node, every)
    expect(text(out, shape.part)).toContain(
      '<a:bodyPr lIns="0" tIns="12700" rIns="25400" bIns="38100" anchor="b" wrap="none" vert="vert270" numCol="2"><a:normAutofit/></a:bodyPr>',
    )
    const shown = shownBody(out, shape)
    expect(Object.values(shown ?? {}).every((each) => each.own)).toBe(true)
    expect(Object.fromEntries(Object.entries(shown ?? {}).map(([name, each]) => [name, { set: each.value }]))).toEqual(
      every.body,
    )
    expect(text(exported(parts, shape.node, inherited), shape.part)).toBe(text(parts, shape.part))
  })

  it("reads what an empty body shows from PowerPoint's own defaults", async () => {
    const parts = await deck("clean.pptx")
    expect(shownBody(parts, at(parts, 1, "2"))).toEqual({
      insets: { value: { left: 91440, top: 45720, right: 91440, bottom: 45720 }, own: false },
      anchor: { value: "t", own: false },
      wrap: { value: true, own: false },
      autofit: { value: "none", own: false },
      vertical: { value: "horz", own: false },
      columns: { value: 1, own: false },
    })
  })

  it("patches one attribute or the autofit child of a body it owns and leaves every other byte", async () => {
    const parts = await deck("doe-heat-pumps.pptx")
    const box = at(parts, 7, "15")
    const before = text(parts, box.part)
    const frame = '<a:bodyPr wrap="square" lIns="91440" tIns="45720" rIns="91440" bIns="45720" rtlCol="0" anchor="t">'
    const own = before.indexOf(frame, before.indexOf('<p:cNvPr id="15"'))
    const swapped = (from: string, to: string) => before.slice(0, own) + before.slice(own).replace(from, to)
    const anchored = text(exported(parts, box.node, { body: { anchor: { set: "ctr" } } }), box.part)
    expect(anchored).toBe(swapped(frame, frame.replace('anchor="t"', 'anchor="ctr"')))
    const shrunk = text(exported(parts, box.node, { body: { autofit: { set: "shrink" } } }), box.part)
    expect(shrunk).toBe(swapped(`${frame}<a:spAutoFit/>`, `${frame}<a:normAutofit/>`))
    const same = text(exported(parts, box.node, { body: { autofit: { set: "grow" } } }), box.part)
    expect(same).toBe(before)
  })

  it("writes nothing for a field whose inherited value already shows it", async () => {
    const parts = await deck("clean.pptx")
    const shape = at(parts, 1, "2")
    const out = exported(parts, shape.node, { body: { anchor: { set: "t" }, columns: { set: 1 } } })
    expect(text(out, shape.part)).toBe(text(parts, shape.part))
  })
})
