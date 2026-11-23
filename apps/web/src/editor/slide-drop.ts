import { slideListCopy } from "@/copy/slide-list-copy"

export function droppedAt(count: number, held: readonly number[], at: number): number | null {
  const order = Array.from({ length: count }, (_, index) => index)
  const kept = order.filter((index) => !held.includes(index))
  const anchor = kept.filter((index) => index < at).at(-1)
  const place = anchor === undefined ? 0 : kept.indexOf(anchor) + 1
  const next = [...kept.slice(0, place), ...order.filter((index) => held.includes(index)), ...kept.slice(place)]
  return next.every((index, position) => index === position) ? null : place
}

export function slideMoveMessage(held: readonly number[], at: number): string {
  const first = at - held.filter((index) => index < at).length
  return held.length === 1
    ? slideListCopy.moved((held[0] ?? first) + 1, first + 1)
    : slideListCopy.movedSeveral(held.length, first + 1)
}
