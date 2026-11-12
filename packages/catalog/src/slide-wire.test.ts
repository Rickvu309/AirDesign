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
