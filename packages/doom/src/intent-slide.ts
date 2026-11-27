import type { Intent, SlideGroup } from "./intent-read.js"
import { type Draft, fitKind, living, onwards, put, stop } from "./intent-draft.js"
import { compileSet } from "./intent-set.js"
import type { NodeId } from "./ids.js"
import type { Node } from "./doom.js"
import { childrenOf, deckOf, isLive, parentOf, rowsOf, slideRowAt, slidesOf } from "./doom-walk.js"
import { slideGroups, slidePlacementWrites } from "./slide-placement.js"

type InsertSlide = Extract<Intent, { op: "insert"; kind: "slide" }>
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

function addSlide(draft: Draft, { group, after }: InsertSlide): NodeId {
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
  return slide
}

export type SlideWhere = { readonly group?: SlideGroup; readonly after?: NodeId | null; readonly before?: NodeId }

function moveGroup(draft: Draft, group: NodeId, { after, before, group: asked }: SlideWhere): void {
  if (asked !== undefined) stop("shape", group, "group", "unknown")
  if (before === undefined ? after === undefined : after !== undefined)
    stop("shape", undefined, "after", "form", { code: "before-or-after-group" })
  const source = requireGroup(draft, group, "targets")
  const field = before === undefined ? "after" : "before"
  const anchor = groupAnchor(draft, before ?? after ?? null, field)
  if (anchor === source) stop("shape", source, field, "form", { code: "other-slide-group" })
  draft.writes.push(...slidePlacementWrites(draft.doom, { kind: "moveGroup", group: source, anchor, side: field }))
}

export function moveSlides(draft: Draft, targets: readonly Node[], where: SlideWhere): void {
  const { doom } = draft
  const rows = targets.filter((node) => node.type === "slideRow")
  if (rows.length > 0 && targets.length > 1) stop("shape", rows[0]!.id, "targets", "form", { code: "slide-or-group" })
  if (rows.length > 0) return moveGroup(draft, rows[0]!.id, where)
  const { group, after, before } = where
  if (before !== undefined) stop("shape", undefined, "before", "form", { code: "before-group-only" })
  if (after === undefined) stop("shape", undefined, "after", "missing", { code: "after-slide" })
  const ids = [...new Set(targets.map((node) => deckSlide(draft, node.id, "targets").id))]
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

export function compileInsertSlide(draft: Draft, intent: InsertSlide): void {
  fitKind("insert", "slide", intent)
  const slide = addSlide(draft, intent)
  const { op: _op, kind: _kind, after: _after, group: _group, ...look } = intent
  if (Object.values(look).some((value) => value !== undefined))
    compileSet(onwards(draft), { ...look, op: "update", target: slide })
}

export function removeSlide(draft: Draft, id: NodeId): void {
  draft.writes.push({ node: deckSlide(draft, id, "targets").id, prop: "parent", value: null })
}
