import {
  decide,
  elementId,
  format,
  openRegister,
  writeTextValue,
  slideId,
  type Command,
  type Register,
  type SlideCommand,
} from "@airdesign/document"
import { readParts, readShapes, shownIdentity, textNamedNow } from "@airdesign/pptx"
import { expect, it } from "vitest"
import { copyCommands, elementCommand } from "./element-edit"
import { exportedParts } from "./exported-parts"

type Parts = ReadonlyMap<string, Uint8Array>

const size = { width: 1000, height: 500 }
const file = [slideId("256")]

async function fixture(name: string): Promise<Parts> {
  const fsName = "node:fs/promises"
  const fs = (await import(fsName)) as { readFile: (path: URL) => Promise<Uint8Array> }
  return readParts(await fs.readFile(new URL(`../../../scripts/pptx-fixtures/${name}`, import.meta.url)))
}

function made(edit: SlideCommand | null): SlideCommand {
  if (edit === null) throw new Error("no edit")
  return edit
}

function applied(register: Register, command: Command): Register {
  const decision = decide(register, command)
  if (decision.decision !== "apply") throw new Error(decision.code)
  return decision.register
}

function names(parts: Parts, register: Register): Readonly<Record<string, string | undefined>> {
  const shown = exportedParts(parts, register)
  return Object.fromEntries(
    readShapes(shown).map((shape) => [
      `${shape.slide}.${shape.shape}`,
      shownIdentity(shown, { slide: shape.slide, part: shape.part, shape: shape.shape })?.name,
    ]),
  )
}

function typed(register: Register, node: string, value: string): Register {
  const id = elementId(node)
  const opened = register.nodes.includes(id)
    ? register
    : applied(register, { command: "add", node: id, floor: "", route: register.route })
  return applied(opened, { command: "person", node: id, value })
}

it("names a new text layer by its text and a new shape by its type, as Figma does", async () => {
  const parts = await fixture("clean.pptx")
  let register = openRegister("", "")
  for (const change of [
    { change: "text", index: 0, size },
    { change: "shape", geometry: "rect", index: 0, size },
    { change: "shape", geometry: "ellipse", index: 0, size },
    { change: "shape", geometry: "line", index: 0, size },
  ] as const)
    register = applied(register, { command: "slide", file, edit: made(elementCommand(parts, register, change)) })
  expect(names(parts, register)).toEqual({
    "256.2": "Rectangle 2",
    "256.3": "Text",
    "256.4": "Rectangle 4",
    "256.5": "Ellipse 5",
    "256.6": "Line 6",
  })
  register = typed(
    register,
    "256.3",
    writeTextValue([
      {
        from: 0,
        runs: [
          { from: -1, text: "  Market grows " },
          { from: -1, text: "12% a year" },
        ],
      },
      { from: 0, runs: [{ from: -1, text: "Second line" }] },
    ]),
  )
  expect(names(parts, register)["256.3"]).toBe("Market grows 12% a year")
  expect(textNamedNow(register).has(elementId("256.3"))).toBe(true)
})

it("keeps a name the person gave a new text layer when its text changes", async () => {
  const parts = await fixture("clean.pptx")
  let register = applied(openRegister("", ""), {
    command: "slide",
    file,
    edit: made(elementCommand(parts, openRegister("", ""), { change: "text", index: 0, size })),
  })
  register = applied(typed(register, "256.3", "Draft"), {
    command: "person",
    v: format,
    node: elementId("256.3"),
    patch: { identity: { name: { set: "Takeaway" } } },
  })
  register = typed(register, "256.3", "Final words")
  expect(names(parts, register)["256.3"]).toBe("Takeaway")
  expect(textNamedNow(register).has(elementId("256.3"))).toBe(false)
})

it("gives a copy whose name ends in a number its own number, and keeps a copied text layer named by its text", async () => {
  const parts = await fixture("clean.pptx")
  let register = openRegister("", "")
  for (const change of [
    { change: "shape", geometry: "rect", index: 0, size },
    { change: "text", index: 0, size },
  ] as const)
    register = applied(register, { command: "slide", file, edit: made(elementCommand(parts, register, change)) })
  register = typed(register, "256.4", "Label")
  const box = { x: 10, y: 10, cx: 100, cy: 40 }
  const copies = copyCommands(parts, register, [
    { id: elementId("256.3"), box },
    { id: elementId("256.4"), box },
    { id: elementId("256.2"), box },
  ])
  for (const edit of copies.edits) register = applied(register, { command: "slide", file, edit })
  register = typed(register, "256.6", "Other label")
  expect(names(parts, register)).toMatchObject({
    "256.3": "Rectangle 3",
    "256.4": "Label",
    "256.5": "Rectangle 5",
    "256.6": "Other label",
    "256.7": "Rectangle 7",
  })
})
