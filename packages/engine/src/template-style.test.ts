import { readDeckId } from "@airdesign/catalog"
import {
  registerScope,
  planChange,
  templateStylesNode,
  format,
  elementId,
  landedPatch,
  type Register,
} from "@airdesign/document"
import { expect, it } from "vitest"
import { call, indexDeck, readDeckPage, openDeck, type Deck } from "./index.js"

const person = { actor: "person" } as const
const agent = { actor: "agent", runId: "run" } as const
const templateStyles = [
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
      templateStyles,
      slides: [
        { id: "256", position: 0, templateStyle: templateStyles[0]!.id },
        { id: "257", position: 1, templateStyle: templateStyles[0]!.id },
      ],
      elements: [],
    }),
  )
}

function assigned(register: Register, slide: string) {
  const body = register.elements[elementId(`${slide}.slide`)]
  return body === undefined ? undefined : landedPatch(body, "text").templateStyle?.id
}

it("gives agents the deck's real styles, assigns one slide through set, and undo_run restores its previous style", () => {
  let deck = indexed()
  const read = readDeckPage(deck, { runId: "run" })
  expect(read).toMatchObject({
    templateStyles,
    slides: [
      { id: "256", templateStyle: templateStyles[0]!.id },
      { id: "257", templateStyle: templateStyles[0]!.id },
    ],
  })
  deck = landed(call("start_run", deck, agent, { deck: "deck", runId: "run", elements: [{ node: "256.slide" }] }))
  expect(
    call("edit_deck", deck, agent, {
      deck: "deck",
      base: deck.revision,
      changes: [{ op: "set", target: "256", templateStyle: { id: "missing" } }],
    }),
  ).toMatchObject({ ok: false, refusal: "kind" })
  deck = landed(
    call("edit_deck", deck, agent, {
      deck: "deck",
      base: deck.revision,
      changes: [{ op: "set", target: "256", templateStyle: { id: templateStyles[1]!.id } }],
    }),
  )
  expect(assigned(deck.register, "256")).toEqual({ set: templateStyles[1]!.id })
  expect(assigned(deck.register, "257")).toBeUndefined()
  const updated = readDeckPage(deck, { runId: "run" })
  expect(updated).toMatchObject({
    slides: [
      { id: "256", templateStyle: templateStyles[1]!.id },
      { id: "257", templateStyle: templateStyles[0]!.id },
    ],
  })
  deck = landed(call("undo_run", deck, person, { deck: "deck", runId: "run" }))
  expect(assigned(deck.register, "256")).toBeUndefined()
})

it("edits only the addressed template style and reports its current name and fonts", () => {
  let deck = indexed()
  deck = landed(
    call("start_run", deck, agent, { deck: "deck", runId: "run", elements: [{ node: "deck.templateStyle2" }] }),
  )
  deck = landed(
    call("edit_deck", deck, agent, {
      deck: "deck",
      base: deck.revision,
      changes: [
        {
          op: "set",
          target: "deck.templateStyle2",
          templateStyle: { name: "Night", major: "Verdana", accent1: `#${"112233"}` },
        },
      ],
    }),
  )
  const read = readDeckPage(deck, { runId: "run" })
  expect(read.templateStyles?.[0]).toEqual({ ...templateStyles[0], node: "deck.templateStyle1" })
  expect(read.templateStyles?.[1]).toMatchObject({
    name: "Night",
    palette: { fonts: { major: "Verdana" }, slots: { accent1: "112233" } },
  })
  expect(
    call("start_run", deck, agent, { deck: "deck", runId: "run", elements: [{ node: "deck.templateStyle3" }] }),
  ).toMatchObject({ ok: false, refusal: "dead" })
})

it("reports an added colour on that template style and omits an unused one once it is deleted", () => {
  const coral = `#${"FF6600"}`
  let deck = indexed()
  deck = landed(
    call("start_run", deck, agent, { deck: "deck", runId: "run", elements: [{ node: "deck.templateStyle2" }] }),
  )
  deck = landed(
    call("edit_deck", deck, agent, {
      deck: "deck",
      base: deck.revision,
      changes: [
        { op: "set", target: "deck.templateStyle2", templateStyle: { custom: [{ name: "Coral", color: coral }] } },
      ],
    }),
  )
  expect(readDeckPage(deck, { runId: "run" }).templateStyles?.[1]).toMatchObject({
    node: "deck.templateStyle2",
    custom: [{ name: "Coral", color: coral }],
  })
  expect(readDeckPage(deck, { runId: "run" }).templateStyles?.[0]).not.toHaveProperty("custom")
  deck = landed(
    call("edit_deck", deck, agent, {
      deck: "deck",
      base: deck.revision,
      changes: [{ op: "set", target: "deck.templateStyle2", templateStyle: { removed: true } }],
    }),
  )
  const read = readDeckPage(deck, { runId: "run" })
  expect(read.templateStyles?.map((style) => style.node)).toEqual(["deck.templateStyle1"])
  expect(read.templateStyles?.map((style) => style.id)).toEqual([templateStyles[0]!.id])
})

it("expands an edit to every template style to the same template style nodes, so it can replace earlier scoped values", () => {
  const deck = indexed()
  const scope = registerScope(deck.register)
  const plan = planChange({ target: { node: templateStylesNode }, templateStyle: { major: "Verdana" } }, scope)
  expect(plan).toMatchObject({ ok: true, rows: [{ node: "deck.templateStyle1" }, { node: "deck.templateStyle2" }] })
})
