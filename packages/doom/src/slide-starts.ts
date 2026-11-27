import type { Intent } from "./intent-read.js"
import { compileIntents } from "./intent-edit.js"
import { applyEdit } from "./apply-edit.js"
import { deckOf } from "./deck-of.js"
import type { Author, Doom, Write } from "./doom.js"
import { type NodeId, rev } from "./ids.js"
import { isRefusal } from "./refusal.js"
import type { Measure } from "./measure.js"
import type { PlacementRules } from "./placement-rules.js"
import { titleOnlyWrites, titleSlideWrites } from "./slide-placeholders.js"
import type { StartRules } from "./start-rules.js"

export const slideStarts = ["title", "text", "grid", "blank"] as const
export type SlideStart = (typeof slideStarts)[number] | "titleOnly"

const author: Author = { kind: "person", id: "slide-start" }

function contentOf(start: SlideStart, slide: NodeId, starts: StartRules): readonly Intent[] {
  const content = start === "text" || start === "grid" ? starts.content[start] : []
  return content.map((intent) => ({ ...intent, slide }))
}

function placeholdersOf(
  start: SlideStart,
  slide: NodeId,
  mint: () => NodeId,
  size: { w: number; h: number },
  starts: StartRules,
) {
  if (start === "blank") return []
  return start === "title" ? titleSlideWrites(slide, mint, size, starts) : titleOnlyWrites(slide, mint, size, starts)
}

export function slideStartWrites(
  doom: Doom,
  slide: NodeId,
  mint: () => NodeId,
  start: SlideStart,
  placement: PlacementRules,
  starts: StartRules,
  measure?: Measure,
): readonly Write[] {
  const placeholders = placeholdersOf(start, slide, mint, deckOf(doom).size, starts)
  const placed = applyEdit(doom, { once: "slide-start", author, writes: placeholders, rev: rev(doom.rev + 1) })
  if (isRefusal(placed)) return placeholders
  const intents = contentOf(start, slide, starts)
  if (intents.length === 0) return placeholders
  const compiled = compileIntents(placed, intents, {
    author,
    once: "slide-start-content",
    mint,
    placement,
    starts,
    ...(measure === undefined ? {} : { measure }),
  })
  return "refused" in compiled ? placeholders : [...placeholders, ...compiled.edit.writes]
}
