import {
  decide,
  elementId,
  openRegister,
  writeTextValue,
  type Box,
  type Register,
  type Value,
} from "@airdesign/document"
import { readPackage, readShapes, shapeKind, type ReadShape } from "@airdesign/pptx"
import { expect, it } from "vitest"
import { exportedParts } from "./exported-parts"

async function census() {
  const fsName = "node:fs/promises"
  const fs = (await import(fsName)) as { readFile: (path: URL) => Promise<Uint8Array> }
  const read = await readPackage(
    await fs.readFile(new URL("../../../../scripts/pptx-fixtures/census-updating-spm.pptx", import.meta.url)),
  )
  if (!read.ok) throw new Error(read.reason)
  return read.parts
}

function storedBeforeTheFix(edits: readonly (readonly [string, Value])[]): Register {
  let register = openRegister("", "clean")
  for (const [node, edit] of edits) {
    const id = elementId(node)
    if (!register.nodes.includes(id)) {
      const added = decide(register, { command: "add", node: id, floor: "", route: "clean" })
      if (added.decision === "refuse") throw new Error(added.code)
      const started = decide(added.register, { command: "start", runId: "agent", node: id })
      if (started.decision === "refuse") throw new Error(started.code)
      register = started.register
    }
    const readAt = register.elements[id]?.landed.length ?? 0
    const landed = decide(register, { command: "agent", runId: "agent", readAt, ...edit, node: id })
    if (landed.decision === "refuse") throw new Error(landed.code)
    register = landed.register
  }
  return register
}

function first(shapes: readonly ReadShape[], kind: string, test: (shape: ReadShape) => boolean = () => true) {
  const photo = kind === "photo"
  const found = shapes.find(
    (shape) =>
      shapeKind(shape) === (photo ? "shape" : kind) &&
      (!photo || shape.kind === "p:pic") &&
      shape.grouped !== true &&
      test(shape),
  )
  if (found === undefined) throw new Error(kind)
  return `${found.slide}.${found.shape}`
}

const agentText: Value = { value: writeTextValue([{ from: 0, runs: [{ from: -1, text: "Agent" }] }]) }

it("opens and exports a deck whose register holds agent text on elements that hold no text", async () => {
  const parts = await census()
  const shapes = readShapes(parts)
  const refused = ["photo", "group", "kept", "connector"].map((kind) => first(shapes, kind))
  const register = storedBeforeTheFix(refused.map((node) => [node, agentText] as const))
  const exported = exportedParts(parts, register)
  for (const [name, bytes] of parts) expect(exported.get(name), name).toEqual(bytes)
})

it("opens and exports a deck whose register holds an agent edit on a shape with a fallback copy", async () => {
  const parts = await census()
  const shapes = readShapes(parts)
  const locked = shapes.find((shape) => shape.locked && shape.kind !== "p:graphicFrame")
  if (locked === undefined) throw new Error("locked")
  const node = `${locked.slide}.${locked.shape}`
  const box: Box = { ...(locked.box ?? { x: 0, y: 0, cx: 914400, cy: 914400 }), x: 12700 }
  const register = storedBeforeTheFix([
    [node, agentText],
    [node, { property: "box", value: box }],
  ])
  expect(shapeKind(locked)).toBe("kept")
  const exported = exportedParts(parts, register)
  for (const [name, bytes] of parts) expect(exported.get(name), name).toEqual(bytes)
})

it("still writes the edits the elements can take beside the ones they cannot", async () => {
  const parts = await census()
  const shapes = readShapes(parts)
  const titled = shapes.find((shape) => shapeKind(shape) === "shape" && shape.text.length > 0 && !shape.grouped)
  if (titled === undefined) throw new Error("shape")
  const node = `${titled.slide}.${titled.shape}`
  const register = storedBeforeTheFix([
    [first(shapes, "photo"), agentText],
    [node, agentText],
  ])
  const exported = exportedParts(parts, register)
  expect(new TextDecoder().decode(exported.get(titled.part))).toContain("<a:t>Agent</a:t>")
})
