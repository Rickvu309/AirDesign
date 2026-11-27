import * as doom from "@airdesign/doom"
import { placementRules, startRules } from "@airdesign/taste"
import type { SlideGeometry } from "@/editing/slide-geometry"

export type IntentReading = {
  readonly mint?: () => doom.NodeId
  readonly geometry?: SlideGeometry
  readonly measure?: doom.Measure | null
}

const unminted = (): doom.NodeId => {
  throw new Error("this change makes no node")
}

const boxesOf = (geometry: SlideGeometry): ReadonlyMap<doom.NodeId, doom.Box> =>
  new Map([...geometry.byId].map(([id, placed]) => [id, placed.node.box]))

export function compiledIntents(
  view: doom.Doom,
  intents: readonly doom.Intent[],
  { mint = unminted, geometry, measure }: IntentReading = {},
): doom.IntentWrites | doom.IntentRefusal {
  return doom.intentWrites(view, intents, {
    mint,
    placement: placementRules,
    starts: startRules,
    ...(geometry === undefined ? {} : { boxes: boxesOf(geometry) }),
    ...(measure === undefined || measure === null ? {} : { measure }),
  })
}

export function intentWrites(
  view: doom.Doom,
  intents: readonly doom.Intent[],
  reading: IntentReading = {},
): doom.IntentWrites | null {
  const made = compiledIntents(view, intents, reading)
  return doom.isRefusal(made) ? null : made
}

export function madeOf(view: doom.Doom, writes: readonly doom.Write[], type: doom.NodeType): readonly doom.NodeId[] {
  return writes.flatMap((write) =>
    write.prop === "type" && write.value === type && !view.nodes.has(write.node) ? [write.node] : [],
  )
}

export function removeIntents(view: doom.Doom, ids: readonly doom.NodeId[]): readonly doom.Intent[] {
  const targets = ids.filter((id) => doom.isLive(view.nodes.get(id)))
  return targets.length === 0 ? [] : [{ op: "remove", targets }]
}
