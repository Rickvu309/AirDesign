import { foldGrid } from "@airdesign/document"
import {
  elementCommand,
  elementStacks,
  foldSlides,
  groupCommand,
  openingIcon,
  presentSlides,
  readTableValue,
  hasSlideNumber,
  plainSlideNumber,
  shapeOf,
  slideBirths,
  type ElementCommand,
  type Geometry,
  type IndexElement,
  type Media,
  type SlideCommand,
  type SlideId,
  type SlideState,
} from "@airdesign/document"

import { deckLayouts } from "./deck-layouts.js"
import { slideAddresses, slidePart } from "./package-address.js"
import { withFileSections, writeSlideGroups } from "./slide-group-write.js"
import { addPicture } from "./picture-write.js"
import { layoutPart, withLayoutPlaceholders } from "./slide-placeholders.js"
import { arrangeSlide, stacksOf } from "./element-stack-route.js"
import { applyRoute } from "./slide-route.js"
import { applyStructuralRoute } from "./structural-route.js"
import { groupsReplayed, type GroupedState } from "./group-route.js"

function idsOf(parts: ReadonlyMap<string, Uint8Array>): string[] {
  return slideAddresses(parts).map((address) => address.slide)
}

function createdId(before: readonly string[], after: readonly string[]): string {
  const seen = new Set(before)
  const created = after.filter((id) => !seen.has(id))
  const id = created.length === 1 ? created[0] : undefined
  if (id === undefined) throw new Error("slide")
  return id
}

function placed(parts: ReadonlyMap<string, Uint8Array>, wanted: readonly string[]): ReadonlyMap<string, Uint8Array> {
  let next = parts
  for (let index = 0; index < wanted.length; index += 1) {
    const addresses = idsOf(next)
    const wantedId = wanted[index]
    if (wantedId === undefined || addresses[index] === wantedId) continue
    const before = addresses[index]
    if (before === undefined) throw new Error("slide")
    next = applyStructuralRoute(next, { name: "sldIdLst.order", slide: wantedId, before })
  }
  return next
}

type Shown = {
  readonly start: boolean
  readonly now: boolean
  readonly element?: IndexElement
  readonly media?: Media | undefined
  readonly geometry?: Geometry | undefined
}

type Pending = Map<SlideId, Map<string, Shown>>

function pendingAfter(pending: Pending, command: ElementCommand): void {
  if (command.slide === "element-order") return
  const shapes = pending.get(command.id) ?? new Map<string, Shown>()
  pending.set(command.id, shapes)
  if (command.slide === "element-add") {
    const { element, media, geometry } = command
    const shown = { start: false, now: true, element, media, geometry }
    shapes.set(shapeOf(command.element.node).shape, shown)
    return
  }
  const shape = shapeOf(command.node).shape
  const kept = shapes.get(shape) ?? { start: true, now: true }
  shapes.set(shape, { ...kept, now: command.slide === "element-restore" })
}

function elementAdded(
  parts: ReadonlyMap<string, Uint8Array>,
  part: string,
  shape: string,
  shown: Shown,
  media: MediaBytes,
): ReadonlyMap<string, Uint8Array> {
  const { element } = shown
  const box = element?.box ?? null
  if (element === undefined || box === null) throw new Error("box")
  const id = Number(shape)
  if (shown.media !== undefined)
    return addPicture(parts, part, { id, box, source: { media: shown.media, bytes: media(shown.media.sha256) } })
  const icon = element.kind === "shape" && element.value === null ? openingIcon(element) : null
  if (icon !== null) return addPicture(parts, part, { id, box, source: { icon } })
  if (shown.geometry !== undefined)
    return applyStructuralRoute(parts, { name: "spTree.add", part, id, text: "", geometry: shown.geometry, ...box })
  if (element.kind !== "table") {
    const added = applyRoute(parts, { name: "add", part, id, text: "", ...box })
    if (!hasSlideNumber(element.value)) return added
    return applyRoute(added, {
      name: "text",
      part,
      shape,
      value: [
        {
          from: 0,
          runs: [{ from: -1, text: "1", slideNumber: plainSlideNumber }],
        },
      ],
    })
  }
  const table = readTableValue(element.value ?? "")
  const columns = table?.rows[0]?.cells.length
  if (table === null || columns === undefined) throw new Error("a:tbl")
  return applyStructuralRoute(parts, {
    name: "graphicFrame.addTable",
    part,
    id,
    ...box,
    rows: table.rows.length,
    columns,
  })
}

function elementsShown(
  parts: ReadonlyMap<string, Uint8Array>,
  slide: string,
  shapes: ReadonlyMap<string, Shown> | undefined,
  media: MediaBytes,
  now: boolean,
  grouped: ReadonlySet<string>,
): ReadonlyMap<string, Uint8Array> {
  const part = slidePart(parts, slide)
  if (part === null) throw new Error("slide")
  let next = parts
  for (const [shape, shown] of shapes ?? []) {
    const passing = !shown.start && !shown.now && grouped.has(shape)
    if (!passing && (shown.start === shown.now || shown.now !== now)) continue
    next = now ? elementAdded(next, part, shape, shown, media) : applyRoute(next, { name: "remove", part, shape })
  }
  return next
}

