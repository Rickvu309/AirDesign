import { readDeckId } from "@airdesign/catalog"
import { elementId, format } from "@airdesign/document"
import { call, indexDeck, openDeck, readDeckPage, type Deck } from "@airdesign/engine"

type Spec = Record<string, boolean | number | string>
type Graph = { states: Map<string, Spec>; edges: { from: string; to: string; action: string }[] }
const parsed = readDeckId("index-replay")
if (!parsed.ok) throw new Error("deck")
const id = parsed.deck
const node = elementId("258.1")
const slides = [{ id: "258", position: 0 }]
const layout = [{ node: elementId("258.9"), kind: "shape", value: "", box: null, grouped: false, role: "title" }]
const palettes = [{ slots: { accent1: "4472C4" }, map: { tx1: "dk1" } }]
const opening = (offset: number) => ({
  node: elementId(`258.${String(offset + 1)}`),
  kind: "shape",
  value: "Title",
  box: null,
  grouped: false,
})
const older = [0, 1].map((offset) => ({
  deck: id,
  offset,
  once: `older-${String(offset)}`,
  total: 2,
  slides,
  elements: [opening(offset)],
}))
const newer = (drift: boolean) =>
  [0, 1].map((offset) => ({
    deck: id,
    format,
    offset,
    once: `newer-${String(offset)}`,
    total: 2,
    palettes,
    slides: [{ id: "258", position: 0, free: 5, layout }],
    elements: [
      {
        ...opening(offset),
        value: drift ? "Read another way" : "Title",
        role: "body",
        design: { "text.size": [18, "master"] },
      },
    ],
  }))

function store(deck: Deck, page: unknown): { readonly deck: Deck; readonly refused: boolean } {
  const indexed = indexDeck(deck, { actor: "person" }, page)
  if (!indexed.ok && indexed.refusal !== "present") throw new Error(indexed.refusal)
  return indexed.ok ? { deck: indexed.deck, refused: false } : { deck, refused: true }
}

function edit(deck: Deck): Deck {
  const edited = call(
    "commit_edits",
    deck,
    { actor: "person" },
    { deck: id, batch: [{ node, value: "After", floor: "Title" }] },
  )
  if (!edited.ok) throw new Error(edited.refusal)
  return edited.deck
}

function sourceDeck(source: Spec): Deck {
  let deck = openDeck(id)
  if (source.edited === true) deck = edit(deck)
  for (let n = 0; n < Number(source.stored); n += 1) deck = store(deck, older[n]).deck
  for (let n = 0; n < Number(source.beside); n += 1) deck = store(deck, newer(false)[n]).deck
  return deck
}

export function replayIndex(graph: Graph, failures: string[]) {
  let replayed = 0
  let stuttered = 0
  for (const edge of graph.edges) {
    const source = graph.states.get(edge.from)
    const target = graph.states.get(edge.to)
    if (source === undefined || target === undefined) throw new Error("state")
    let deck = sourceDeck(source)
    const before = deck.register.index
    if (edge.action === "Store") {
      const page = Number(source.sent) - 1
      const resent = source.resent === true && source.flightOld !== true
      const stored = store(deck, resent ? newer(source.drift === true)[page] : older[page])
      if (stored.refused !== (resent && source.drift === true && source.format === 1))
        failures.push(
          `index Store ${stored.refused ? "refused" : "took"} a page the model ${stored.refused ? "takes" : "refuses"}`,
        )
      deck = stored.deck
      replayed += 1
    } else if (edge.action === "Edit") {
      deck = edit(deck)
      replayed += 1
    } else stuttered += 1
    const index = deck.register.index
    const read = readDeckPage(deck, { runId: null })
    if (
      index?.elements.length !== (Number(target.stored) || undefined) ||
      read.revision !== target.revision ||
      read.elements.some((element) => element.closed)
    ) {
      failures.push(`index ${edge.action} disagrees with stored pages or edit revision`)
    }
    const beside =
      target.format === 2 ? index?.next === undefined : (index?.next?.elements.length ?? 0) === target.beside
    if ((index?.format ?? 1) !== (target.format === 2 ? format : 1) || !beside) {
      failures.push(`index ${edge.action} disagrees with the stored format or the pages built beside it`)
    }
    if ((index?.slides[0]?.layout !== undefined) !== (target.format === 2)) {
      failures.push(`index ${edge.action} ${target.format === 2 ? "lost" : "made up"} the newer index's layouts`)
    }
    if (index?.elements.some((element) => element.value !== "Title")) {
      failures.push(`index ${edge.action} changed an opening value`)
    }
    if (before !== undefined && index !== undefined && index.elements.length < before.elements.length) {
      failures.push(`index ${edge.action} dropped stored pages`)
    }
    const title = read.elements.find((element) => element.node === node)
    if (target.edited === true && (title?.value !== "After" || title.version !== 1)) {
      failures.push(`index ${edge.action} changed an existing edit`)
    }
    if (target.edited === false && Number(target.stored) > 0 && (title?.value !== "Title" || title.version !== 0)) {
      failures.push(`index ${edge.action} made a floor into an edit`)
    }
    if (target.format === 2 && title?.role !== "body") {
      failures.push(`index ${edge.action} swapped in an index without its roles`)
    }
  }
  return { replayed, stuttered }
}
