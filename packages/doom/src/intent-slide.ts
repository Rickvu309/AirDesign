import type { Intent } from "./intent-read.js"
import { type SlideAdd, type SlideMove } from "./intent-slide-fields.js"
import { type Draft, living, put, stop } from "./intent-draft.js"
import type { NodeId } from "./ids.js"
import type { Node } from "./doom.js"
import { childrenOf, deckOf, isLive, parentOf, rowsOf, slideRowAt, slidesOf } from "./doom-walk.js"
import { slideGroups, slidePlacementWrites } from "./slide-placement.js"

const groupNeeds = { code: "read-slide-group" } as const
const inGroupNeeds = { code: "group-slide-or-null" } as const

function deckSlide(draft: Draft, id: NodeId, field: string): Node {
  const node = living(draft, id, field)
  return node.type === "slide" && slidesOf(draft.doom).some((slide) => slide.id === id)
    ? node
    : stop("shape", id, field, "form", { code: "read-slide-id" })
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
    : stop("shape", id, field, "needs", { code: "populated-slide-group" })
}

function addSlide(draft: Draft, { group, after }: SlideAdd): void {
  const { doom } = draft
  if (group === undefined && after === null) stop("shape", undefined, "after", "form", { code: "first-in-group" })
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
  if (slide !== undefined && slides !== undefined) stop("shape", undefined, "move", "form", { code: "slide-or-slides" })
  if (slides?.length === 0) stop("shape", undefined, "slides", "needs", { code: "slide-ids" })
  const ids = [...new Set(slides ?? (slide === undefined ? [] : [slide]))]
  if (ids.length === 0) {
    if (group === "new") stop("shape", undefined, "group", "form", { code: "new-slide-group" })
    if (group === undefined) stop("shape", undefined, "move", "form", { code: "slide-or-group" })
    if (before === undefined ? after === undefined : after !== undefined)
      stop("shape", undefined, "after", "form", { code: "before-or-after-group" })
    const source = requireGroup(draft, group, "group")
    const field = before === undefined ? "after" : "before"
    const anchor = groupAnchor(draft, before ?? after ?? null, field)
    if (anchor === source) stop("shape", source, field, "form", { code: "other-slide-group" })
    draft.writes.push(...slidePlacementWrites(doom, { kind: "moveGroup", group: source, anchor, side: field }))
    return
  }
  if (before !== undefined) stop("shape", undefined, "before", "form", { code: "before-group-only" })
  if (after === undefined) stop("shape", undefined, "after", "missing", { code: "after-slide" })
  for (const id of ids) deckSlide(draft, id, slides === undefined ? "move" : "slides")
  if (group === "new") {
    const anchor = groupAnchor(draft, after, "after")
    draft.writes.push(
      ...slidePlacementWrites(doom, { kind: "newGroup", group: draft.mint(), slides: ids, after: anchor }),
    )
    return
  }
  if (after !== null && ids.includes(after)) stop("shape", after, "after", "form", { code: "other-slide-or-null" })
  const previous = after === null ? undefined : deckSlide(draft, after, "after")
  const row =
    group === undefined ? (parentOf(previous)?.id ?? slideRowAt(doom, "first")) : requireGroup(draft, group, "group")
  if (row === undefined) stop("missing", undefined, "group", "needs", groupNeeds)
  if (previous !== undefined && parentOf(previous)?.id !== row)
    stop("shape", previous.id, "after", "needs", inGroupNeeds)
  draft.writes.push(...slidePlacementWrites(doom, { kind: "slides", group: row, slides: ids, after }))
}

export function compileSlide(draft: Draft, intent: Extract<Intent, { op: "slide" }>): void {
  const given = [intent.add, intent.move, intent.delete].filter((part) => part !== undefined)
  if (given.length !== 1) stop("shape", undefined, "slide", "form", { code: "slide-operation" })
  if (intent.add !== undefined) return addSlide(draft, intent.add)
  if (intent.move !== undefined) return moveSlide(draft, intent.move)
  if (intent.delete !== undefined)
    draft.writes.push({ node: deckSlide(draft, intent.delete, "delete").id, prop: "parent", value: null })
}
