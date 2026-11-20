import type { Box } from "./box.js"
import type { IndexElement } from "./deck-index.js"
import { currentValue, history, landedPatch, valueHolder, type Register } from "./decide.js"
import type { Design } from "./design.js"
import { elementId, readSlideId, shapeOf, type ElementId } from "./element-id.js"
import { groupChildren, groupFrame, groupParent } from "./element-group.js"
import { cloneRefusal, elementGone, type ClonedLayer, type CloneRefusal, type ElementClone } from "./element-order.js"
import { readLayout, type LayoutView } from "./frame-layout.js"
import { placeOf, type Place } from "./group-place.js"
import { shownPlace, storedPlaceIn } from "./group-space.js"
import { floorOpening, openingElement } from "./slide-floor.js"

function shownRow(register: Register, source: ElementId): IndexElement | undefined {
  const row = openingElement(register, source)
  if (row === undefined) return undefined
  const body = register.nodes.includes(source) ? register.elements[source] : undefined
  const value = body !== undefined && history(body).length > 0 ? currentValue(body) : row.value
  const landed = body === undefined ? {} : landedPatch(body, valueHolder(register, source, "person"))
  const opening = floorOpening(register, source, landed)
  const { group: _group, frame: _frame, framing: _framing, opening: _opening, ...kept } = row
  return { ...kept, value, ...(opening === undefined ? {} : { opening }) }
}

export type Cloned =
  | { readonly ok: true; readonly command: ElementClone }
  | { readonly ok: false; readonly refusal: CloneRefusal }

export type CopiedRows = ReadonlyMap<ElementId, IndexElement>

type Copying = {
  readonly register: Register
  readonly rows: CopiedRows
  readonly across: boolean
  readonly next: () => ElementId
  readonly layers: ClonedLayer[]
}

function unconnected(row: IndexElement): IndexElement {
  const { connection: _connection, ...opening } = row.opening ?? {}
  const { "connection.start": _start, "connection.end": _end, ...design } = row.design ?? {}
  const { opening: _opening, design: _design, ...kept } = row
  return {
    ...kept,
    ...(Object.keys(opening).length === 0 ? {} : { opening }),
    ...(Object.keys(design).length === 0 ? {} : { design }),
  }
}

function rowOf(copying: Copying, source: ElementId): IndexElement | undefined {
  const copied = copying.rows.get(source)
  const row = copied === undefined ? shownRow(copying.register, source) : copied
  if (row === undefined) return undefined
  const { group: _group, frame: _frame, framing: _framing, ...kept } = row
  return copying.across ? unconnected(kept) : copied === undefined ? row : kept
}

const turnsPerDegree = 60_000

function turned(row: IndexElement, place: Place): IndexElement {
  const { "box.rot": _rot, "box.flipH": _flipH, "box.flipV": _flipV, ...rest } = row.design ?? {}
  const design: Design = {
    ...rest,
    ...(place.rot === 0 ? {} : { "box.rot": [place.rot / turnsPerDegree] }),
    ...(place.flipH ? { "box.flipH": [true] } : {}),
    ...(place.flipV ? { "box.flipV": [true] } : {}),
  }
  const { design: _design, ...kept } = row
  return Object.keys(design).length === 0 ? kept : { ...kept, design }
}

function shifted(box: Box, by: { readonly x: number; readonly y: number }): Box {
  return { ...box, x: box.x + by.x, y: box.y + by.y }
}

function copied(copying: Copying, source: ElementId, parent: ElementId, place: Place, extra: Partial<IndexElement>) {
  const row = rowOf(copying, source)
  if (row === undefined) return null
  const node = copying.next()
  const element: IndexElement = { ...turned(row, place), node, box: place.box, grouped: true, group: parent, ...extra }
  copying.layers.push({ source, element })
  return node
}

function copiedInside(copying: Copying, group: ElementId, copy: ElementId): boolean {
  const { register } = copying
  for (const child of groupChildren(register, group)) {
    if (elementGone(register, child)) continue
    const place = placeOf(register, child)
    const frame = groupFrame(register, child)
    if (place === null) return false
    const view = readLayout(register, child)
    if (view !== null) {
      const nested = { node: copying.next(), parent: copy, by: { x: 0, y: 0 }, nested: true }
      if (copiedFrame(copying, child, view, nested) === null) return false
      continue
    }
    const node = copied(copying, child, copy, place, frame === null ? {} : { frame })
    if (node === null || (frame !== null && !copiedInside(copying, child, node))) return false
  }
  return true
}

