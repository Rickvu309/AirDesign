import type { Kind } from "@airdesign/document"
import type { PaintElement } from "@airdesign/pptx"
import type { CanvasElement, GroupOf } from "@airdesign/render"
import { canvasEffects } from "@/canvas-effects"
import type { CanvasSource } from "@/canvas-source"

export function isGroupKind(kind: Kind): boolean {
  return kind === "group"
}

export function paintGroup(row: PaintElement, source: CanvasSource, key: string): CanvasElement | null {
  const shape = row.from === "slide" ? source.shapes.get(row.shape) : undefined
  if (shape === undefined || row.box === null) return null
  const effects = canvasEffects(row.effects)
  return {
    ...(effects === undefined ? {} : { effects }),
    key,
    id: shape.id,
    kind: "group",
    box: row.box,
    editable: false,
    movable: shape.movable && (row.group === null || shape.inFrame === undefined),
    ...(shape.frame === undefined ? {} : { frame: shape.frame }),
    ...(shape.opacity === undefined ? {} : { opacity: shape.opacity }),
    placeholder: false,
    filled: false,
    fill: null,
    line: null,
    outline: "box",
    text: null,
  }
}

export function groupsOf(rows: readonly PaintElement[], source: CanvasSource): ReadonlyMap<string, GroupOf> {
  const above = new Map<string, string | null>()
  const boxes = new Map<string, PaintElement["box"]>()
  for (const row of rows) {
    if (row.from !== "slide") continue
    above.set(row.shape, row.group)
    if (row.kind === "p:grpSp") boxes.set(row.shape, row.box)
  }
  const tops = new Map<string, GroupOf>()
  for (const row of rows) {
    if (row.from !== "slide" || row.group === null) continue
    let top = row.group
    for (let next = above.get(top) ?? null; next !== null; next = above.get(top) ?? null) top = next
    const owner = source.shapes.get(top)
    if (owner === undefined) continue
    const frame = owner.frame === undefined ? {} : { frame: owner.frame }
    tops.set(row.shape, { id: owner.id, box: boxes.get(top) ?? null, ...frame })
  }
  return tops
}

export function holdersOf(
  rows: readonly PaintElement[],
  source: CanvasSource,
): ReadonlyMap<string, readonly GroupOf[]> {
  const above = new Map<string, string | null>()
  const boxes = new Map<string, PaintElement["box"]>()
  for (const row of rows) {
    if (row.from !== "slide") continue
    above.set(row.shape, row.group)
    if (row.kind === "p:grpSp") boxes.set(row.shape, row.box)
  }
  const nested = new Map<string, readonly GroupOf[]>()
  for (const row of rows) {
    if (row.from !== "slide" || row.group === null) continue
    const holders: GroupOf[] = []
    const seen = new Set<string>()
    for (let at = row.group; !seen.has(at);) {
      seen.add(at)
      const next = above.get(at) ?? null
      const owner = source.shapes.get(at)
      if (next === null || owner === undefined) break
      holders.push({
        id: owner.id,
        box: boxes.get(at) ?? null,
        ...(owner.frame === undefined ? {} : { frame: owner.frame }),
      })
      at = next
    }
    if (holders.length > 0) nested.set(row.shape, holders)
  }
  return nested
}

export function withHeld(
  painted: readonly (readonly [CanvasElement, PaintElement])[],
  rows: readonly PaintElement[],
): readonly CanvasElement[] {
  const above = new Map<string, string | null>()
  for (const row of rows) if (row.from === "slide") above.set(row.shape, row.group)
  const holds = (group: string, row: PaintElement) => {
    const seen = new Set<string>()
    for (let at = row.from === "slide" ? row.group : null; at !== null && !seen.has(at); at = above.get(at) ?? null) {
      if (at === group) return true
      seen.add(at)
    }
    return false
  }
  return painted.map(([element, row], at) => {
    if (element.kind !== "group" || row.from !== "slide") return element
    let held = 0
    while (at + 1 + held < painted.length && holds(row.shape, painted[at + 1 + held]![1])) held += 1
    return held === 0 ? element : { ...element, held }
  })
}