function groupedShapes(state: GroupedState, from: SlideId, upTo: number): ReadonlySet<string> {
  const nodes = state.order.slice(0, upTo).flatMap((command) => {
    if (!groupCommand(command) || command.id !== from) return []
    if (command.slide === "element-group") return command.members.map((member) => member.node)
    return command.slide === "element-join" ? [command.member.node] : []
  })
  return new Set(nodes.map((node) => shapeOf(node).shape))
}

function slideShown(
  parts: ReadonlyMap<string, Uint8Array>,
  minted: string,
  from: SlideId,
  state: GroupedState,
  upTo: number,
  shapes: ReadonlyMap<string, Shown> | undefined,
  media: MediaBytes,
): ReadonlyMap<string, Uint8Array> {
  const members = groupedShapes(state, from, upTo)
  const added = elementsShown(parts, minted, shapes, media, true, members)
  const grouped = groupsReplayed(added, minted, from, state, upTo)
  return elementsShown(grouped, minted, shapes, media, false, members)
}

function needed(state: SlideState): ReadonlySet<SlideId> {
  const kept = new Set<SlideId>(presentSlides(state).map((spot) => spot.id))
  for (const command of foldGrid(state).effects.toReversed()) {
    if (!kept.has(command.id)) continue
    if (command.slide === "add") kept.add(command.after).add(command.layout)
    if (command.slide === "clone") kept.add(command.source)
  }
  return kept
}

function chosenLayout(
  parts: ReadonlyMap<string, Uint8Array>,
  minted: ReadonlyMap<string, string>,
  command: Extract<SlideCommand, { readonly slide: "add" }>,
): string | null {
  if (command.layoutPart !== undefined && deckLayouts(parts).some((layout) => layout.part === command.layoutPart)) {
    return command.layoutPart
  }
  const layoutSlide = slidePart(parts, minted.get(command.layout) ?? "")
  return layoutSlide === null ? null : layoutPart(parts, layoutSlide)
}

export type MediaBytes = (sha256: string) => Uint8Array | undefined

const noMedia: MediaBytes = () => undefined

export function orderedParts(
  parts: ReadonlyMap<string, Uint8Array>,
  given: GroupedState,
  media: MediaBytes = noMedia,
): ReadonlyMap<string, Uint8Array> {
  if (given.order.length === 0) return parts
  const state = withFileSections(given, parts)
  const minted = new Map<string, string>(state.file.map((id) => [id, id]))
  const kept = needed(state)
  const pending: Pending = new Map()
  let next: ReadonlyMap<string, Uint8Array> = parts
  for (const [at, edit] of state.order.entries()) {
    if (elementCommand(edit)) {
      if (kept.has(edit.id)) pendingAfter(pending, edit)
      continue
    }
    for (const command of slideBirths(edit)) {
      if (!kept.has(command.id)) continue
      const anchorId = minted.get(command.slide === "add" ? command.after : command.source)
      if (anchorId === undefined) throw new Error("slide")
      const before = idsOf(next)
      const layout = command.slide === "add" ? chosenLayout(next, minted, command) : null
      const route =
        command.slide === "add"
          ? ({ name: "sldIdLst.add", after: anchorId, id: command.id, ...(layout === null ? {} : { layout }) } as const)
          : ({ name: "sldIdLst.clone", slide: anchorId, id: command.id } as const)
      next = applyStructuralRoute(next, route)
      const id = createdId(before, idsOf(next))
      minted.set(command.id, id)
      if (command.slide === "clone") {
        next = slideShown(next, id, command.source, state, at + 1, pending.get(command.source), media)
        const prefix = {
          file: state.file,
          order: state.order.slice(0, at + 1),
          ...(state.index === undefined ? {} : { index: state.index }),
        }
        next = arrangeSlide(next, id, stacksOf(prefix, command.source))
        continue
      }
      const born = slidePart(next, id)
      if (born !== null && layout !== null) next = withLayoutPlaceholders(next, born, layout)
    }
  }
  const shaped = new Set<SlideId>([...pending.keys(), ...state.order.filter(groupCommand).map((command) => command.id)])
  for (const slide of shaped) {
    const id = minted.get(slide)
    if (id === undefined || !kept.has(slide)) continue
    next = slideShown(next, id, slide, state, state.order.length, pending.get(slide), media)
  }
  if (state.order.some((command) => command.slide === "element-order")) {
    const stacks = elementStacks(state)
    for (const spot of presentSlides(state)) {
      const id = minted.get(spot.id)
      if (id === undefined) continue
      next = arrangeSlide(
        next,
        id,
        stacks.filter((stack) => stack.slide === spot.id),
      )
    }
  }
  for (const spot of foldSlides(state)) {
    if (spot.present) continue
    const id = minted.get(spot.id)
    if (id === undefined) continue
    next = applyStructuralRoute(next, { name: "sldIdLst.remove", slide: id })
    minted.delete(spot.id)
  }
  const wanted: string[] = []
  for (const spot of presentSlides(state)) {
    const id = minted.get(spot.id)
    if (id === undefined) throw new Error("slide")
    wanted.push(id)
  }
  return writeSlideGroups(placed(next, wanted), parts, state, minted)
}
