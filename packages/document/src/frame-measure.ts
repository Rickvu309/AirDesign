import type { Landed, Register } from "./decide.js"
import type { ElementId } from "./element-id.js"
import { layoutNodes, readLayout } from "./frame-layout.js"
import type { Value } from "./value.js"

export function heightOnly(edit: Value): boolean {
  if (edit.v === undefined) return false
  const traits = Object.keys(edit.patch)
  return traits.length === 1 && traits[0] === "box" && Object.keys(edit.patch.box ?? {}).join() === "h"
}

function heightSet(row: Landed): boolean {
  return row.v === undefined ? row.property === "box" : row.patch.box?.h !== undefined
}

function reshapes(row: Landed): boolean {
  if (row.v === undefined) return row.property !== "box"
  const { text, body, box } = row.patch
  return text !== undefined || body !== undefined || box?.w !== undefined
}

function rowsOf(register: Register, node: ElementId): readonly Landed[] {
  return (Object.hasOwn(register.elements, node) ? register.elements[node]?.landed : undefined) ?? []
}

function unmeasured(register: Register, node: ElementId, agents: boolean): boolean {
  const rows = rowsOf(register, node).filter((row) => row.visible)
  const edited = rows.findLastIndex((row) => (!agents || row.actor === "agent") && reshapes(row))
  return edited >= 0 && edited > rows.findLastIndex(heightSet)
}

function due(register: Register, node: ElementId): boolean {
  return rowsOf(register, node).some(reshapes)
}

function autoChildren(register: Register): readonly ElementId[] {
  return layoutNodes(register).flatMap((frame) => {
    const view = readLayout(register, frame)
    return view === null || view.flow === "none" ? [] : view.children.map(({ node }) => node)
  })
}

export function measureOwed(register: Register): readonly ElementId[] {
  return autoChildren(register).filter((node) => unmeasured(register, node, true))
}

export function measureStale(register: Register): readonly ElementId[] {
  return autoChildren(register).filter((node) => unmeasured(register, node, false))
}

export function measureDue(register: Register): readonly ElementId[] {
  return autoChildren(register).filter((node) => due(register, node))
}
