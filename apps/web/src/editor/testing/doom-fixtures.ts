import * as doom from "@airdesign/doom"
import { geometryOf } from "@/editing/slide-geometry"
import { testTheme } from "@airdesign/doom/testing"

export const spot = (x: number, y: number, w: number, h: number, rotation = 0) => ({
  x,
  y,
  w,
  h,
  rotation,
  flipH: false,
  flipV: false,
})

export const paint = [{ kind: "solid", color: { var: "accent1" } }] as const

export function grow(children: readonly doom.TreeNode[]) {
  const grown = doom.doomFromTree({ theme: testTheme, slides: [{ children }] })
  const measure = doom.measureWith({})
  const geometry = geometryOf(doom.resolveSlide(grown.doom, grown.slides[0]!, measure))
  return { ...grown, view: grown.doom, geometry, measure }
}

export function landed(view: doom.Doom, writes: readonly doom.Write[]): doom.Doom {
  const next = doom.applyEdit(view, {
    once: `test-${String(view.rev + 1)}`,
    author: { kind: "person", id: "test" },
    writes: writes.map((write) => {
      const was = view.revs.get(write.node)?.get(write.prop)
      return was === undefined ? write : { ...write, base: was }
    }),
    rev: doom.rev(view.rev + 1),
  })
  if (doom.isRefusal(next)) throw new Error(`refused ${JSON.stringify(next)}`)
  return next
}
