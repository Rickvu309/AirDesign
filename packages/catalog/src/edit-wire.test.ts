import { coordinates, decide, elementId, format, openRegister } from "@airdesign/document"
import { expect, it } from "vitest"
import * as z from "zod/v4"
import { deckRoutes, readAgentEdit, readCommit, readEdit, toolInputSchema } from "./index.js"

const node = elementId("258.7")
const box = { x: -914400, y: 0, cx: 1828800, cy: 457200 }
const field = { ok: false, refusal: "field" }

it("reads a person box edit and refuses one that is not a whole box", () => {
  expect(readEdit({ node: "258.7", property: "box", value: box })).toEqual({
    ok: true,
    edit: { property: "box", value: box, node },
  })
  expect(readEdit({ node: "258.7", property: "box", value: box, floor: "Hello" })).toEqual({
    ok: true,
    edit: { property: "box", value: box, node, floor: "Hello" },
  })
  expect(readCommit({ deck: "deck", batch: [{ node: "258.7", property: "box", value: box }] })).toEqual({
    ok: true,
    deck: "deck",
    batch: [{ property: "box", value: box, node }],
  })
  for (const raw of [
    { node: "258.7", property: "box", value: box, floor: 7 },
    { node: "258.7", property: "box", value: box, readAt: 0 },
    { node: "258.7", property: "box", value: { ...box, cx: -1 } },
    { node: "258.7", property: "box", value: { ...box, x: 0.5 } },
    { node: "258.7", property: "box", value: { x: 0, y: 0, cx: 1 } },
    { node: "258.7", property: "box", value: JSON.stringify(box) },
    { node: "258.7", property: "box" },
    { node: "258.7", property: "text", value: "hi" },
    { node: "258.7", property: "fill", value: box },
    { node: "258.", property: "box", value: box },
  ]) {
    expect(readEdit(raw)).toEqual(field)
  }
})

it("reads a person's row of trait fields, which a fill needs, and refuses one it cannot read", () => {
  const patch = { fills: { p0: { set: { solid: { scheme: "accent2" } } } } }
  expect(readEdit({ node: "258.7", v: format, patch, floor: "Hello" })).toEqual({
    ok: true,
    edit: { v: format, patch, node, floor: "Hello" },
  })
  expect(
    readCommit({ deck: "deck", batch: [{ node: "258.7", v: format, patch: { fills: { p0: "inherit" } } }] }),
  ).toEqual({
    ok: true,
    deck: "deck",
    batch: [{ v: format, patch: { fills: { p0: "inherit" } }, node }],
  })
  for (const raw of [
    { node: "258.7", v: format + 1, patch },
    { node: "258.7", v: 1, patch },
    { node: "258.7", v: format, patch: { fills: { p0: { set: { solid: { scheme: "accent9" } } } } } },
    { node: "258.7", v: format, patch: {} },
    { node: "258.7", v: format, patch, readAt: 0 },
    { node: "258.7", v: format, patch, value: "hi" },
    { v: format, patch },
  ]) {
    expect(readEdit(raw)).toEqual(field)
  }
})

it("reads an agent box change beside a text change and refuses a box change that is not a whole box", () => {
  const changes = [
    { node: "258.7", readAt: 2, property: "box", value: box, floor: "old" },
    { node: "258.7", readAt: 2, value: "hi", floor: "old" },
  ]
  expect(readAgentEdit({ deck: "deck", base: 1, changes })).toEqual({
    ok: true,
    deck: "deck",
    base: 1,
    changes: [
      { node, readAt: 2, property: "box", value: box, floor: "old" },
      { node, readAt: 2, value: "hi", floor: "old" },
    ],
  })
  for (const change of [
    { node: "258.7", readAt: 2, property: "box", value: box, floor: 7 },
    { node: "258.7", readAt: 2, property: "box", value: { ...box, cy: coordinates.highest + 1 } },
    { node: "258.7", readAt: 2, property: "box", value: { ...box, y: coordinates.lowest - 1 } },
    { node: "258.7", readAt: 2, property: "box", value: "box" },
    { node: "258.7", property: "box", value: box },
  ]) {
    expect(readAgentEdit({ deck: "deck", base: 1, changes: [change] })).toEqual(field)
  }
})

it("offers the agent a box change whose bounds are the ones the document reads", () => {
  const schema = JSON.stringify(z.toJSONSchema(readAgentEdit.input, { io: "input" }))
  expect(schema).toContain('"const":"box"')
  expect(schema).toContain(String(coordinates.lowest))
  expect(schema).toContain(String(coordinates.highest))
  expect(schema).toContain("EMU")
})

it("decodes a stored register holding a box row and refuses a box row that holds text", () => {
  const added = decide(openRegister("", ""), { command: "add", node, floor: "", route: "" })
  if (added.decision !== "apply") throw new Error(added.code)
  const moved = decide(added.register, { command: "person", node, property: "box", value: box })
  if (moved.decision !== "apply") throw new Error(moved.code)
  const answer = (register: unknown) => JSON.parse(JSON.stringify({ ok: true, deck: "deck", revision: 1, register }))
  expect(deckRoutes.open.result(answer(moved.register))).toEqual(answer(moved.register))
  const body = moved.register.elements[node]
  if (body === undefined) throw new Error("missing node")
  for (const row of [
    { actor: "person", property: "box", value: "hi", visible: true },
    { actor: "person", property: "box", value: { ...box, cx: -1 }, visible: true },
    { actor: "person", property: "fill", value: box, visible: true },
  ]) {
    const broken = { ...moved.register, elements: { ...moved.register.elements, [node]: { ...body, landed: [row] } } }
    expect(deckRoutes.open.result(answer(broken))).toEqual({ ok: false, refusal: "payload" })
  }
})

it("tells the agent a value may be a JSON text value, whose run format the server instructions give", () => {
  const schema = JSON.stringify(toolInputSchema("edit_deck"))
  expect(schema).toContain("Text to write: plain text, or a JSON text value when the file's text is one.")
  expect(schema).not.toContain("A run may set bold")
})
