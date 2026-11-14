import { decide, format, openRegister, type Command, type ElementPatch, type Register } from "@airdesign/document"
import { describe, expect, it } from "vitest"
import { exportParts } from "./export-parts.js"
import { indexPackage } from "./index-package.js"
import { shownLine } from "./line-read.js"
import { readParts } from "./package-container.js"
import { decodeUtf8 } from "./package-bytes.js"
import { readSlides } from "./read-shapes.js"

declare const process: {
  cwd(): string
  getBuiltinModule(name: "node:fs"): { readFileSync(path: string): Uint8Array }
}

type Parts = ReadonlyMap<string, Uint8Array>

const accent2 = { solid: { scheme: "accent2" } } as const
const every: ElementPatch = {
  line: {
    width: { set: 38100 },
    fill: { set: accent2 },
    dash: { set: "sysDot" },
    cap: { set: "rnd" },
    compound: { set: "dbl" },
    join: { set: "bevel" },
    head: { set: { type: "triangle", width: "lg", length: "lg" } },
    tail: { set: { type: "stealth", width: "sm", length: "med" } },
  },
}
const inherited: ElementPatch = {
  line: {
    width: "inherit",
    fill: "inherit",
    dash: "inherit",
    cap: "inherit",
    compound: "inherit",
    join: "inherit",
    head: "inherit",
    tail: "inherit",
  },
}

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

describe("exportParts on a line", () => {
  it("writes only the width into a shape whose line comes from its style, so the style still gives the rest", async () => {
    const parts = await deck("shapes-added.pptx")
    const rectangle = at(parts, 1, "4")
    const out = exported(parts, rectangle.node, { line: { width: { set: 38100 } } })
    const before = text(parts, rectangle.part)
    const after = text(out, rectangle.part)
    const own = '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:ln w="38100"/></p:spPr>'
    expect(after).toContain(own)
    expect(after.replace('<a:ln w="38100"/>', "")).toBe(before)
    expect(shownLine(out, rectangle)).toEqual({
      width: { value: 38100, own: true },
      fill: { value: { solid: { scheme: "accent1", transforms: [{ op: "shade", val: 15000 }] } }, own: false },
      dash: { value: "solid", own: false },
      cap: { value: null, own: false },
      compound: { value: "sng", own: false },
      join: { value: null, own: false },
      head: { value: { type: "none", width: "med", length: "med" }, own: false },
      tail: { value: { type: "none", width: "med", length: "med" }, own: false },
    })
  })

  it("writes every field into a new line in schema order and reads each back as own", async () => {
    const parts = await deck("clean.pptx")
    const shape = at(parts, 1, "2")
    const out = exported(parts, shape.node, every)
    expect(text(out, shape.part)).toContain(
      '<a:solidFill><a:schemeClr val="accent1"/></a:solidFill><a:ln w="38100" cap="rnd" cmpd="dbl"><a:solidFill><a:schemeClr val="accent2"/></a:solidFill><a:prstDash val="sysDot"/><a:bevel/><a:headEnd type="triangle" w="lg" len="lg"/><a:tailEnd type="stealth" w="sm" len="med"/></a:ln></p:spPr>',
    )
    const shown = shownLine(out, shape)
    expect(Object.values(shown ?? {}).every((each) => each.own)).toBe(true)
    expect(Object.fromEntries(Object.entries(shown ?? {}).map(([name, each]) => [name, { set: each.value }]))).toEqual(
      every.line,
    )
    expect(text(exported(parts, shape.node, inherited), shape.part)).toBe(text(parts, shape.part))
  })

  it("patches one attribute of a connector's own line and leaves every other byte", async () => {
    const parts = await deck("census-updating-spm.pptx")
    const connector = at(parts, 7, "26")
    const before = text(parts, connector.part)
    const dashed = text(exported(parts, connector.node, { line: { dash: { set: "lgDash" } } }), connector.part)
    expect(dashed).toBe(before.replace('<a:prstDash val="dash"/>', '<a:prstDash val="lgDash"/>'))
    const mitered = text(exported(parts, connector.node, { line: { join: { set: "miter" } } }), connector.part)
    expect(mitered).toBe(before.replace("<a:round/>", '<a:miter lim="800000"/>'))
    const out = exported(parts, connector.node, inherited)
    expect(text(out, connector.part)).toContain("<p:spPr><a:xfrm")
    expect(Object.values(shownLine(out, connector) ?? {}).some((each) => each.own)).toBe(false)
  })
})
