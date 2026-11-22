import { readDeckQuery, readNamedDeck } from "@airdesign/catalog"
import { doom } from "@airdesign/document"

import { answered, hostRefused, refused, type ToolContent, type ToolResult } from "./answer.js"
import type { DeckHost, Opened } from "./deck-host.js"

const readBytes = 24_000
const picturesPerRead = 10

const pictureWords = {
  none: (slides: readonly string[], rev: number) =>
    `No current picture of ${slides.length === 1 ? "slide" : "slides"} ${slides.join(", ")} at rev ${String(rev)} yet. The owner's open AirDesign tab paints a slide a moment after it changes and none has sent it. Read again in a few seconds, or ask the owner to open the deck.`,
  more: (shown: number, total: number) =>
    `Pictures of the first ${String(shown)} of ${String(total)} slides. Read with slide and picture for another.`,
  slide: (position: number, id: string, rev: number) => `Slide ${String(position)} (${id}) at rev ${String(rev)}:`,
} as const

async function pictureBlocks(
  opened: Opened,
  slides: readonly doom.NodeId[],
  all: readonly doom.NodeId[],
  host: DeckHost,
): Promise<readonly ToolContent[]> {
  const wanted = slides.slice(0, picturesPerRead)
  const shots = host.pictures === undefined ? new Map() : await host.pictures(opened.deck, opened.fold, wanted)
  const blocks: ToolContent[] = []
  const waiting: string[] = []
  for (const id of wanted) {
    const data = shots.get(id)
    if (data === undefined) {
      waiting.push(id)
      continue
    }
    blocks.push({ type: "text", text: pictureWords.slide(all.indexOf(id) + 1, id, opened.rev) })
    blocks.push({ type: "image", data, mimeType: "image/jpeg" })
  }
  if (waiting.length > 0) blocks.push({ type: "text", text: pictureWords.none(waiting, opened.rev) })
  if (slides.length > wanted.length)
    blocks.push({ type: "text", text: pictureWords.more(wanted.length, slides.length) })
  return blocks
}

const lead = (opened: Opened, count: number) =>
  `Deck ${opened.deck} "${doom.deckName(opened.fold)}" at rev ${String(opened.rev)}, ${String(count)} slides. Send rev as base to airdesign_edit_deck.`

export function readAnswer(
  opened: Opened,
  query: { readonly slide?: string | undefined; readonly cursor?: string | undefined },
): ToolResult {
  const slides = doom.slidesOf(opened.fold).map((slide) => slide.id)
  const { slide, cursor } = query
  const alone = slide === undefined ? undefined : slides.find((id) => id === slide)
  if (slide !== undefined && alone === undefined) return refused("dead", { node: slide })
  const from = cursor === undefined ? 0 : slides.findIndex((id) => id === cursor)
  if (cursor !== undefined && from < 0) return refused("dead", { node: cursor })
  const wanted = alone === undefined ? slides.slice(from) : [alone]
  const chosen: typeof slides = []
  let bytes = 0
  for (const slide of wanted) {
    bytes += doom.readForAgent(opened.fold, [slide]).length
    if (chosen.length > 0 && bytes > readBytes) break
    chosen.push(slide)
  }
  const next = wanted[chosen.length]
  const answer = {
    ok: true,
    deck: opened.deck,
    rev: opened.rev,
    name: doom.deckName(opened.fold),
    slides,
    ...(next === undefined ? {} : { next }),
  }
  return answered(lead(opened, slides.length), answer, doom.readForAgent(opened.fold, chosen))
}

export async function readDeckTool(raw: unknown, host: DeckHost): Promise<ToolResult> {
  const named = readNamedDeck(raw)
  if (!named.ok) return refused(named.refusal)
  const opened = await host.open(named.deck)
  if (!opened.ok) return hostRefused(opened)
  const parsed = readDeckQuery(raw)
  if (!parsed.ok) return refused(parsed.refusal)
  const read = readAnswer(opened, parsed)
  if (parsed.picture !== true || !read.ok) return read
  const slides = doom.slidesOf(opened.fold).map((slide) => slide.id)
  const from = parsed.cursor === undefined ? 0 : slides.findIndex((id) => id === parsed.cursor)
  const wanted = parsed.slide === undefined ? slides.slice(from) : slides.filter((id) => id === parsed.slide)
  const pictures = await pictureBlocks(opened, wanted, slides, host)
  const last = read.content.length - 1
  return { ...read, content: [...read.content.slice(0, last), ...pictures, ...read.content.slice(last)] }
}
