import type { Register, SetChange } from "@airdesign/document"
import type { FlippedLayer, Turned } from "@airdesign/render"
import { storedBox } from "@/editing/frame-boxes"

function angleUnits(degrees: number): number {
  const normalized = ((degrees % 360) + 360) % 360
  return Math.round(normalized * 60_000) % 21_600_000
}

export function turnChanges(framing: Register | null, turned: readonly Turned[]): readonly SetChange[] {
  return turned.map((each) => {
    const placed = each.box === undefined ? undefined : storedBox(framing, each.id, each.box)
    return {
      target: { node: each.id },
      box: {
        ...(placed === undefined ? {} : { x: placed.x, y: placed.y }),
        rot: angleUnits(each.rotation),
      },
    }
  })
}

export function flipChanges(framing: Register | null, flipped: readonly FlippedLayer[]): readonly SetChange[] {
  return flipped.map((each) => {
    const placed = each.box === undefined ? undefined : storedBox(framing, each.id, each.box)
    return {
      target: { node: each.id },
      box: {
        ...(placed === undefined ? {} : { x: placed.x, y: placed.y }),
        ...(each.rotation === undefined ? {} : { rot: angleUnits(each.rotation) }),
        ...(each.flipH === undefined ? {} : { flipH: each.flipH }),
        ...(each.flipV === undefined ? {} : { flipV: each.flipV }),
      },
    }
  })
}
