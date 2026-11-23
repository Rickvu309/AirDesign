import { defaultGrid1, gridMovePlacement, slideId } from "@airdesign/document"
import { slideListCopy } from "@/copy/slide-list-copy"
import type { SlideStrip } from "@/editor/slide-sidebar"

export type GridRange = { readonly start: number; readonly end: number }

export function gridIndices({ start, end }: GridRange): number[] {
  return Array.from({ length: end - start }, (_, offset) => start + offset)
}

function gridAnchor<Id>(sequence: readonly Id[], held: readonly number[], at: number) {
  return (
    sequence
      .slice(0, at)
      .filter((_, index) => !held.includes(index))
      .at(-1) ?? null
  )
}

export function gridDrop(groups: readonly GridRange[], held: readonly number[], at: number) {
  const before = groups.map(gridIndices)
  const next = gridMovePlacement(before, held, gridAnchor(before.flat(), held, at), "same").groups
  if (
    next.length === before.length &&
    next.every(
      (group, number) =>
        group.length === before[number]?.length && group.every((index, offset) => index === before[number]?.[offset]),
    )
  )
    return null
  return next.flat().findIndex((index) => held.includes(index))
}

export function gridGroups(strip: SlideStrip): readonly GridRange[] {
  const file = Array.from({ length: strip.count }, (_, index) => slideId(String(index + 1)))
  const starts = strip.groups?.map((group) => group.start) ?? defaultGrid1(file).starts.map((id) => file.indexOf(id))
  return starts.map((start, index) => ({ start, end: starts[index + 1] ?? strip.count }))
}

export function gridMoveMessage(held: readonly number[], at: number): string {
  const first = at - held.filter((index) => index < at).length
  return held.length === 1
    ? slideListCopy.moved((held[0] ?? first) + 1, first + 1)
    : slideListCopy.movedSeveral(held.length, first + 1)
}
