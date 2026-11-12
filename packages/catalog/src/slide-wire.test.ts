import { decide, openRegister, orderKeyBetween, presentSlides, slideId } from "@airdesign/document"
import { expect, it } from "vitest"
import { deckRoutes, readAgentEdit, readCommit } from "./index.js"

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
