import type { Box } from "./box.js"
import type { DeckIndex, IndexElement } from "./deck-index.js"
import { shapeOf, slideKind, type ElementId, type SlideId } from "./element-id.js"
import {
  formerChildren,
  frameBackdrop,
  frameSource,
  groupable,
  groupBounds,
  groupDissolved,
  groupedNow,
  groupFrame,
  groupNode,
  groupParent,
  plainGroup,
  type ElementGroup,
  type ElementJoin,
  type ElementRegroup,
  type ElementUngroup,
  type GroupCommand,
} from "./element-group.js"
import { elementGone } from "./element-order.js"
import { openingElement } from "./slide-floor.js"
import { slideMeasure } from "./slide-measure.js"
import type { SlideRefusal, SlideState } from "./slide-order.js"

type Indexed = SlideState & { readonly index?: DeckIndex }

const highestShape = 4294967295

function holdsAbove(state: Indexed, node: ElementId, inner: ElementId): boolean {
  let above: ElementId | null | undefined = inner
  while (typeof above === "string") {
    if (above === node) return true
    above = groupParent(state, above)
  }
  return false
}

function indexComplete(state: Indexed): boolean {
  return state.index !== undefined && state.index.total === state.index.elements.length
}

function animated(state: Indexed, slide: SlideId, node: ElementId): boolean {
  return slideMeasure(state, slide)?.animated.includes(shapeOf(node).shape) === true
}

function sameBox(left: Box | null, right: Box): boolean {
  return left !== null && left.x === right.x && left.y === right.y && left.cx === right.cx && left.cy === right.cy
}

function onlyLayout(element: IndexElement, framed: boolean): boolean {
  const opening = element.opening
  if (opening === undefined) return true
  return framed && Object.keys(opening).every((trait) => trait === "layout")
}

function freshBackdrop(backdrop: IndexElement, element: IndexElement): boolean {
  const number = Number(shapeOf(backdrop.node).shape)
  return (
    shapeOf(backdrop.node).slide === shapeOf(element.node).slide &&
    Number.isInteger(number) &&
    number > 1 &&
    number <= highestShape &&
    backdrop.node !== element.node &&
    backdrop.kind === "shape" &&
    backdrop.value === null &&
    !backdrop.grouped &&
    backdrop.group === undefined &&
    backdrop.frame === undefined &&
    backdrop.role === undefined &&
    backdrop.opening === undefined &&
    element.box !== null &&
    sameBox(backdrop.box, element.box)
  )
}

function freshGroup(element: IndexElement, id: SlideId, framed: boolean): boolean {
  const number = Number(shapeOf(element.node).shape)
  return (
    shapeOf(element.node).slide === id &&
    Number.isInteger(number) &&
    number > 1 &&
    number <= highestShape &&
    element.kind === "group" &&
    element.value === null &&
    !element.grouped &&
    element.group === undefined &&
    element.frame === undefined &&
    element.role === undefined &&
    onlyLayout(element, framed)
  )
}

function memberRefusal(state: Indexed, id: SlideId, node: ElementId): SlideRefusal | null {
  if (shapeOf(node).slide !== id || slideKind(node) !== null || elementGone(state, node)) return "dead"
  if (groupedNow(state, node)) return "group-box"
  const opening = openingElement(state, node)
  if (opening === undefined) return indexComplete(state) ? "dead" : null
  if (!groupable.includes(opening.kind) || opening.role !== undefined) return "kind"
  return animated(state, id, node) ? "locked" : null
}

function madeRefusal(state: Indexed, command: ElementGroup): SlideRefusal | null {
  const { element, members, backdrop } = command
  if (!freshGroup(element, command.id, backdrop !== undefined)) return "dead"
  if (backdrop !== undefined && !freshBackdrop(backdrop, element)) return "dead"
  if (members.length < (backdrop === undefined ? 2 : 1)) return "dead"
  for (const fresh of backdrop === undefined ? [element] : [element, backdrop])
    if (openingElement(state, fresh.node) !== undefined || elementGone(state, fresh.node)) return "present"
  for (const member of members) {
    const refusal = memberRefusal(state, command.id, member.node)
    if (refusal !== null) return refusal
  }
  const fits = sameBox(element.box, groupBounds(members)) || sameBox(element.box, groupBounds(members.slice(0, 1)))
  return fits ? null : "dead"
}

function ungroupRefusal(state: Indexed, command: ElementUngroup): SlideRefusal | null {
  if (elementGone(state, command.node)) return "dead"
  if (groupedNow(state, command.node)) return "group-box"
  const opening = openingElement(state, command.node)
  if (opening === undefined) return indexComplete(state) ? "dead" : null
  if (opening.kind !== "group") return "kind"
  if (groupFrame(state, command.node) === null) return "kind"
  return animated(state, command.id, command.node) ? "locked" : null
}

function regroupRefusal(state: Indexed, command: ElementRegroup): SlideRefusal | null {
  if (!groupDissolved(state, command.node)) return "dead"
  const backdrop = frameSource(state, command.node)?.backdrop
  for (const child of formerChildren(state, command.node)) {
    if (child === backdrop) continue
    if (elementGone(state, child)) return "dead"
    if (groupedNow(state, child)) return "group-box"
  }
  return null
}

function backdropOf(state: Indexed, node: ElementId): boolean {
  const parent = groupParent(state, node)
  return typeof parent === "string" && frameSource(state, parent)?.backdrop === node
}

function placeRefusal(state: Indexed, command: ElementJoin): SlideRefusal | null {
  const { frame, before } = command
  const node = command.member.node
  if (frame === null && typeof groupParent(state, node) !== "string") return "dead"
  if (frame !== null) {
    if (shapeOf(frame).slide !== command.id) return "kind"
    if (frameBackdrop(state, frame) === null && !plainGroup(state, frame)) return "kind"
    if (holdsAbove(state, node, frame)) return "dead"
  }
  if (before === null) return null
  if (before === node || groupParent(state, before) !== frame || backdropOf(state, before)) return "dead"
  return elementGone(state, before) ? "dead" : null
}

function joinRefusal(state: Indexed, command: ElementJoin): SlideRefusal | null {
  const node = command.member.node
  if (slideKind(node) !== null || elementGone(state, node)) return "dead"
  if (backdropOf(state, node)) return "kind"
  const opening = openingElement(state, node)
  if (opening === undefined) return indexComplete(state) ? "dead" : null
  if (!groupable.includes(opening.kind) || opening.role !== undefined) return "kind"
  if (animated(state, command.id, node)) return "locked"
  return placeRefusal(state, command)
}

export function groupRefusal(state: Indexed, command: GroupCommand): SlideRefusal | null {
  if (shapeOf(groupNode(command)).slide !== command.id) return "dead"
  if (command.slide === "element-join") return joinRefusal(state, command)
  if (command.slide === "element-group") return madeRefusal(state, command)
  if (command.slide === "element-ungroup") return ungroupRefusal(state, command)
  return regroupRefusal(state, command)
}
