import { decide, openRegister, orderKeyBetween, presentSlides, slideId } from "@airdesign/document"
import { expect, it } from "vitest"
import { deckRoutes, readAgentEdit, readCommit, slideEditCommand } from "./index.js"

const file = [slideId("256"), slideId("257")] as const
const key = orderKeyBetween(null, null)
const field = { ok: false, refusal: "field" }

it("reads a slide edit on a person's commit and refuses it as an agent change", () => {
  const add = { slide: "add", id: "258", after: "256", key, layout: "256", file: ["256", "257"] }
  const read = readCommit({ deck: "deck", batch: [add] })
  expect(read).toEqual({
    ok: true,
    deck: "deck",
    batch: [{ slide: "add", id: slideId("258"), after: file[0], key, layout: file[0], file }],
  })
  expect(readCommit({ deck: "deck", batch: [{ ...add, note: "no" }] })).toEqual(field)
  expect(readCommit({ deck: "deck", batch: [{ slide: "remove", id: "nope", file: ["256"] }] })).toEqual(field)
  expect(readAgentEdit({ deck: "deck", base: 0, changes: [add] })).toEqual(field)
})

it("reads the layout part a person picked for a new slide and refuses a part that is not a package path", () => {
  const layoutPart = "ppt/slideLayouts/slideLayout2.xml"
  const add = { slide: "add", id: "258", after: "256", key, layout: "256", layoutPart, file: ["256", "257"] }
  const read = readCommit({ deck: "deck", batch: [add] })
  if (!read.ok) throw new Error(read.refusal)
  const edit = read.batch[0]
  if (edit === undefined || !("slide" in edit)) throw new Error("slide")
  expect(slideEditCommand(edit)).toEqual({ slide: "add", id: "258", after: "256", key, layout: "256", layoutPart })
  for (const bad of ["ppt/../_rels/.rels", "../slideLayouts/a.xml", "ppt/slideLayouts/a.rels", "", 7]) {
    expect(readCommit({ deck: "deck", batch: [{ ...add, layoutPart: bad }] })).toEqual(field)
  }
})

it("carries the opening elements of a new slide and refuses a row that names another slide", () => {
  const row = { node: "258.2", kind: "shape", value: "Title", box: { x: 1, y: 2, cx: 3, cy: 4 }, grouped: false }
  const clone = { slide: "clone", id: "258", source: "256", key, floor: [row], file: ["256", "257"] }
  const read = readCommit({ deck: "deck", batch: [clone] })
  if (!read.ok) throw new Error(read.refusal)
  const edit = read.batch[0]
  if (edit === undefined || !("slide" in edit)) throw new Error("slide")
  expect(slideEditCommand(edit)).toEqual({ slide: "clone", id: "258", source: "256", key, floor: [row] })
  expect(readCommit({ deck: "deck", batch: [{ ...clone, floor: [{ ...row, node: "256.2" }] }] })).toEqual(field)
  const add = { slide: "add", id: "258", after: "256", key, layout: "256", floor: [], file: ["256", "257"] }
  expect(readCommit({ deck: "deck", batch: [add] })).toMatchObject({ ok: true, batch: [{ floor: [] }] })
})

it("opens a register that names its slide file and order, and refuses a broken one", () => {
  const opened = openRegister("", "")
  const added = decide(opened, {
    command: "slide",
    file,
    edit: { slide: "remove", id: file[1] },
  })
  if (added.decision !== "apply") throw new Error(added.code)
  const answer = (register: unknown) => JSON.parse(JSON.stringify({ ok: true, deck: "deck", revision: 1, register }))
  expect(deckRoutes.open.result(answer(added.register))).toEqual(answer(added.register))
  expect(presentSlides(added.register).map((spot) => spot.id)).toEqual(["256"])
  expect(deckRoutes.open.result(answer({ ...added.register, order: [{ slide: "move" }] }))).toEqual({
    ok: false,
    refusal: "payload",
  })
})

it("reads a restore on a person's commit and turns it back into the same command", () => {
  const restore = { slide: "restore", id: "257", key, file: ["256", "257"] }
  const read = readCommit({ deck: "deck", batch: [restore] })
  if (!read.ok) throw new Error(read.refusal)
  const edit = read.batch[0]
  if (edit === undefined || !("slide" in edit)) throw new Error("slide")
  expect(slideEditCommand(edit)).toEqual({ slide: "restore", id: file[1], key })
  expect(readCommit({ deck: "deck", batch: [{ ...restore, source: "256" }] })).toEqual(field)
  expect(readAgentEdit({ deck: "deck", base: 0, changes: [restore] })).toEqual(field)
})

it("reads an added text box and a removed element on a person's commit and refuses extra fields", () => {
  const element = { node: "256.9", kind: "shape", value: "", box: { x: 1, y: 2, cx: 3, cy: 4 }, grouped: false }
  const add = { slide: "element-add", id: "256", element, file: ["256", "257"] }
  const remove = { slide: "element-remove", id: "256", node: "256.2", file: ["256", "257"] }
  const restore = { ...remove, slide: "element-restore" }
  const read = readCommit({ deck: "deck", batch: [add, remove, restore] })
  if (!read.ok) throw new Error(read.refusal)
  expect(read.batch.map((edit) => ("slide" in edit ? slideEditCommand(edit) : edit))).toEqual([
    { slide: "element-add", id: "256", element },
    { slide: "element-remove", id: "256", node: "256.2" },
    { slide: "element-restore", id: "256", node: "256.2" },
  ])
  expect(readCommit({ deck: "deck", batch: [{ ...restore, key: "a" }] })).toEqual(field)
  expect(readAgentEdit({ deck: "deck", base: 0, changes: [restore] })).toEqual(field)
  expect(readCommit({ deck: "deck", batch: [{ ...remove, removed: ["256.3"] }] })).toEqual(field)
  expect(readCommit({ deck: "deck", batch: [{ ...add, element: { ...element, node: "257.9" } }] })).toEqual(field)
  expect(readAgentEdit({ deck: "deck", base: 0, changes: [remove] })).toEqual(field)
})

