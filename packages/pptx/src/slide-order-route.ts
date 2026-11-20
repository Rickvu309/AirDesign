import { foldGrid } from "@airdesign/document"
import {
  elementCommand,
  elementStacks,
  foldSlides,
  groupCommand,
  openingIcon,
  presentSlides,
  readSlideId,
  readTableValue,
  hasSlideNumber,
  plainSlideNumber,
  shapeOf,
  slideBirths,
  type ElementCommand,
  type Geometry,
  type IndexElement,
  type Box,
  type Media,
  type PastedLayers,
  type SlideCommand,
  type SlideId,
  type SlideState,
} from "@airdesign/document"

import { deckLayouts } from "./deck-layouts.js"
import { slideAddresses, slidePart } from "./package-address.js"
import { withFileSections, writeSlideGroups } from "./slide-group-write.js"
import { addPicture, linkedSource } from "./picture-write.js"
import { pasteMarkup } from "./shape-paste.js"
import { writeTrait } from "./trait-xml.js"
import { layoutPart, withLayoutPlaceholders } from "./slide-placeholders.js"
import { arrangeSlide, stacksOf } from "./element-stack-route.js"
import { applyRoute } from "./slide-route.js"
import { applyStructuralRoute } from "./structural-route.js"
import { groupsReplayed, type GroupedState, type PasteSource } from "./group-route.js"

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
  readonly pasted?: PastedLayers | undefined
  readonly source?: string
}

type Pending = Map<SlideId, Map<string, Shown>>

function pendingAfter(pending: Pending, command: ElementCommand): void {
  if (command.slide === "element-order") return
  const shapes = pending.get(command.id) ?? new Map<string, Shown>()
  pending.set(command.id, shapes)
  if (command.slide === "element-add") {
    const { element, media, geometry, pasted } = command
    const shown = { start: false, now: true, element, media, geometry, pasted }
    shapes.set(shapeOf(command.element.node).shape, shown)
    return
  }
  if (command.slide === "element-clone") {
    const shown = { start: false, now: true, element: command.element, source: shapeOf(command.source).shape }
    shapes.set(shapeOf(command.element.node).shape, shown)
    return
  }
  const shape = shapeOf(command.node).shape
  const kept = shapes.get(shape) ?? { start: true, now: true }
  shapes.set(shape, { ...kept, now: command.slide === "element-restore" })
}

