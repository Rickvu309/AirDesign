import { readDeckId } from "@airdesign/catalog"
import { backgroundOf, slideId } from "@airdesign/document"
import { expect, it } from "vitest"
import { call, indexDeck, openDeck } from "./index.js"

const actor = { actor: "agent", runId: "run" } as const
const first = slideId("256")

function opened() {
  const id = readDeckId("deck")
  if (!id.ok) throw new Error("deck")
  const result = indexDeck(
    openDeck(id.deck),
    { actor: "person" },
    {
      deck: "deck",
      once: "index",
      offset: 0,
      total: 0,
      slides: [
        { id: "256", position: 0, layout: [] },
        { id: "257", position: 1, layout: [] },
      ],
      elements: [],
    },
  )
  if (!result.ok) throw new Error(result.refusal)
  return result.deck
}

it("sets a slide's background through the agent caller, and the person's Undo of the run takes it back", () => {
  const result = call("set_background", opened(), actor, {
    deck: "deck",
    base: 0,
    slide: "256",
    color: { scheme: "accent2" },
  })
  if (!result.ok) throw new Error(result.refusal)
  expect(result.deck.revision).toBe(1)
  expect(backgroundOf(result.deck.register, first)).toEqual({ scheme: "accent2" })
  const undone = call("undo_run", result.deck, { actor: "person" }, { deck: "deck", runId: "run" })
  if (!undone.ok) throw new Error(undone.refusal)
  expect(backgroundOf(undone.deck.register, first)).toBeNull()
})

it("sets an RGB colour on the next turn of the same run", () => {
  const once = call("set_background", opened(), actor, {
    deck: "deck",
    base: 0,
    slide: "256",
    color: { rgb: "0F2433" },
  })
  if (!once.ok) throw new Error(once.refusal)
  const twice = call("set_background", once.deck, actor, {
    deck: "deck",
    base: 0,
    slide: "257",
    color: { rgb: "FFFFFF" },
  })
  if (!twice.ok) throw new Error(twice.refusal)
  expect(backgroundOf(twice.deck.register, slideId("257"))).toEqual({ rgb: "FFFFFF" })
})

it("refuses a person, a stale base, a slide that is not there, a colour it cannot write, and a run that ended", () => {
  const deck = opened()
  const raw = { deck: "deck", base: 0, slide: "256", color: { scheme: "accent2" } }
  expect(call("set_background", deck, { actor: "person" }, raw)).toEqual({ ok: false, refusal: "field" })
  expect(call("set_background", deck, actor, { ...raw, base: 4 })).toEqual({ ok: false, refusal: "stale" })
  expect(call("set_background", deck, actor, { ...raw, slide: "300" })).toEqual({ ok: false, refusal: "dead" })
  expect(call("set_background", deck, actor, { ...raw, color: { rgb: "red" } }).ok).toBe(false)
  expect(call("set_background", deck, actor, { ...raw, color: null }).ok).toBe(false)
  const ran = call("set_background", deck, actor, raw)
  if (!ran.ok) throw new Error(ran.refusal)
  const stopped = call("stop_run", ran.deck, actor, { deck: "deck", runId: "run" })
  if (!stopped.ok) throw new Error(stopped.refusal)
  expect(call("set_background", stopped.deck, actor, { ...raw, base: stopped.deck.revision })).toEqual({
    ok: false,
    refusal: "run-fenced",
  })
})