it("carries an added photo's hash and media type through commit_edits, never its bytes, and an old tab's picture as a shape", () => {
  const element = { node: "256.9", kind: "shape", value: null, box: { x: 0, y: 0, cx: 10, cy: 10 }, grouped: false }
  const media = { sha256: "b".repeat(64), type: "image/jpeg" }
  const add = { slide: "element-add", id: "256", element, media, file: ["256", "257"] }
  const read = readCommit({ deck: "deck", batch: [add] })
  if (!read.ok) throw new Error(read.refusal)
  expect(read.batch.map((edit) => ("slide" in edit ? slideEditCommand(edit) : edit))).toEqual([
    { slide: "element-add", id: "256", element, media },
  ])
  const old = readCommit({ deck: "deck", batch: [{ ...add, element: { ...element, kind: "picture" } }] })
  expect(old).toEqual(read)
  expect(readCommit({ deck: "deck", batch: [{ ...add, bytes: "iVBORw0KGgo=" }] })).toEqual(field)
})

it("carries an added shape's geometry through commit_edits and refuses one it does not know", () => {
  const element = { node: "256.9", kind: "connector", value: null, box: { x: 0, y: 0, cx: 10, cy: 0 }, grouped: false }
  const add = { slide: "element-add", id: "256", element, geometry: "line", file: ["256", "257"] }
  const read = readCommit({ deck: "deck", batch: [add] })
  if (!read.ok) throw new Error(read.refusal)
  expect(read.batch.map((edit) => ("slide" in edit ? slideEditCommand(edit) : edit))).toEqual([
    { slide: "element-add", id: "256", element, geometry: "line" },
  ])
  expect(readCommit({ deck: "deck", batch: [{ ...add, geometry: "arrow" }] })).toEqual(field)
})

it("reads a stacking order on a person's commit and refuses an extra field", () => {
  const order = {
    slide: "element-order",
    id: "256",
    node: "256.2",
    before: null,
    among: ["256.2", "256.4"],
    file: ["256", "257"],
  }
  const read = readCommit({ deck: "deck", batch: [order] })
  if (!read.ok) throw new Error(read.refusal)
  expect(read.batch.map((edit) => ("slide" in edit ? slideEditCommand(edit) : edit))).toEqual([
    { slide: "element-order", id: "256", node: "256.2", before: null, among: ["256.2", "256.4"] },
  ])
  expect(readCommit({ deck: "deck", batch: [{ ...order, before: "256.4" }] }).ok).toBe(true)
  expect(readCommit({ deck: "deck", batch: [{ ...order, placed: true }] })).toEqual(field)
  expect(readAgentEdit({ deck: "deck", base: 0, changes: [order] })).toEqual(field)
})

it("refuses PR 478's background command, which a slide's fill row replaced", () => {
  const background = { slide: "background", id: "256", color: { scheme: "accent2" }, file: ["256", "257"] }
  expect(readCommit({ deck: "deck", batch: [background] })).toEqual(field)
  expect(readCommit({ deck: "deck", batch: [{ ...background, color: null }] })).toEqual(field)
  expect(readAgentEdit({ deck: "deck", base: 0, changes: [background] })).toEqual(field)
})

it("carries an auto layout frame's backdrop and its layout opening on a person's commit", () => {
  const box = { x: 0, y: 0, cx: 300, cy: 100 }
  const element = {
    node: "256.20",
    kind: "group",
    value: null,
    box,
    grouped: false,
    opening: { layout: { flow: { set: "horizontal" }, gap: { set: 0 } } },
  }
  const backdrop = { node: "256.21", kind: "shape", value: null, box, grouped: false }
  const members = [
    { node: "256.2", box: { x: 0, y: 0, cx: 100, cy: 100 } },
    { node: "256.3", box: { x: 200, y: 0, cx: 100, cy: 100 } },
  ]
  const group = { slide: "element-group", id: "256", element, members, backdrop, file: ["256", "257"] }
  const read = readCommit({ deck: "deck", batch: [group] })
  if (!read.ok) throw new Error(read.refusal)
  const edit = read.batch[0]
  if (edit === undefined || !("slide" in edit)) throw new Error("slide")
  expect(slideEditCommand(edit)).toMatchObject({ slide: "element-group", element, backdrop })
})

it("carries a layer joining or leaving a frame on a person's commit", () => {
  const member = { node: "256.5", box: { x: 0, y: 0, cx: 100, cy: 100 } }
  for (const [frame, before] of [
    ["256.20", "256.3"],
    [null, null],
  ] as const) {
    const join = { slide: "element-join", id: "256", member, frame, before, file: ["256", "257"] }
    const read = readCommit({ deck: "deck", batch: [join] })
    if (!read.ok) throw new Error(read.refusal)
    const edit = read.batch[0]
    if (edit === undefined || !("slide" in edit)) throw new Error("slide")
    expect(slideEditCommand(edit)).toEqual({ slide: "element-join", id: "256", member, frame, before })
  }
  const elsewhere = { slide: "element-join", id: "256", member, frame: "257.20", before: null, file: ["256", "257"] }
  expect(readCommit({ deck: "deck", batch: [elsewhere] })).toEqual(field)
})
