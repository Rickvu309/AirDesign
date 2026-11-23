import * as doom from "@airdesign/doom"
import { flipSelection } from "@airdesign/render"
import { propOf } from "@/editing/node-props"
import { memberOf } from "./selection-frame"
import { apply, invert, type SlideGeometry } from "./slide-geometry"
import { transformable } from "./transform-drag"

export function flipWrites(
  view: doom.Doom,
  geometry: SlideGeometry,
  ids: readonly doom.NodeId[],
  axis: "horizontal" | "vertical",
): readonly doom.Write[] {
  const layers = new Map(
    ids.flatMap((id) => {
      const placed = geometry.byId.get(id)
      if (placed === undefined || !transformable(view, id)) return []
      const member = memberOf(placed)
      const stored = propOf(view.nodes.get(id), "box") ?? placed.node.box
      return [
        [
          id,
          {
            box: { x: member.center.x - member.w / 2, y: member.center.y - member.h / 2, w: member.w, h: member.h },
            rotation: member.rotation,
            flipH: stored.flipH,
            flipV: stored.flipV,
          },
        ] as const,
      ]
    }),
  )
  return flipSelection(layers, axis).flatMap((flipped) => {
    const placed = geometry.byId.get(flipped.id)!
    const stored = propOf(view.nodes.get(flipped.id), "box") ?? placed.node.box
    const parent = placed.parent === null ? undefined : geometry.byId.get(placed.parent)
    const box = flipped.box ?? layers.get(flipped.id)!.box
    const centre = { x: box.x + box.w / 2, y: box.y + box.h / 2 }
    const local = parent === undefined ? centre : apply(invert(parent.matrix), centre)
    const turn = flipped.rotation ?? layers.get(flipped.id)!.rotation
    return [
      {
        node: flipped.id,
        prop: "box" as const,
        value: {
          ...stored,
          x: Math.round(local.x - placed.node.box.w / 2),
          y: Math.round(local.y - placed.node.box.h / 2),
          rotation: doom.wrapRotation(turn - (parent?.rotation ?? 0)),
          flipH: flipped.flipH ?? stored.flipH,
          flipV: flipped.flipV ?? stored.flipV,
        },
      },
    ]
  })
}

export function toggleWrites(
  view: doom.Doom,
  ids: readonly doom.NodeId[],
  prop: "hidden" | "locked",
): readonly doom.Write[] {
  const existing = ids.filter((id) => view.nodes.has(id))
  const all = existing.every((id) => propOf(view.nodes.get(id), prop) === true)
  return existing.map((node) => ({ node, prop, value: !all }))
}
