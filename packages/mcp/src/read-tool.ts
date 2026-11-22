import { readDeckQuery, readNamedDeck } from "@airdesign/catalog"
import { scene } from "@airdesign/document"

import { answered, hostRefused, refused, type ToolResult } from "./answer.js"
import type { DeckHost, Opened } from "./deck-host.js"

const readBytes = 24_000

const lead = (opened: Opened, count: number) =>
  `Deck ${opened.deck} "${scene.deckName(opened.fold)}" at rev ${String(opened.rev)}, ${String(count)} slides. Send rev as base to airdesign_edit_deck.`

export function readAnswer(
  opened: Opened,
  query: { readonly slide?: string | undefined; readonly cursor?: string | undefined },
): ToolResult {
  const slides = scene.slidesOf(opened.fold).map((slide) => slide.id)
  const { slide, cursor } = query
  const alone = slide === undefined ? undefined : slides.find((id) => id === slide)
  if (slide !== undefined && alone === undefined) return refused("dead", { node: slide })
  const from = cursor === undefined ? 0 : slides.findIndex((id) => id === cursor)
  if (cursor !== undefined && from < 0) return refused("dead", { node: cursor })
  const wanted = alone === undefined ? slides.slice(from) : [alone]
  const chosen: typeof slides = []
  let bytes = 0
  for (const slide of wanted) {
    bytes += scene.readForAgent(opened.fold, [slide]).length
    if (chosen.length > 0 && bytes > readBytes) break
    chosen.push(slide)
  }
  const next = wanted[chosen.length]
  const answer = {
    ok: true,
    deck: opened.deck,
    rev: opened.rev,
    name: scene.deckName(opened.fold),
    slides,
    ...(next === undefined ? {} : { next }),
  }
  return answered(lead(opened, slides.length), answer, scene.readForAgent(opened.fold, chosen))
}

export async function readDeckTool(raw: unknown, host: DeckHost): Promise<ToolResult> {
  const named = readNamedDeck(raw)
  if (!named.ok) return refused(named.refusal)
  const opened = await host.open(named.deck)
  if (!opened.ok) return hostRefused(opened)
  const parsed = readDeckQuery(raw)
  if (!parsed.ok) return refused(parsed.refusal)
  return readAnswer(opened, parsed)
}
