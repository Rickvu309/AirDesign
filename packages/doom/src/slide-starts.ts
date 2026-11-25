import type { AgentChange } from "./agent-change.js"
import { compileAgentEdit } from "./agent-edit.js"
import { contentAreaOf } from "./agent-place.js"
import { applyEdit } from "./apply-edit.js"
import { deckOf } from "./deck-of.js"
import type { Author, Doom, Write } from "./doom.js"
import { type NodeId, rev } from "./ids.js"
import { isRefusal } from "./refusal.js"
import type { Measure } from "./measure.js"
import { titleOnlyWrites, titleSlideWrites } from "./slide-placeholders.js"

export const slideStarts = ["title", "text", "kpis", "cards", "chart", "timeline", "grid", "blank"] as const
export type SlideStart = (typeof slideStarts)[number] | "titleOnly"

const author: Author = { kind: "person", id: "slide-start" }

const three = <T>(item: T): readonly T[] => [item, item, item]
const quarters = ["Q1", "Q2", "Q3", "Q4"] as const

function contentOf(start: SlideStart, slide: NodeId, area: ReturnType<typeof contentAreaOf>): readonly AgentChange[] {
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
    case "kpis":
      return [{ op: "add", kind: "kpi", slide, items: three({ title: "Metric", value: "00.0%", note: "Short note" }) }]
    case "cards":
      return [
        {
          op: "add",
          kind: "cards",
          slide,
          items: three({ title: "Heading", points: ["First detail", "Second detail"] }),
        },
      ]
    case "chart":
      return area === undefined ? [] : [{ op: "add", kind: "component", slide, component: "column", box: area }]
    case "timeline":
      return [
        {
          op: "add",
          kind: "timeline",
          slide,
          items: quarters.map((value) => ({ value, title: "Milestone", note: "Short note" })),
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
  measure?: Measure,
): readonly Write[] {
  const placeholders = placeholdersOf(start, slide, mint, deckOf(doom).size)
  const placed = applyEdit(doom, { once: "slide-start", author, writes: placeholders, rev: rev(doom.rev + 1) })
  if (isRefusal(placed)) return placeholders
  const changes = contentOf(start, slide, contentAreaOf(placed, slide))
  if (changes.length === 0) return placeholders
  const compiled = compileAgentEdit(placed, changes, {
    author,
    once: "slide-start-content",
    mint,
    ...(measure === undefined ? {} : { measure }),
  })
  return "refused" in compiled ? placeholders : [...placeholders, ...compiled.edit.writes]
}
