import type { AgentChange } from "./agent-change.js"
import { compileAgentEdit } from "./agent-edit.js"
import { applyEdit } from "./apply-edit.js"
import { deckOf } from "./deck-of.js"
import type { Author, Doom, Write } from "./doom.js"
import { type NodeId, rev } from "./ids.js"
import { isRefusal } from "./refusal.js"
import type { Measure } from "./measure.js"
import type { PlacementRules } from "./placement-rules.js"
import { titleOnlyWrites, titleSlideWrites } from "./slide-placeholders.js"

export const slideStarts = ["title", "text", "grid", "blank"] as const
export type SlideStart = (typeof slideStarts)[number] | "titleOnly"

const author: Author = { kind: "person", id: "slide-start" }

function contentOf(start: SlideStart, slide: NodeId): readonly AgentChange[] {
  switch (start) {
    case "text":
      return [
        {
          op: "add",
          kind: "text",
          slide,
          textStyle: "body",
          text: ["First point", "Second point", "Third point"].map((point) => `- ${point}`).join("\n"),
        },
      ]
    case "grid":
      return [
        {
          op: "add",
          kind: "frame",
          slide,
          rows: [
            ["", "Column one", "Column two", "Column three"],
            ...["Row one", "Row two", "Row three"].map((row) => [row, "Text", "Text", "Text"]),
          ],
        },
      ]
    default:
      return []
  }
}

function placeholdersOf(start: SlideStart, slide: NodeId, mint: () => NodeId, size: { w: number; h: number }) {
  if (start === "blank") return []
  return start === "title" ? titleSlideWrites(slide, mint, size) : titleOnlyWrites(slide, mint, size)
}

export function slideStartWrites(
  doom: Doom,
  slide: NodeId,
  mint: () => NodeId,
  start: SlideStart,
  placement: PlacementRules,
  measure?: Measure,
): readonly Write[] {
  const placeholders = placeholdersOf(start, slide, mint, deckOf(doom).size)
  const placed = applyEdit(doom, { once: "slide-start", author, writes: placeholders, rev: rev(doom.rev + 1) })
  if (isRefusal(placed)) return placeholders
  const changes = contentOf(start, slide)
  if (changes.length === 0) return placeholders
  const compiled = compileAgentEdit(placed, changes, {
    author,
    once: "slide-start-content",
    mint,
    placement,
    ...(measure === undefined ? {} : { measure }),
  })
  return "refused" in compiled ? placeholders : [...placeholders, ...compiled.edit.writes]
}
