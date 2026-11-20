import type { Box } from "./box.js"
import type { Scope, ScopedElement } from "./change.js"
import type { Place } from "./group-place.js"

type Loose = Readonly<Record<string, unknown>>

function wholeBox(box: Box | null): Loose {
  return box === null ? {} : { x: box.x, y: box.y, w: box.cx, h: box.cy }
}

export type Spot = { readonly x: number; readonly y: number }

function framedFields(view: ScopedElement, fields: Loose): Loose {
  const origin = view.origin
  if (origin === undefined || typeof fields.x !== "number" || typeof fields.y !== "number") return fields
  return { ...fields, x: fields.x - origin.x, y: fields.y - origin.y }
}

function sideOf<T>(fields: Loose, key: string, kind: "number" | "boolean", fallback: T): T {
  const value = fields[key]
  return typeof value === kind ? (value as T) : fallback
}

function groupedFields(view: ScopedElement, fields: Loose, scope: Scope): Loose | null {
  const shown = view.shown
  if (shown === undefined) return framedFields(view, fields)
  const wanted: Place = {
    box: {
      x: sideOf(fields, "x", "number", shown.box.x),
      y: sideOf(fields, "y", "number", shown.box.y),
      cx: sideOf(fields, "w", "number", shown.box.cx),
      cy: sideOf(fields, "h", "number", shown.box.cy),
    },
    rot: sideOf(fields, "rot", "number", shown.rot),
    flipH: sideOf(fields, "flipH", "boolean", shown.flipH),
    flipV: sideOf(fields, "flipV", "boolean", shown.flipV),
  }
  const stored = scope.stored?.(view.node, wanted) ?? null
  if (stored === null) return null
  const turns = Object.entries({ rot: stored.rot, flipH: stored.flipH, flipV: stored.flipV })
  return {
    ...fields,
    x: stored.box.x,
    y: stored.box.y,
    w: stored.box.cx,
    h: stored.box.cy,
    ...Object.fromEntries(turns.filter(([key]) => fields[key] !== undefined)),
  }
}

export function boxFields(view: ScopedElement, input: Loose, spot: Spot | undefined, scope: Scope): Loose | null {
  const box = view.box ?? (spot === undefined ? null : (view.placed ?? null))
  return groupedFields(view, { ...wholeBox(box), ...input, ...spot }, scope)
}
