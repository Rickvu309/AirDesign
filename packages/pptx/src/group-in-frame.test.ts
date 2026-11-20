import {
  changeLayout,
  decide,
  elementId,
  format,
  openRegister,
  planChange,
  readLayout,
  registerScope,
  shownPlace,
  slideId,
  type ElementId,
  type ElementPatch,
  type Place,
  type Register,
  type SetChange,
} from "@airdesign/document"
import { describe, expect, it } from "vitest"
import { exportParts, indexPackage, orderedParts, paintReader, readParts, type PaintBox } from "./index.js"

declare const process: {
  cwd(): string
  getBuiltinModule(name: "node:fs"): { readFileSync(path: string): Uint8Array }
}

const part = "ppt/slides/slide1.xml"
const fs = process.getBuiltinModule("node:fs")
const parts = await readParts(
  new Uint8Array(fs.readFileSync(`${process.cwd()}/scripts/pptx-fixtures/nested-groups.pptx`)),
)
const { slides, elements: read } = indexPackage(parts)
const slide = slideId(slides[0]?.id ?? "")
const node = (id: number) => elementId(`${slide}.${id}`)
const turned = { "box.rot": [30], "box.flipH": [true] } as const
const elements = read.map((element) => (element.node === node(3) ? { ...element, design: turned } : element))
const opened: Register = {
  ...openRegister("", ""),
  index: { format: 2, total: elements.length, slides, elements, pages: [] },
}

function landed(register: Register, at: ElementId, patch: ElementPatch): Register {
  let current = register
  if (!current.nodes.includes(at)) {
    const added = decide(current, { command: "add", node: at, floor: "", route: "" })
    if (added.decision !== "apply") throw new Error(added.code)
    current = added.register
  }
  const decision = decide(current, { command: "person", node: at, v: format, patch })
  if (decision.decision !== "apply") throw new Error(decision.code)
  return decision.register
}

function planned(register: Register, change: SetChange): Register {
  const plan = planChange(change, registerScope(register))
  if (!plan.ok) throw new Error(JSON.stringify(plan.refusals))
  return plan.rows.reduce((current, row) => landed(current, row.node, row.row.patch), register)
}

const exported = (register: Register) => exportParts(orderedParts(parts, register), register)

function painted(shown: ReadonlyMap<string, Uint8Array>, id: number): PaintBox {
  const box = paintReader(shown)
    .slide(part)
    .elements.find((each) => each.shape === String(id))?.box
  if (box === undefined || box === null) throw new Error(`paint ${id}`)
  return box
}

function near(left: PaintBox, right: Place | null) {
  for (const [side, key] of [
    ["x", "x"],
    ["y", "y"],
    ["width", "cx"],
    ["height", "cy"],
  ] as const)
    expect(Math.abs(left[side] - (right?.box[key] ?? Number.NaN))).toBeLessThan(3)
}

describe("a layer inside a turned group inside a scaled group inside an auto layout frame", () => {
  const made = changeLayout(opened, { wrap: [node(2), node(7)], slide, node: node(20), backdrop: node(21) })
  if (made === null || !("slide" in made)) throw new Error("wrap")
  const decision = decide(opened, { command: "slide", file: [slide], edit: made.slide })
  if (decision.decision !== "apply") throw new Error(decision.code)
  const wrapped = decision.register

  it("paints where the document shows it, before and after it moves out past its group's edge", () => {
    const before = exported(wrapped)
    for (const id of [4, 5, 6]) near(painted(before, id), shownPlace(wrapped, node(id)))
    const shown = shownPlace(wrapped, node(4))
    const moved = planned(wrapped, { target: { node: node(4) }, box: { y: (shown?.box.y ?? 0) + 2_000_000 } })
    expect(shownPlace(moved, node(4))?.box.y).toBeGreaterThan((shown?.box.y ?? 0) + 1_900_000)
    const after = exported(moved)
    for (const id of [4, 5, 6]) near(painted(after, id), shownPlace(moved, node(id)))
    const laid = readLayout(moved, node(20))?.children.find((child) => child.node === node(7))?.box
    near(painted(after, 7), laid === undefined ? null : { box: laid, rot: 0, flipH: false, flipV: false })
    expect(painted(after, 2).height).toBeGreaterThan(painted(before, 2).height)
  })
})