type Offset = { readonly x: number; readonly y: number }

function copiedFrame(copying: Copying, frame: ElementId, view: LayoutView, copy: Copy): IndexElement | null {
  const { register } = copying
  const row = rowOf(copying, frame)
  if (row === undefined) return null
  const slot = copying.layers.length
  const flat = { rot: 0, flipH: false, flipV: false }
  const box = shifted(view.box, copy.by)
  if (copy.parent !== null && copy.nested) copying.layers.push({ source: frame, element: row })
  const backdrop = copied(copying, view.backdrop, copy.node, { box, ...flat }, {})
  const children: ElementId[] = []
  for (const child of view.children) {
    const own = placeOf(register, child.node)
    const inner = groupFrame(register, child.node)
    const place = { ...flat, ...own, box: shifted(child.box, copy.by) }
    const made = copied(copying, child.node, copy.node, place, inner === null ? {} : { frame: inner })
    if (made === null || (inner !== null && !copiedInside(copying, child.node, made))) return null
    children.push(made)
  }
  if (backdrop === null) return null
  const { left, top, right, bottom } = view.padding
  const layout = { flow: view.flow, gap: view.gap, padding: [left, top, right, bottom] as const, align: view.align }
  const placed = copy.parent === null ? { grouped: false } : { grouped: true, group: copy.parent }
  const element: IndexElement = {
    ...turned(row, { box, ...flat }),
    node: copy.node,
    box,
    ...placed,
    framing: { backdrop, children, layout },
  }
  if (copy.parent !== null && copy.nested) copying.layers[slot] = { source: frame, element }
  return element
}

type Copy = {
  readonly node: ElementId
  readonly parent: ElementId | null
  readonly by: Offset
  readonly nested: boolean
}

function idsAfter(node: ElementId): () => ElementId {
  const { slide, shape } = shapeOf(node)
  let next = Number(shape)
  return () => {
    next += 1
    return elementId(`${slide}.${String(next)}`)
  }
}

export function cloneOf(
  register: Register,
  source: ElementId,
  node: ElementId,
  shown: Box,
  rows: CopiedRows = new Map(),
): Cloned {
  const id = readSlideId(shapeOf(node).slide)
  const across = shapeOf(source).slide !== shapeOf(node).slide
  const copying: Copying = { register, rows, across, next: idsAfter(node), layers: [] }
  const row = rowOf(copying, source)
  const gone = !rows.has(source) && elementGone(register, source)
  if (id === undefined || row === undefined || gone) return { ok: false, refusal: "dead" }
  const parent = across ? null : (groupParent(register, source) ?? null)
  const view = readLayout(register, source)
  const by = view === null ? null : { x: shown.x - view.box.x, y: shown.y - view.box.y }
  const element =
    view === null || by === null
      ? copiedGroup(copying, source, node, parent, row, shown)
      : copiedFrame(copying, source, view, { node, parent, by, nested: false })
  if (element === null) return { ok: false, refusal: parent === null ? "kind" : "group-box" }
  const layers = copying.layers
  const command: ElementClone = {
    slide: "element-clone",
    id,
    source,
    element,
    ...(layers.length === 0 ? {} : { layers }),
  }
  const refusal = cloneRefusal(register, command)
  return refusal === null ? { ok: true, command } : { ok: false, refusal }
}

function copiedGroup(
  copying: Copying,
  source: ElementId,
  node: ElementId,
  parent: ElementId | null,
  row: IndexElement,
  shown: Box,
): IndexElement | null {
  const { register } = copying
  const now = shownPlace(register, source) ?? placeOf(register, source)
  const place = now === null ? null : storedPlaceIn(register, source, parent, { ...now, box: shown })
  if (place === null) return null
  const frame = groupFrame(register, source)
  const element: IndexElement = {
    ...turned(row, place),
    node,
    box: place.box,
    grouped: parent !== null,
    ...(parent === null ? {} : { group: parent }),
    ...(frame === null ? {} : { frame }),
  }
  return frame !== null && !copiedInside(copying, source, node) ? null : element
}
