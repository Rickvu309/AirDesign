import { readDeckId } from "@airdesign/catalog"
import { elementId } from "@airdesign/document"
import { call, indexDeck, openDeck, readDeckPage, type Deck } from "@airdesign/engine"

type Spec = Record<string, boolean | number | string>
type Graph = { states: Map<string, Spec>; edges: { from: string; to: string; action: string }[] }
const parsed = readDeckId("index-replay")
if (!parsed.ok) throw new Error("deck")
const id = parsed.deck
const node = elementId("258.1")
const pages = [0, 1].map((offset) => ({
  deck: id,
  offset,
  once: `page-${offset}`,
  total: 2,
  slides: [{ id: "258", position: 0 }],
  elements: [{ node: elementId(`258.${offset + 1}`), kind: "shape", value: "Title", box: null, grouped: false }],
}))

function store(deck: Deck, page: number): Deck {
  const indexed = indexDeck(deck, { actor: "person" }, pages[page])
  if (!indexed.ok) throw new Error(indexed.refusal)
  return indexed.deck
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

export function replayIndex(graph: Graph, failures: string[]) {
  let replayed = 0
  let stuttered = 0
  for (const edge of graph.edges) {
    const source = graph.states.get(edge.from)
    const target = graph.states.get(edge.to)
    if (source === undefined || target === undefined) throw new Error("state")
    let deck = openDeck(id)
    if (source.edited === true) deck = edit(deck)
    for (let n = 0; n < Number(source.stored); n += 1) deck = store(deck, n)
    if (edge.action === "Store") {
      deck = store(deck, Number(source.sent) - 1)
      replayed += 1
    } else if (edge.action === "Edit") {
      deck = edit(deck)
      replayed += 1
    } else stuttered += 1
    const read = readDeckPage(deck, { runId: null })
    if (
      deck.register.index?.elements.length !== (Number(target.stored) || undefined) ||
      read.revision !== target.revision ||
      read.elements.some((element) => element.closed)
    ) {
      failures.push(`index ${edge.action} disagrees with stored pages or edit revision`)
    }
    const title = read.elements.find((element) => element.node === node)
    if (target.edited === true && (title?.value !== "After" || title.version !== 1)) {
      failures.push(`index ${edge.action} changed an existing edit`)
    }
    if (target.edited === false && Number(target.stored) > 0 && (title?.value !== "Title" || title.version !== 0)) {
      failures.push(`index ${edge.action} made a floor into an edit`)
    }
  }
  return { replayed, stuttered }
}
