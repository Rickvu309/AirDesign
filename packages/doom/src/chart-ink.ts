import type { Box, Resolved } from "./resolved.js"

const clearX = 2
const clearShare = 0.01
const clearY = 1
const slack = 0.5

export function textBoxes(part: Resolved): readonly Box[] {
  if (part.text === null) return []
  return part.text.lines.map((line) => ({
    ...part.box,
    x: part.box.x + line.x,
    y: part.box.y + line.y,
    w: line.w,
    h: line.h,
  }))
}

export function overlaps(a: Box, b: Box): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
}

function crosses(a: Box, b: Box): boolean {
  const room = clearX + clearShare * Math.max(a.w, b.w)
  return a.x - room < b.x + b.w && b.x < a.x + a.w + room && a.y - clearY < b.y + b.h && b.y < a.y + a.h + clearY
}

function inside(ink: Box, area: Box): boolean {
  return (
    ink.x >= area.x - slack &&
    ink.y >= area.y - slack &&
    ink.x + ink.w <= area.x + area.w + slack &&
    ink.y + ink.h <= area.y + area.h + slack
  )
}

export type InkBoard = {
  readonly admits: (parts: readonly Resolved[], area: Box) => boolean
  readonly take: (parts: readonly Resolved[]) => void
  readonly first: (tries: readonly Resolved[], area: Box) => Resolved | undefined
  readonly spaced: (
    count: number,
    anchor: number,
    area: Box,
    make: (index: number) => Resolved,
    required?: readonly number[],
  ) => readonly number[]
}

export function inkBoard(): InkBoard {
  const taken: Box[] = []
  const admits: InkBoard["admits"] = (parts, area) => {
    const fresh = parts.flatMap(textBoxes)
    return fresh.every(
      (ink, at) =>
        inside(ink, area) &&
        !taken.some((other) => crosses(ink, other)) &&
        !fresh.slice(0, at).some((other) => crosses(ink, other)),
    )
  }
  const take: InkBoard["take"] = (parts) => {
    taken.push(...parts.flatMap(textBoxes))
  }
  return {
    admits,
    take,
    first: (tries, area) => {
      const found = tries.find((part) => admits([part], area))
      if (found !== undefined) take([found])
      return found
    },
    spaced: (count, anchor, area, make, required = []) => {
      const made = new Map<number, Resolved>()
      const part = (index: number) => {
        const known = made.get(index) ?? make(index)
        made.set(index, known)
        return known
      }
      const must = [...new Set(required)].filter((index) => index >= 0 && index < count)
      for (let step = 1; step <= count; step++)
        for (let offset = 0; offset < step; offset++) {
          const grid = Array.from({ length: count }, (_, index) => index).filter(
            (index) => !must.includes(index) && (((index - anchor - offset) % step) + step) % step === 0,
          )
          const kept = [...must, ...grid.filter((index) => admits([...must, index].map(part), area))].sort(
            (a, b) => a - b,
          )
          if (kept.length > 0 && admits(kept.map(part), area)) return kept
        }
      return []
    },
  }
}
