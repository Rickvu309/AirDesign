import { object, reject } from "../read-kit.js"
import { type Charge, type Values, isList, numeric, record } from "./values.js"

const box = object({ x: numeric, y: numeric, w: numeric, h: numeric })

export function sectorSpace(radius: unknown, inner: unknown, outer: unknown, sweep: unknown) {
  const r = numeric(radius)
  const span = Math.abs(numeric(sweep))
  const edge = span >= 1 ? Infinity : r * Math.sin(Math.min(0.5, span) * Math.PI)
  const hole = numeric(inner)
  return Math.max(0, Math.min(edge, numeric(outer) - r, hole === 0 ? Infinity : r - hole))
}

type Box = ReturnType<typeof box>
const overlaps = (a: Box, b: Box): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h

export function nonoverlap(values: Values, charge: Charge): Values {
  const placed: ReturnType<typeof box>[] = []
  return values.filter((value) => {
    charge()
    const a = box(record(value).box)
    for (const b of placed) {
      charge()
      if (overlaps(a, b)) return false
    }
    placed.push(a)
    return true
  })
}

export function placeBoxes(values: Values, obstacles: Values, bounds: unknown, charge: Charge): Values {
  charge(obstacles.length)
  const occupied = obstacles.map(box)
  const area = box(bounds)
  const right = area.x + area.w
  const bottom = area.y + area.h

  return values.flatMap((value) => {
    if (value === null || typeof value !== "object" || isList(value)) return reject("shape", "A placement record.")
    const candidate = value
    if (!isList(candidate.boxes)) return reject("shape", "A list of candidate boxes.")
    for (const raw of candidate.boxes) {
      charge()
      const a = box(raw)
      if (a.x < area.x || a.y < area.y || a.x + a.w > right || a.y + a.h > bottom) continue
      if (
        occupied.some((b) => {
          charge()
          return overlaps(a, b)
        })
      )
        continue
      occupied.push(a)
      return [{ ...value, box: a }]
    }
    return []
  })
}
