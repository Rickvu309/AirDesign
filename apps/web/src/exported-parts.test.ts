import { decide, elementId, openRegister, writeTextValue } from "@airdesign/document"
import { expect, it } from "vitest"
import { exportedParts } from "./exported-parts"
import { editedRegister, fallbackSlide, onSlide, twoBoxSlide, xml } from "./slide-fixtures"

it("an export skips an element whose only rows were undone", () => {
  const parts = onSlide(xml(twoBoxSlide))
  const node = elementId("256.2")
  let register = openRegister("", "clean")
  for (const command of [
    { command: "add", node, floor: "", route: "clean" },
    { command: "start", node, runId: "run" },
    { command: "agent", node, runId: "run", readAt: 0, value: "gone" },
    { command: "undo", node, runId: "run" },
  ] as const) {
    const decision = decide(register, command)
    if (decision.decision === "refuse") throw new Error("refused")
    register = decision.register
  }
  expect(exportedParts(parts, register)).toBe(parts)
})

it("an export with no stored edit applies no route and keeps the stored parts", () => {
  const slide = xml(twoBoxSlide)
  const parts = onSlide(slide)
  expect(exportedParts(parts, openRegister("", "clean"))).toBe(parts)
  const next = exportedParts(parts, editedRegister([["256.2", "Hello!"]]))
  expect(new TextDecoder().decode(next.get("ppt/slides/slide1.xml")).match(/<a:t>[^<]*<\/a:t>/g)).toEqual([
    "<a:t>Hello!</a:t>",
    "<a:t>World</a:t>",
  ])
  expect([...next.keys()].sort()).toEqual([...parts.keys()].sort())
  expect(next.get("ppt/presentation.xml")).toEqual(parts.get("ppt/presentation.xml"))
  expect(parts.get("ppt/slides/slide1.xml")).toBe(slide)
})

it("an export writes each edited element into its own box", () => {
  const parts = onSlide(xml(twoBoxSlide))
  const next = exportedParts(
    parts,
    editedRegister([
      ["256.3", "Planet"],
      ["256.2", "Hi"],
      ["256.3", "Earth"],
    ]),
  )
  expect(new TextDecoder().decode(next.get("ppt/slides/slide1.xml")).match(/<a:t>[^<]*<\/a:t>/g)).toEqual([
    "<a:t>Hi</a:t>",
    "<a:t>Earth</a:t>",
  ])
})

it("an export writes a stored value with several paragraphs and a value the route refuses writes nothing", () => {
  const lines = Array.from({ length: 9 }, (_, index) => `<a:p><a:r><a:t>Line ${index}</a:t></a:r></a:p>`).join("")
  const slide = new TextEncoder().encode(
    `<p:sld><p:cSld><p:spTree><p:sp><p:nvSpPr><p:cNvPr id="2" name="Title"/></p:nvSpPr><p:txBody><a:bodyPr/>${lines}</p:txBody></p:sp></p:spTree></p:cSld></p:sld>`,
  )
  const saved = Uint8Array.from(slide)
  const parts = onSlide(slide)
  const value = Array.from({ length: 9 }, (_, index) => ({
    from: index,
    runs: [{ from: 0, text: index === 3 ? "typed" : `Line ${index}` }],
  }))
  const next = exportedParts(parts, editedRegister([["256.2", writeTextValue(value)]]))
  expect(new TextDecoder().decode(next.get("ppt/slides/slide1.xml"))).toBe(
    new TextDecoder().decode(slide).replace("Line 3", "typed"),
  )
  const outside = writeTextValue([{ from: 9, runs: [{ from: 0, text: "typed" }] }])
  expect(() => exportedParts(parts, editedRegister([["256.2", outside]]))).toThrow(/text-paragraph/)
  expect(parts.get("ppt/slides/slide1.xml")).toEqual(saved)
})

it("an export of a stored edit refuses the fallback box that shares the edited id and writes nothing", () => {
  const slide = new TextEncoder().encode(fallbackSlide)
  const saved = Uint8Array.from(slide)
  const parts = onSlide(slide)
  expect(() => exportedParts(parts, editedRegister([["256.2", "typed"]]))).toThrow(/text-shape/)
  expect(parts.get("ppt/slides/slide1.xml")).toEqual(saved)
})
