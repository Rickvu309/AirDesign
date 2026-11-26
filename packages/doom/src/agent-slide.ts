import type { AgentChange } from "./agent-change.js"
import { slideForm, type SlideAdd, type SlideMove } from "./agent-slide-fields.js"
import { type Draft, living, put, stop } from "./agent-draft.js"
import type { NodeId } from "./ids.js"
import type { Node } from "./doom.js"
import { childrenOf, deckOf, isLive, parentOf, rowsOf, slideRowAt, slidesOf } from "./doom-walk.js"
import { slideGroups, slidePlacementWrites } from "./slide-placement.js"

const groupNeeds = "a slide group id from read_deck, where a slide line ends with group=<id>"
const inGroupNeeds = "a slide id in that group, or null to put these first"

function deckSlide(draft: Draft, id: NodeId, field: string): Node {
  const node = living(draft, id, field)
  return node.type === "slide" && slidesOf(draft.doom).some((slide) => slide.id === id)
    ? node
    : stop("shape", id, field, "form", "A slide id from airdesign_read_deck.")
}

function requireGroup(draft: Draft, id: NodeId, field: string): NodeId {
  const node = draft.doom.nodes.get(id)
  if (!isLive(node)) stop("missing", id, field, "needs", groupNeeds)
  return rowsOf(draft.doom, false).some((row) => row.id === id) ? id : stop("shape", id, field, "needs", groupNeeds)
}

function groupAnchor(draft: Draft, id: NodeId | null, field: string): NodeId | null {
  if (id === null) return null
  requireGroup(draft, id, field)
  return slideGroups(draft.doom).some((group) => group.group === id)
    ? id
    : stop("shape", id, field, "needs", "a slide group with at least one slide from airdesign_read_deck")
}

function addSlide(draft: Draft, { group, after }: SlideAdd): void {
  const { doom } = draft
  if (group === undefined && after === null) stop("shape", undefined, "after", "form", slideForm.addFirst)
  if (deckOf(doom) === undefined) stop("missing")
  const slide = draft.mint()
  draft.writes.push({ node: slide, prop: "type", value: "slide" })
  if (group === "new") {
    const anchor = after === undefined ? undefined : groupAnchor(draft, after, "after")
    draft.writes.push(
      ...slidePlacementWrites(doom, {
        kind: "newGroup",
        group: draft.mint(),
        slides: [slide],
        ...(anchor === undefined ? {} : { after: anchor }),
      }),
    )
  } else {
    const row = group === undefined ? undefined : requireGroup(draft, group, "group")
    const previous =
      after === undefined
        ? (row === undefined ? slidesOf(doom) : childrenOf(doom, row)).at(-1)
        : after === null
          ? undefined
          : deckSlide(draft, after, "after")
    const destination = row ?? parentOf(previous)?.id ?? slideRowAt(doom, "last")
    if (destination === undefined) {
      draft.writes.push(...slidePlacementWrites(doom, { kind: "newGroup", group: draft.mint(), slides: [slide] }))
    } else {
      if (previous !== undefined && parentOf(previous)?.id !== destination)
        stop("shape", previous.id, "after", "needs", inGroupNeeds)
      draft.writes.push(
        ...slidePlacementWrites(doom, {
          kind: "slides",
          group: destination,
          slides: [slide],
          after: previous?.id ?? null,
        }),
      )
    }
  }
  put(draft, slide, { name: `Slide ${slidesOf(doom).length + 1}` }, true)
}

function moveSlide(draft: Draft, { slide, slides, group, after, before }: SlideMove): void {
  const { doom } = draft
  if (slide !== undefined && slides !== undefined) stop("shape", undefined, "move", "form", slideForm.notBoth)
  if (slides?.length === 0) stop("shape", undefined, "slides", "needs", "at least one slide id")
  const ids = [...new Set(slides ?? (slide === undefined ? [] : [slide]))]
  if (ids.length === 0) {
    if (group === "new") stop("shape", undefined, "group", "form", slideForm.newSlides)
    if (group === undefined) stop("shape", undefined, "move", "form", slideForm.moveWhat)
    if (before === undefined ? after === undefined : after !== undefined)
      stop("shape", undefined, "after", "form", slideForm.followGroup)
    const source = requireGroup(draft, group, "group")
    const field = before === undefined ? "after" : "before"
    const anchor = groupAnchor(draft, before ?? after ?? null, field)
    if (anchor === source) stop("shape", source, field, "form", "Use a different slide group.")
    draft.writes.push(...slidePlacementWrites(doom, { kind: "moveGroup", group: source, anchor, side: field }))
    return
  }
  if (before !== undefined) stop("shape", undefined, "before", "form", slideForm.beforeGroup)
  if (after === undefined) stop("shape", undefined, "after", "missing", slideForm.followSlide)
  for (const id of ids) deckSlide(draft, id, slides === undefined ? "move" : "slides")
  if (group === "new") {
    const anchor = groupAnchor(draft, after, "after")
    draft.writes.push(
      ...slidePlacementWrites(doom, { kind: "newGroup", group: draft.mint(), slides: ids, after: anchor }),
    )
    return
  }
  if (after !== null && ids.includes(after))
    stop("shape", after, "after", "form", "Use a different slide, or null to put these first.")
  const previous = after === null ? undefined : deckSlide(draft, after, "after")
  const row =
    group === undefined ? (parentOf(previous)?.id ?? slideRowAt(doom, "first")) : requireGroup(draft, group, "group")
  if (row === undefined) stop("missing", undefined, "group", "needs", groupNeeds)
  if (previous !== undefined && parentOf(previous)?.id !== row)
    stop("shape", previous.id, "after", "needs", inGroupNeeds)
  draft.writes.push(...slidePlacementWrites(doom, { kind: "slides", group: row, slides: ids, after }))
}

export function compileSlide(draft: Draft, change: Extract<AgentChange, { op: "slide" }>): void {
  const given = [change.add, change.move, change.delete].filter((part) => part !== undefined)
  if (given.length !== 1) stop("shape", undefined, "slide", "form", "Exactly one of add, move or delete.")
  if (change.add !== undefined) return addSlide(draft, change.add)
  if (change.move !== undefined) return moveSlide(draft, change.move)
  if (change.delete !== undefined)
    draft.writes.push({ node: deckSlide(draft, change.delete, "delete").id, prop: "parent", value: null })
}
