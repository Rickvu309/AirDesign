import type { Stack } from "@airdesign/catalog"
import {
  groupedNow,
  readSlideId,
  shapeOf,
  sitsBefore,
  slideLayers,
  stackTarget,
  type ElementId,
} from "@airdesign/document"
import { decided, ready } from "./agent-elements.js"
import type { Applied } from "./apply-change.js"
import type { Deck } from "./call.js"

function stackedBefore(among: readonly ElementId[], node: ElementId, stack: Stack): ElementId | null | undefined {
  if (typeof stack === "string") return stackTarget(among, node, stack)
  const other = "above" in stack ? stack.above : stack.below
  const rest = among.filter((id) => id !== node)
  const at = rest.indexOf(other)
  if (at < 0) return undefined
  const before = "above" in stack ? (rest[at + 1] ?? null) : other
  return sitsBefore(among, node) === before ? undefined : before
}

export function applyStack(deck: Deck, node: ElementId, stack: Stack, runId: string, base: number): Applied {
  const slide = readSlideId(shapeOf(node).slide)
  const opened = ready({ deck: deck.id, base }, deck, slide, runId)
  if ("refusal" in opened) return { ok: false, refusal: opened.refusal }
  if (slide === undefined) return { ok: false, refusal: "dead" }
  const among = slideLayers(deck.register, slide)
  if (among !== undefined && !among.includes(node) && !groupedNow(deck.register, node))
    return { ok: false, refusal: "dead" }
  if (among === undefined || !among.includes(node)) return { ok: false, refusal: "group-box" }
  if (typeof stack !== "string" && !among.includes("above" in stack ? stack.above : stack.below)) {
    return { ok: false, refusal: "group-box" }
  }
  const before = stackedBefore(among, node, stack)
  if (before === undefined) return { ok: true, register: deck.register }
  return decided(deck.register, opened.file, { slide: "element-order", id: slide, node, before, among, runId }, runId)
}
