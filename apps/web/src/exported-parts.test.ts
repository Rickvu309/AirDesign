import { decide, elementId, openRegister, writeTextValue, type Box, type Command } from "@airdesign/document"
import { applyRoute, readPackage, readShapes } from "@airdesign/pptx"
import { expect, it } from "vitest"
import { exportedParts, missingPictures } from "./exported-parts"
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

it("an export of a stored edit skips the shape that shares its id with a fallback copy and writes nothing", () => {
  const slide = new TextEncoder().encode(fallbackSlide)
  const saved = Uint8Array.from(slide)
  const parts = onSlide(slide)
  expect(exportedParts(parts, editedRegister([["256.2", "typed"]])).get("ppt/slides/slide1.xml")).toEqual(saved)
  expect(parts.get("ppt/slides/slide1.xml")).toEqual(saved)
})

const box = { x: 914400, y: 457200, cx: 1828800, cy: 914400 }
const part = "ppt/slides/slide1.xml"

function moved(edits: readonly (readonly [string, Box | string])[]) {
  let register = openRegister("", "clean")
  const commands: Command[] = []
  for (const [id, value] of edits) {
    const node = elementId(id)
    if (!commands.some((command) => command.command !== "slide" && command.node === node))
      commands.push({ command: "add", node, floor: "", route: "clean" })
    commands.push(
      typeof value === "string"
        ? { command: "person", node, value }
        : { command: "person", node, property: "box", value },
    )
  }
  for (const command of commands) {
    const decision = decide(register, command)
    if (decision.decision === "refuse") throw new Error(decision.code)
    register = decision.register
  }
  return register
}

it("an export writes an element's box through the move and resize routes and keeps every other part", () => {
  const parts = onSlide(xml(twoBoxSlide))
  const next = exportedParts(parts, moved([["256.3", box]]))
  const routed = applyRoute(applyRoute(parts, { name: "move", part, shape: "3", ...box }), {
    name: "resize",
    part,
    shape: "3",
    ...box,
  })
  expect(next.get(part)).toEqual(routed.get(part))
  expect(new TextDecoder().decode(next.get(part))).toContain(
    '<p:cNvPr id="3" name="Body"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="914400" y="457200"/><a:ext cx="1828800" cy="914400"/></a:xfrm></p:spPr>',
  )
  for (const name of parts.keys()) if (name !== part) expect(next.get(name)).toBe(parts.get(name))
})

it("an export writes an element's text and its last box together", () => {
  const parts = onSlide(xml(twoBoxSlide))
  const last = { x: 0, y: 0, cx: 1, cy: 2 }
  const next = new TextDecoder().decode(
    exportedParts(
      parts,
      moved([
        ["256.2", box],
        ["256.2", "Hi"],
        ["256.2", last],
      ]),
    ).get(part),
  )
  expect(next.match(/<a:t>[^<]*<\/a:t>/g)).toEqual(["<a:t>Hi</a:t>", "<a:t>World</a:t>"])
  expect(next.match(/<a:xfrm>.*?<\/a:xfrm>/g)).toEqual(['<a:xfrm><a:off x="0" y="0"/><a:ext cx="1" cy="2"/></a:xfrm>'])
})

it("an export of a box skips the shape that shares its id with a fallback copy and writes nothing", () => {
  const slide = new TextEncoder().encode(fallbackSlide)
  const saved = Uint8Array.from(slide)
  const parts = onSlide(slide)
  expect(exportedParts(parts, moved([["256.2", box]])).get(part)).toEqual(saved)
  expect(parts.get(part)).toEqual(saved)
})

it("an export keeps the stored part when an edit was taken back to the file's text and box", () => {
  const boxed = twoBoxSlide.replace(
    '<p:cNvPr id="3" name="Body"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr/>',
    '<p:cNvPr id="3" name="Body"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="10" y="20"/><a:ext cx="30" cy="40"/></a:xfrm></p:spPr>',
  )
  const parts = onSlide(xml(boxed))
  const back = moved([
    ["256.2", "Changed"],
    ["256.2", writeTextValue([{ from: 0, runs: [{ from: 0, text: "Hello" }] }])],
    ["256.3", box],
    ["256.3", { x: 10, y: 20, cx: 30, cy: 40 }],
  ])
  expect(exportedParts(parts, back).get(part)).toBe(parts.get(part))
})

it("an export keeps the stored part when a placeholder that takes its box from the layout is moved back there", async () => {
  const fsName = "node:fs/promises"
  const fs = (await import(fsName)) as { readFile: (path: URL) => Promise<Uint8Array> }
  const read = await readPackage(
    await fs.readFile(new URL("../../../scripts/pptx-fixtures/doe-heat-pumps.pptx", import.meta.url)),
  )
  if (!read.ok) throw new Error(read.reason)
  const shape = readShapes(read.parts).find((each) => each.part === "ppt/slides/slide3.xml" && each.shape === "3")
  if (shape === undefined || shape.box !== null) throw new Error("shape")
  const id = `${shape.slide}.3`
  const layout = { x: 628650, y: 274320, cx: 7886700, cy: 914400 }
  const back = exportedParts(
    read.parts,
    moved([
      [id, box],
      [id, layout],
    ]),
  )
  expect(back.get(shape.part)).toBe(read.parts.get(shape.part))
  const away = exportedParts(read.parts, moved([[id, box]]))
  expect(away.get(shape.part)).not.toEqual(read.parts.get(shape.part))
}, 20_000)

it("asks for the picture that fills text before an export", () => {
  const sha256 = "cd".repeat(32)
  const register = editedRegister([
    ["256.2", writeTextValue([{ from: 0, runs: [{ from: 0, text: "Hi", fill: { image: `image/png:${sha256}` } }] }])],
  ])
  expect(missingPictures(register, new Map())).toEqual([sha256])
})