function openedBody(
  parts: ReadonlyMap<string, Uint8Array>,
  part: string,
  shape: string,
  element: IndexElement,
): ReadonlyMap<string, Uint8Array> {
  const body = element.opening?.body
  return body === undefined ? parts : writeTrait(parts, { slide: "", part, shape }, "body", body)
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
  if (shown.source !== undefined)
    return applyStructuralRoute(parts, { name: "spTree.clone", part, shape: shown.source, id })
  if (shown.pasted !== undefined) return pastedLayers(parts, part, id, box, shown.pasted, media)
  if (shown.media !== undefined)
    return addPicture(parts, part, { id, box, source: { media: shown.media, bytes: media(shown.media.sha256) } })
  const icon = element.kind === "shape" && element.value === null ? openingIcon(element) : null
  if (icon !== null) return addPicture(parts, part, { id, box, source: { icon } })
  if (shown.geometry !== undefined)
    return applyStructuralRoute(parts, { name: "spTree.add", part, id, text: "", geometry: shown.geometry, ...box })
  if (element.kind !== "table") {
    const align = element.opening?.body === undefined ? {} : { align: "left" as const }
    const added = openedBody(
      applyRoute(parts, { name: "add", part, id, text: "", ...box, ...align }),
      part,
      shape,
      element,
    )
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

function pastedLayers(
  parts: ReadonlyMap<string, Uint8Array>,
  part: string,
  id: number,
  box: Box,
  pasted: PastedLayers,
  media: MediaBytes,
): ReadonlyMap<string, Uint8Array> {
  const next = new Map(parts)
  const linked = pasted.media.map((each) => linkedSource(next, part, { media: each, bytes: media(each.sha256) }).embed)
  const ids = new Map(pasted.layers.map((layer) => [layer.shape, Number(shapeOf(layer.element.node).shape)]))
  const placed = pasteMarkup(next, part, { markup: pasted.markup, shape: pasted.shape, id, ids, linked })
  if (placed === null) return parts
  const at = { slide: "", part, shape: String(id) }
  return writeTrait(placed, at, "box", { x: { set: box.x }, y: { set: box.y }, w: { set: box.cx }, h: { set: box.cy } })
}

function elementsShown(
  parts: ReadonlyMap<string, Uint8Array>,
  slide: string,
  shapes: ReadonlyMap<string, Shown> | undefined,
  media: MediaBytes,
  now: boolean,
  replayed: ReadonlySet<string>,
): ReadonlyMap<string, Uint8Array> {
  const part = slidePart(parts, slide)
  if (part === null) throw new Error("slide")
  let next = parts
  for (const [shape, shown] of shapes ?? []) {
    const passing = !shown.start && !shown.now && replayed.has(shape)
    if (now && shown.source !== undefined) continue
    if (!passing && (shown.start === shown.now || shown.now !== now)) continue
    next = now ? elementAdded(next, part, shape, shown, media) : applyRoute(next, { name: "remove", part, shape })
  }
  return next
}

function replayedShapes(state: GroupedState, from: SlideId, upTo: number): ReadonlySet<string> {
  const nodes = state.order.slice(0, upTo).flatMap((command) => {
    if (command.slide === "element-clone" && command.id === from)
      return shapeOf(command.source).slide === from ? [command.source, command.element.node] : [command.element.node]
    if (!groupCommand(command) || command.id !== from) return []
    if (command.slide === "element-group") return command.members.map((member) => member.node)
    return command.slide === "element-join" ? [command.member.node] : []
  })
  return new Set(nodes.map((node) => shapeOf(node).shape))
}

type Slided = {
  readonly state: GroupedState
  readonly media: MediaBytes
  readonly pasted: PasteSource
}

function slideBuilt(
  parts: ReadonlyMap<string, Uint8Array>,
  minted: string,
  from: SlideId,
  upTo: number,
  shapes: ReadonlyMap<string, Shown> | undefined,
  slided: Slided,
): ReadonlyMap<string, Uint8Array> {
  const added = elementsShown(parts, minted, shapes, slided.media, true, replayedShapes(slided.state, from, upTo))
  return groupsReplayed(added, minted, from, slided.state, upTo, slided.pasted)
}

function slideShown(
  parts: ReadonlyMap<string, Uint8Array>,
  minted: string,
  from: SlideId,
  upTo: number,
  shapes: ReadonlyMap<string, Shown> | undefined,
  slided: Slided,
): ReadonlyMap<string, Uint8Array> {
  const grouped = slideBuilt(parts, minted, from, upTo, shapes, slided)
  return elementsShown(grouped, minted, shapes, slided.media, false, replayedShapes(slided.state, from, upTo))
}

function pendingUpTo(state: SlideState, slide: SlideId, upTo: number): ReadonlyMap<string, Shown> | undefined {
  const pending: Pending = new Map()
  for (const command of state.order.slice(0, upTo))
    if (elementCommand(command) && command.id === slide) pendingAfter(pending, command)
  return pending.get(slide)
}

function pastedFrom(command: Extract<SlideCommand, { readonly slide: "element-clone" }>): SlideId | null {
  const source = readSlideId(shapeOf(command.source).slide)
  return source === undefined || source === command.id ? null : source
}

function needed(state: SlideState): ReadonlySet<SlideId> {
  const kept = new Set<SlideId>(presentSlides(state).map((spot) => spot.id))
  for (const command of foldGrid(state).effects.toReversed()) {
    if (!kept.has(command.id)) continue
    if (command.slide === "add") kept.add(command.after).add(command.layout)
    if (command.slide === "clone") kept.add(command.source)
  }
  for (const command of state.order.toReversed()) {
    if (command.slide !== "element-clone" || !kept.has(command.id)) continue
    const source = pastedFrom(command)
    if (source !== null) kept.add(source)
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
  let built = parts
  const sources = new Map<string, { readonly parts: ReadonlyMap<string, Uint8Array>; readonly part: string }>()
  const slided: Slided = {
    state,
    media,
    pasted(command, at) {
      const slide = pastedFrom(command)
      const id = slide === null ? undefined : minted.get(slide)
      if (slide === null || id === undefined) throw new Error("slide")
      const key = `${slide}@${String(at)}`
      const known = sources.get(key)
      if (known !== undefined) return known
      const shown = slideBuilt(built, id, slide, at, pendingUpTo(state, slide, at), slided)
      const part = slidePart(shown, id)
      if (part === null) throw new Error("slide")
      sources.set(key, { parts: shown, part })
      return { parts: shown, part }
    },
  }
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
        built = next
        next = slideShown(next, id, command.source, at + 1, pending.get(command.source), slided)
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
  built = next
  for (const slide of shaped) {
    const id = minted.get(slide)
    if (id === undefined || !kept.has(slide)) continue
    next = slideShown(next, id, slide, state.order.length, pending.get(slide), slided)
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
