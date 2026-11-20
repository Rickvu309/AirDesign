import {
  elementStacks,
  groupCommand,
  groupNode,
  landedPatch,
  openingPlace,
  madeGroup,
  plainGroup,
  shapeOf,
  throughGroup,
  type DeckIndex,
  type ElementClone,
  type Member,
  type Place,
  type Register,
  type SlideId,
  type SlideState,
  type TraitPatch,
} from "@airdesign/document"
import { arrangeSlide } from "./element-stack-route.js"
import { joinShape, regroupSaved, shapePlace, unwrapGroup, wrapGroup, type SavedGroup } from "./group-write.js"
import { slidePart } from "./package-address.js"
import { pasteShape } from "./shape-paste.js"
import { applyStructuralRoute } from "./structural-route.js"
import { requireMarkup } from "./part-markup.js"
import { removeShape } from "./slide-route.js"
import { writeTrait } from "./trait-xml.js"

type Parts = ReadonlyMap<string, Uint8Array>

export type GroupedState = SlideState & { readonly index?: DeckIndex; readonly elements?: Register["elements"] }

function boxPatch(place: Place): TraitPatch<"box"> {
  return {
    x: { set: place.box.x },
    y: { set: place.box.y },
    w: { set: place.box.cx },
    h: { set: place.box.cy },
    rot: { set: place.rot },
    flipH: { set: place.flipH },
    flipV: { set: place.flipV },
  }
}

const indexTurn = 6_000

function keptTurn(place: Place, filed: Place | null): Place {
  if (filed === null || Math.round(filed.rot / indexTurn) !== Math.round(place.rot / indexTurn)) return place
  return { ...place, rot: filed.rot }
}

function memberPlace(member: Member): Place {
  return { box: member.box, rot: member.rot ?? 0, flipH: member.flipH === true, flipV: member.flipV === true }
}

function withPart(parts: Parts, part: string, bytes: Uint8Array): Parts {
  const next = new Map(parts)
  next.set(part, bytes)
  return next
}

function bytesOf(parts: Parts, part: string): Uint8Array {
  const bytes = parts.get(part)
  if (bytes === undefined) throw new Error("part")
  return bytes
}

function rowsOf(state: GroupedState, node: Parameters<typeof shapeOf>[0]): TraitPatch<"box"> | undefined {
  const body = state.elements === undefined || !Object.hasOwn(state.elements, node) ? undefined : state.elements[node]
  return body === undefined ? undefined : landedPatch(body, "text").box
}

function holds(bytes: Uint8Array, shapes: readonly string[]): boolean {
  const { elements } = requireMarkup(bytes)
  return shapes.every((shape) => elements.some((mark) => mark.kind === "p:cNvPr" && mark.id === shape))
}

export type PasteSource = (command: ElementClone, at: number) => { readonly parts: Parts; readonly part: string }

function layerIds(command: ElementClone): readonly (readonly [string, number])[] {
  return (command.layers ?? []).map(
    ({ source, element }) => [shapeOf(source).shape, Number(shapeOf(element.node).shape)] as const,
  )
}

function clonedLayers(parts: Parts, minted: string, part: string, command: ElementClone): Parts {
  const ids = layerIds(command)
  const copy = Number(shapeOf(command.element.node).shape)
  const source = shapeOf(command.source).shape
  return placedLayers(
    applyStructuralRoute(parts, { name: "spTree.clone", part, shape: source, id: copy, ids }),
    minted,
    part,
    command,
  )
}

function pastedLayers(
  parts: Parts,
  minted: string,
  part: string,
  command: ElementClone,
  from: PasteSource,
  at: number,
) {
  const source = from(command, at)
  const shape = shapeOf(command.source).shape
  const id = Number(shapeOf(command.element.node).shape)
  const pasted = { source: source.parts, from: source.part, shape, id, ids: new Map(layerIds(command)) }
  return placedLayers(pasteShape(parts, part, pasted), minted, part, command)
}

function placedLayers(parts: Parts, minted: string, part: string, command: ElementClone): Parts {
  const layers = command.layers ?? []
  let next = parts
  const grouped = command.element.grouped ? [command.element] : []
  for (const element of [...grouped, ...layers.map((layer) => layer.element)]) {
    const place = openingPlace(element)
    const where = { slide: minted, part, shape: shapeOf(element.node).shape }
    if (place !== null && element.framing === undefined) next = writeTrait(next, where, "box", boxPatch(place))
  }
  return next
}

