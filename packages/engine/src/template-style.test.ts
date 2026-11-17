import { readDeckId } from "@airdesign/catalog"
import {
  registerScope,
  planChange,
  themeNode,
  format,
  elementId,
  landedPatch,
  type Register,
} from "@airdesign/document"
import { expect, it } from "vitest"
import { call, indexDeck, readDeckPage, openDeck, type Deck } from "./index.js"

const person = { actor: "person" } as const
const agent = { actor: "agent", runId: "run" } as const
const templates = [
  {
    id: "ppt/theme/theme1.xml",
    name: "Light",
    palette: { slots: { lt1: "FFFFFF" }, map: {}, fonts: { major: "Inter", minor: "Inter" } },
  },
  {
    id: "ppt/theme/theme2.xml",
    name: "Dark",
    palette: { slots: { lt1: "000000" }, map: {}, fonts: { major: "Georgia", minor: "Georgia" } },
  },
]

function landed(
  result: { readonly ok: true; readonly deck: Deck } | { readonly ok: false; readonly refusal: string },
): Deck {
  if (!result.ok) throw new Error(result.refusal)
  return result.deck
}

function indexed(): Deck {
  const id = readDeckId("deck")
  if (!id.ok) throw new Error(id.refusal)
  return landed(
    indexDeck(openDeck(id.deck), person, {
      deck: "deck",
      format,
      once: "index",
      offset: 0,
      total: 0,
      templates,
      slides: [
        { id: "256", position: 0, template: templates[0]!.id },
        { id: "257", position: 1, template: templates[0]!.id },
      ],
      elements: [],
    }),
  )
}

function assigned(register: Register, slide: string) {
  const body = register.elements[elementId(`${slide}.slide`)]
  return body === undefined ? undefined : landedPatch(body, "text").template?.id
}

it("gives agents the deck's real styles, assigns one slide through set, and undo_run restores its previous style", () => {
  let deck = indexed()
  const read = readDeckPage(deck, { runId: "run" })
  expect(read).toMatchObject({
    templates,
    slides: [
      { id: "256", template: templates[0]!.id },
      { id: "257", template: templates[0]!.id },
    ],
  })
  deck = landed(call("start_run", deck, agent, { deck: "deck", runId: "run", elements: [{ node: "256.slide" }] }))
  expect(
    call("edit_deck", deck, agent, {
      deck: "deck",
      base: deck.revision,
      changes: [{ op: "set", target: "256", template: { id: "missing" } }],
    }),
  ).toMatchObject({ ok: false, refusal: "kind" })
  deck = landed(
    call("edit_deck", deck, agent, {
      deck: "deck",
      base: deck.revision,
      changes: [{ op: "set", target: "256", template: { id: templates[1]!.id } }],
    }),
  )
  expect(assigned(deck.register, "256")).toEqual({ set: templates[1]!.id })
  expect(assigned(deck.register, "257")).toBeUndefined()
  const updated = readDeckPage(deck, { runId: "run" })
  expect(updated).toMatchObject({
    slides: [
      { id: "256", template: templates[1]!.id },
      { id: "257", template: templates[0]!.id },
    ],
  })
  deck = landed(call("undo_run", deck, person, { deck: "deck", runId: "run" }))
  expect(assigned(deck.register, "256")).toBeUndefined()
})

it("edits only the addressed template and reports its current name and fonts", () => {
  let deck = indexed()
  deck = landed(call("start_run", deck, agent, { deck: "deck", runId: "run", elements: [{ node: "deck.template2" }] }))
  deck = landed(
    call("edit_deck", deck, agent, {
      deck: "deck",
      base: deck.revision,
      changes: [
        { op: "set", target: "deck.template2", theme: { name: "Night", major: "Verdana", accent1: `#${"112233"}` } },
      ],
    }),
  )
  const read = readDeckPage(deck, { runId: "run" })
  expect(read.templates?.[0]).toEqual(templates[0])
  expect(read.templates?.[1]).toMatchObject({
    name: "Night",
    palette: { fonts: { major: "Verdana" }, slots: { accent1: "112233" } },
  })
  expect(
    call("start_run", deck, agent, { deck: "deck", runId: "run", elements: [{ node: "deck.template3" }] }),
  ).toMatchObject({ ok: false, refusal: "dead" })
})

it("expands a deck-wide theme edit to the same template nodes, so it can replace earlier scoped values", () => {
  const deck = indexed()
  const scope = registerScope(deck.register)
  const plan = planChange({ target: { node: themeNode }, theme: { major: "Verdana" } }, scope)
  expect(plan).toMatchObject({ ok: true, rows: [{ node: "deck.template1" }, { node: "deck.template2" }] })
})
