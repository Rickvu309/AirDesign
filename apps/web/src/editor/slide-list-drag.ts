export type SlideDrag = {
  readonly count: number
  readonly held: readonly number[]
  readonly grabbed: number
}

function keptOf(drag: SlideDrag): number[] {
  return Array.from({ length: drag.count }, (_, index) => index).filter((index) => !drag.held.includes(index))
}

export function dragPlace(drag: SlideDrag, slot: number): number {
  const first = slot - drag.held.indexOf(drag.grabbed)
  return Math.max(0, Math.min(drag.count - drag.held.length, first))
}

export function dragOrder(drag: SlideDrag, place: number): number[] {
  const kept = keptOf(drag)
  return [...kept.slice(0, place), ...drag.held, ...kept.slice(place)]
}

export function dragTarget(drag: SlideDrag, place: number): number {
  return keptOf(drag)[place] ?? drag.count
}
