import { scene } from "@airdesign/document"
import { geometryOf } from "./slide-geometry"

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

export function grow(children: readonly scene.TreeNode[]) {
  const grown = scene.sceneFromTree({ theme: scene.defaultTheme, slides: [{ children }] })
  const measure = scene.measureWith({})
  const geometry = geometryOf(scene.resolveSlide(grown.scene, grown.slides[0]!, measure))
  return { ...grown, view: grown.scene, geometry, measure }
}

export function landed(view: scene.Scene, writes: readonly scene.Write[]): scene.Scene {
  const next = scene.applyEdit(view, {
    once: `test-${String(view.rev + 1)}`,
    author: { kind: "person", id: "test" },
    writes: writes.map((write) => {
      const was = view.revs.get(write.node)?.get(write.prop)
      return was === undefined ? write : { ...write, base: was }
    }),
    rev: scene.rev(view.rev + 1),
  })
  if (scene.isRefusal(next)) throw new Error(`refused ${JSON.stringify(next)}`)
  return next
}
