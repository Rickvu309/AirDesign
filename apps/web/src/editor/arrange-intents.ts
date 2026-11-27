import * as doom from "@airdesign/doom"
import { flipSelection } from "./transform-math"
import { propOf } from "@airdesign/doom"
import { memberOf } from "./selection-frame"
import { apply, invert, type SlideGeometry } from "@/editing/slide-geometry"
import { transformable } from "./transform-drag"
import { intentWrites, madeOf } from "./editor-intents"

export type Arranged = { readonly writes: readonly doom.Write[]; readonly selected: readonly doom.NodeId[] }

export function wrapped(
  view: doom.Doom,
  geometry: SlideGeometry,
  ids: readonly doom.NodeId[],
  kind: "group" | "frame",
  mint: () => doom.NodeId,
  measure?: doom.Measure | null,
): Arranged | null {
  if (ids.length === 0) return null
  const intent: doom.Intent =
    kind === "group"
      ? { op: "group", targets: ids, name: "Group" }
      : { op: "group", targets: ids, name: "Frame", clip: true }
  const made = intentWrites(view, [intent], { mint, geometry, measure })
  return made === null ? null : { writes: made.writes, selected: madeOf(view, made.writes, "frame") }
}

export function ungrouped(
  view: doom.Doom,
  geometry: SlideGeometry,
  ids: readonly doom.NodeId[],
  measure?: doom.Measure | null,
): Arranged | null {
  const frames = ids.filter((id) => view.nodes.get(id)?.type === "frame" && doom.isLive(view.nodes.get(id)))
  if (frames.length === 0) return null
  const made = intentWrites(
    view,
    frames.map((target) => ({ op: "ungroup", target })),
    { geometry, measure },
  )
  const selected = frames.flatMap((id) =>
    doom.childrenOf(view, id).flatMap((child) => (geometry.byId.has(child.id) ? [child.id] : [])),
  )
  return made === null ? null : { writes: made.writes, selected }
}

const flipOf = (flipH: boolean, flipV: boolean) => (flipH ? (flipV ? "hv" : "h") : flipV ? "v" : "none")

export function flipIntents(
  view: doom.Doom,
  geometry: SlideGeometry,
  ids: readonly doom.NodeId[],
  axis: "horizontal" | "vertical",
): readonly doom.Intent[] {
  const layers = new Map(
    ids.flatMap((id) => {
      const placed = geometry.byId.get(id)
      if (placed === undefined || !transformable(view, id)) return []
      const member = memberOf(placed)
      const stored = propOf(view.nodes.get(id), "box") ?? doom.unfittedBox(placed.node.box)
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
  return flipSelection(layers, axis).map((flipped): doom.Intent => {
    const placed = geometry.byId.get(flipped.id)!
    const stored = propOf(view.nodes.get(flipped.id), "box") ?? doom.unfittedBox(placed.node.box)
    const parent = placed.parent === null ? undefined : geometry.byId.get(placed.parent)
    const box = flipped.box ?? layers.get(flipped.id)!.box
    const centre = { x: box.x + box.w / 2, y: box.y + box.h / 2 }
    const local = parent === undefined ? centre : apply(invert(parent.content), centre)
    const turn = flipped.rotation ?? layers.get(flipped.id)!.rotation
    const rotation = doom.wrapRotation(turn - (parent?.rotation ?? 0))
    const { w, h, fit } = placed.node.box
    const shift = doom.fitShift({ w, h, rotation }, fit)
    return {
      op: "update",
      target: flipped.id,
      box: {
        x: Math.round(local.x - w / 2 - shift.x),
        y: Math.round(local.y - h / 2 - shift.y),
        w: stored.w,
        h: stored.h,
      },
      rotation,
      flip: flipOf(flipped.flipH ?? stored.flipH, flipped.flipV ?? stored.flipV),
    }
  })
}
