import {
  decide,
  elementId,
  format,
  openRegister,
  orderKeyAfter,
  presentSlides,
  slideId,
  type Command,
  type ElementPatch,
  type FieldValue,
  type Register,
  type SlideCommand,
  type SlideId,
} from "@airdesign/document"
import { readParts, readSlides, shownFill } from "@airdesign/pptx"
import { expect, it } from "vitest"
import { exportedParts } from "./editing/exported-parts"
import { flooredEdit } from "./editing/slide-floor"

type Parts = ReadonlyMap<string, Uint8Array>
type Fill = FieldValue<"fills", "p0">

const red: Fill = { solid: { rgb: "C00000" } }
const navy: Fill = {
  gradient: {
    stops: [
      { pos: 0, color: { rgb: "1F4E79" } },
      { pos: 100_000, color: { scheme: "bg1" } },
    ],
    shade: { linear: { angle: 5_400_000, scaled: false } },
    rotateWithShape: true,
  },
}

async function fixture(name: string): Promise<Parts> {
  const fsName = "node:fs/promises"
  const fs = (await import(fsName)) as { readFile: (path: URL) => Promise<Uint8Array> }
  return readParts(await fs.readFile(new URL(`../../../scripts/pptx-fixtures/${name}`, import.meta.url)))
}

function applied(register: Register, command: Command): Register {
  const decision = decide(register, command)
  if (decision.decision === "refuse") throw new Error(decision.code)
  return decision.register
}

function filled(register: Register, node: string, patch: ElementPatch): Register {
  const id = elementId(node)
  const opened = register.nodes.includes(id)
    ? register
    : applied(register, { command: "add", node: id, floor: "", route: register.route })
  return applied(opened, { command: "person", v: format, patch, node: id })
}

function cloned(parts: Parts, register: Register, source: SlideId, id: SlideId): Register {
  const file = readSlides(parts).map((slide) => slideId(slide.slide))
  const key = orderKeyAfter(presentSlides({ file, order: register.order }), source)
  if (key === null) throw new Error("key")
  const edit: SlideCommand = { slide: "clone", id, source, key }
  return applied(register, { command: "slide", file, edit: flooredEdit(parts, register, file, edit) })
}

function fills(parts: Parts, register: Register): Readonly<Record<string, Fill | null | undefined>> {
  const exported = exportedParts(parts, register)
  return Object.fromEntries(
    readSlides(exported).map(({ slide, part }) => [slide, shownFill(exported, { part, shape: "2" })?.value]),
  )
}

it("keeps a duplicate's fill as the source showed it, through a duplicate of the duplicate and an opening row", async () => {
  const parts = await fixture("clean.pptx")
  let register = filled(openRegister("", "deck"), "256.2", { fills: { p0: { set: red } } })
  register = cloned(parts, register, slideId("256"), slideId("257"))
  register = filled(register, "256.2", { fills: { p0: { set: navy } } })
  register = filled(register, "257.2", { fills: { p0: "opening" } })
  register = cloned(parts, register, slideId("257"), slideId("258"))
  expect(fills(parts, register)).toEqual({ "256": navy, "257": red, "258": red })
})

it("keeps a duplicate's fill gone back to inherited when its source was reset", async () => {
  const parts = await fixture("clean.pptx")
  const accent = { solid: { scheme: "accent1" } }
  expect(fills(parts, openRegister("", "deck"))).toEqual({ "256": accent })
  let register = filled(openRegister("", "deck"), "256.2", { fills: { p0: "inherit" } })
  register = cloned(parts, register, slideId("256"), slideId("257"))
  expect(fills(parts, register)).toEqual({ "256": { none: true }, "257": { none: true } })
})
