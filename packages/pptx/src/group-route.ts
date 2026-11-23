import {
  elementStacks,
  groupCommand,
  groupNode,
  openingPlace,
  madeGroup,
  plainGroup,
  shapeOf,
  throughGroup,
  type DeckIndex,
  type ElementClone,
  type Member,
  type Place,
  type SlideId,
  type SlideState,
  type TraitPatch,
} from "@airdesign/document"
import { arrangeSlide, raisedToTop } from "./element-stack-route.js"
import { joinShape, regroupSaved, shapePlace, unwrapGroup, type SavedGroup } from "./group-write.js"
import { pasteShape } from "./shape-paste.js"
import { applyStructuralRoute } from "./structural-route.js"
import { removeShape } from "./slide-route.js"
import { SlideEditor } from "./slide-editor.js"
import { writeTrait } from "./trait-xml.js"

type Parts = ReadonlyMap<string, Uint8Array>

export type GroupedState = SlideState & { readonly index?: DeckIndex }

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
  editor: SlideEditor,
  minted: string,
  part: string,
  from: SlideId,
  state: GroupedState,
  upTo: number,
  pasted: PasteSource = noPaste,
): void {
  const saved = new Map<string, SavedGroup>()
  const passed = new Set<string>()
  let pastedOnTop = false
  let hasOrder = false
  const where = (shape: string) => ({ slide: minted, part, shape })
  for (let at = 0; at < upTo; at += 1) {
    const command = state.order[at]
    if (command?.slide === "element-order" && command.id === from) {
      hasOrder = true
      continue
    }
    if (command?.slide === "element-add" && command.id === from && pastedOnTop) {
      const shape = shapeOf(command.element.node).shape
      editor.editWhole(part, (current) => raisedToTop(current, minted, shape))
      continue
    }
    if (command?.slide === "element-clone" && command.id === from) {
      if (shapeOf(command.source).slide !== from) {
        editor.editWhole(part, (current) => pastedLayers(current, minted, part, command, pasted, at))
        pastedOnTop = true
      } else if (editor.holds(part, [shapeOf(command.source).shape])) {
        editor.editWhole(part, (current) => clonedLayers(current, minted, part, command))
      }
      continue
    }
    if (command === undefined || !groupCommand(command) || command.id !== from) continue
    const members = command.slide === "element-group" ? command.members.map((member) => shapeOf(member.node).shape) : []
    if (command.slide === "element-group" && !editor.holds(part, members)) passed.add(shapeOf(groupNode(command)).shape)
    if (passed.has(shapeOf(groupNode(command)).shape)) continue
    const prefix = {
      file: state.file,
      order: state.order.slice(0, at),
      ...(state.index === undefined ? {} : { index: state.index }),
    }
    if (hasOrder) {
      const stacks = elementStacks(prefix).filter((stack) => stack.slide === from)
      if (stacks.length > 0) editor.editWhole(part, (current) => arrangeSlide(current, minted, stacks))
    }
    if (command.slide === "element-join") {
      const { frame, before, member } = command
      if (frame !== null && passed.has(shapeOf(frame).shape)) continue
      const own = shapeOf(member.node).shape
      editor.editWhole(part, (current) => {
        const placed = joinShape(
          bytesOf(current, part),
          own,
          frame === null ? null : shapeOf(frame).shape,
          before === null ? null : shapeOf(before).shape,
        )
        let next = withPart(current, part, placed)
        const after = { ...prefix, order: state.order.slice(0, at + 1) }
        if (frame !== null && plainGroup(after, frame)) {
          const filed = shapePlace(bytesOf(next, part), own)
          next = writeTrait(next, where(own), "box", boxPatch(keptTurn(memberPlace(member), filed)))
        }
        return next
      })
      continue
    }
    if (command.slide === "element-group") {
      const { element } = command
      if (element.box === null) throw new Error("box")
      const backdrop = command.backdrop === undefined ? undefined : Number(shapeOf(command.backdrop.node).shape)
      editor.wrapGroup(part, Number(shapeOf(element.node).shape), element.box, members, backdrop)
      for (const member of command.members) {
        const shape = shapeOf(member.node).shape
        const filed = editor.readShape(part, shape, (bytes) => shapePlace(bytes, shape))
        editor.editShape(
          part,
          shape,
          (scoped) => writeTrait(scoped, where(shape), "box", boxPatch(keptTurn(memberPlace(member), filed))),
          { touchesChildren: true },
        )
      }
      continue
    }
    const shape = shapeOf(command.node).shape
    if (command.slide === "element-regroup") {
      const kept = saved.get(shape)
      if (kept === undefined) throw new Error("p:grpSp")
      editor.editWhole(part, (current) => withPart(current, part, regroupSaved(bytesOf(current, part), kept)))
      continue
    }
    const backdrop = madeGroup(prefix, command.node)?.backdrop?.node
    editor.editWhole(part, (current) => {
      let next = current
      const unwrapped = unwrapGroup(bytesOf(next, part), shape)
      next = withPart(next, part, unwrapped.bytes)
      if (backdrop !== undefined) {
        const dropped = shapeOf(backdrop).shape
        const children = unwrapped.saved.children.filter((child) => child !== dropped)
        saved.set(shape, { ...unwrapped.saved, children })
        return withPart(next, part, removeShape(bytesOf(next, part), dropped))
      }
      saved.set(shape, unwrapped.saved)
      const { frame, place } = unwrapped
      if (frame === null || place === null) return next
      for (const child of unwrapped.children) {
        const own = shapePlace(bytesOf(next, part), child)
        if (own !== null) next = writeTrait(next, where(child), "box", boxPatch(throughGroup(own, place, frame)))
      }
      return next
    })
  }
}