function noPaste(): never {
  throw new Error("slide")
}

export function groupsReplayed(
  parts: Parts,
  minted: string,
  from: SlideId,
  state: GroupedState,
  upTo: number,
  pasted: PasteSource = noPaste,
): Parts {
  const saved = new Map<string, SavedGroup>()
  const passed = new Set<string>()
  let next = parts
  for (let at = 0; at < upTo; at += 1) {
    const command = state.order[at]
    if (command?.slide === "element-clone" && command.id === from) {
      const part = slidePart(next, minted)
      if (part === null) throw new Error("slide")
      if (shapeOf(command.source).slide !== from) next = pastedLayers(next, minted, part, command, pasted, at)
      else if (holds(bytesOf(next, part), [shapeOf(command.source).shape]))
        next = clonedLayers(next, minted, part, command)
      continue
    }
    if (command === undefined || !groupCommand(command) || command.id !== from) continue
    const part = slidePart(next, minted)
    if (part === null) throw new Error("slide")
    const members = command.slide === "element-group" ? command.members.map((member) => shapeOf(member.node).shape) : []
    if (command.slide === "element-group" && !holds(bytesOf(next, part), members))
      passed.add(shapeOf(groupNode(command)).shape)
    if (passed.has(shapeOf(groupNode(command)).shape)) continue
    const prefix = {
      file: state.file,
      order: state.order.slice(0, at),
      ...(state.index === undefined ? {} : { index: state.index }),
    }
    next = arrangeSlide(
      next,
      minted,
      elementStacks(prefix).filter((stack) => stack.slide === from),
    )
    const where = (shape: string) => ({ slide: minted, part, shape })
    if (command.slide === "element-join") {
      const { frame, before, member } = command
      if (frame !== null && passed.has(shapeOf(frame).shape)) continue
      const own = shapeOf(member.node).shape
      const placed = joinShape(
        bytesOf(next, part),
        own,
        frame === null ? null : shapeOf(frame).shape,
        before === null ? null : shapeOf(before).shape,
      )
      next = withPart(next, part, placed)
      const after = { ...prefix, order: state.order.slice(0, at + 1) }
      if (frame !== null && plainGroup(after, frame)) {
        const filed = shapePlace(bytesOf(next, part), own)
        next = writeTrait(next, where(own), "box", boxPatch(keptTurn(memberPlace(member), filed)))
      }
      continue
    }
    if (command.slide === "element-group") {
      const { element } = command
      if (element.box === null) throw new Error("box")
      const backdrop = command.backdrop === undefined ? undefined : Number(shapeOf(command.backdrop.node).shape)
      next = withPart(
        next,
        part,
        wrapGroup(bytesOf(next, part), Number(shapeOf(element.node).shape), element.box, members, backdrop),
      )
      for (const member of command.members) {
        const shape = shapeOf(member.node).shape
        const filed = shapePlace(bytesOf(next, part), shape)
        next = writeTrait(next, where(shape), "box", boxPatch(keptTurn(memberPlace(member), filed)))
      }
      continue
    }
    const shape = shapeOf(command.node).shape
    if (command.slide === "element-regroup") {
      const kept = saved.get(shape)
      if (kept === undefined) throw new Error("p:grpSp")
      next = withPart(next, part, regroupSaved(bytesOf(next, part), kept))
      continue
    }
    const backdrop = madeGroup(prefix, command.node)?.backdrop?.node
    const rows = rowsOf(state, command.node)
    if (rows !== undefined && backdrop === undefined) next = writeTrait(next, where(shape), "box", rows)
    const unwrapped = unwrapGroup(bytesOf(next, part), shape)
    next = withPart(next, part, unwrapped.bytes)
    if (backdrop !== undefined) {
      const dropped = shapeOf(backdrop).shape
      const children = unwrapped.saved.children.filter((child) => child !== dropped)
      saved.set(shape, { ...unwrapped.saved, children })
      next = withPart(next, part, removeShape(bytesOf(next, part), dropped))
      continue
    }
    saved.set(shape, unwrapped.saved)
    const { frame, place } = unwrapped
    if (frame === null || place === null) continue
    for (const child of unwrapped.children) {
      const own = shapePlace(bytesOf(next, part), child)
      if (own !== null) next = writeTrait(next, where(child), "box", boxPatch(throughGroup(own, place, frame)))
    }
  }
  return next
}
