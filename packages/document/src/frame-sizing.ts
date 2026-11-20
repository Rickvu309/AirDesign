import type { Box } from "./box.js"
import type { Scope, ScopedElement, SetChange } from "./change.js"
import type { Register } from "./decide.js"
import type { ElementId } from "./element-id.js"
import { readLayout, type Sizing } from "./frame-layout.js"
import type { FieldEdit } from "./row.js"

export type Hugged = { readonly box: Box; readonly width: Sizing; readonly height: Sizing }

export type Sides = { readonly width?: Sizing; readonly height?: Sizing }

type Patch = Readonly<Record<string, Readonly<Record<string, FieldEdit<unknown>>>>>

export function huggedOf(register: Register, node: ElementId): { readonly hugged?: Hugged } {
  const view = readLayout(register, node)
  return view === null ? {} : { hugged: { box: view.box, width: view.width, height: view.height } }
}

export function fixedSides(
  hugged: Hugged,
  size: { readonly cx?: number | undefined; readonly cy?: number | undefined },
): Sides {
  const grown = (now: number, sizing: Sizing, next: number | undefined) =>
    sizing === "hug" && next !== undefined && next !== now
  return {
    ...(grown(hugged.box.cx, hugged.width, size.cx) ? { width: "fixed" } : {}),
    ...(grown(hugged.box.cy, hugged.height, size.cy) ? { height: "fixed" } : {}),
  }
}

export function resizedSides(
  register: Register,
  node: ElementId,
  size: { readonly cx: number; readonly cy: number },
): { readonly before: Sides; readonly after: Sides } | null {
  const view = readLayout(register, node)
  if (view === null || view.flow === "none") return null
  const after = fixedSides(view, size)
  if (after.width === undefined && after.height === undefined) return null
  return {
    before: {
      ...(after.width === undefined ? {} : { width: view.width }),
      ...(after.height === undefined ? {} : { height: view.height }),
    },
    after,
  }
}

export function sidesPatch(sides: Sides): { readonly layout?: Readonly<Record<string, FieldEdit<Sizing>>> } {
  const edits = Object.entries(sides).map(([side, sizing]) => [side, { set: sizing }] as const)
  return edits.length === 0 ? {} : { layout: Object.fromEntries(edits) }
}

function numberOf(edit: FieldEdit<unknown> | undefined): number | undefined {
  return typeof edit === "object" && typeof edit.set === "number" ? edit.set : undefined
}

function pinned(edit: FieldEdit<unknown> | undefined, sizing: Sizing): boolean {
  return sizing === "hug" && typeof edit === "object" && edit.set === "fixed"
}

export function sizedPatch(hugged: Hugged | undefined, patch: Patch): Patch {
  if (hugged === undefined) return {}
  const box = patch.box
  const fixed = sidesPatch(fixedSides(hugged, { cx: numberOf(box?.w), cy: numberOf(box?.h) })).layout
  const layout = { ...patch.layout, ...fixed }
  const kept = {
    ...(pinned(layout.width, hugged.width) && box?.w === undefined ? { w: { set: hugged.box.cx } } : {}),
    ...(pinned(layout.height, hugged.height) && box?.h === undefined ? { h: { set: hugged.box.cy } } : {}),
  }
  return {
    ...(fixed === undefined ? {} : { layout }),
    ...(Object.keys(kept).length === 0 ? {} : { box: { ...box, ...kept } }),
  }
}

function filledSides(layout: unknown, holder: Hugged | undefined): Sides {
  if (holder === undefined || typeof layout !== "object" || layout === null) return {}
  const asked: Readonly<Record<string, unknown>> = { ...layout }
  return {
    ...(asked.width === "fill" && holder.width === "hug" ? { width: "fixed" } : {}),
    ...(asked.height === "fill" && holder.height === "hug" ? { height: "fixed" } : {}),
  }
}

export function holdersFixed(
  change: SetChange,
  views: readonly ScopedElement[],
  scope: Scope,
): readonly (readonly [SetChange, ScopedElement])[] {
  const holders = new Map<ElementId, ScopedElement>()
  for (const view of views) {
    const holder = view.parent == null ? undefined : scope.view(view.parent)
    if (holder !== undefined) holders.set(holder.node, holder)
  }
  return [...holders.values()].flatMap((holder) => {
    const fixing = filledSides(change.layout, holder.hugged)
    if (fixing.width === undefined && fixing.height === undefined) return []
    return [[{ target: { node: holder.node }, layout: fixing } as SetChange, holder] as const]
  })
}
