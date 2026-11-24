import { sameValue } from "./changing-writes.js"
import type { Geometry } from "./geometry.js"

type Line = Extract<Geometry, { kind: "line" }>

const lineIn = (value: unknown): Line | undefined =>
  (value as Geometry | null | undefined)?.kind === "line" ? (value as Line) : undefined

export function lineEndsBack(was: unknown, now: unknown, wrote: unknown): Line | undefined {
  const [before, current, written] = [lineIn(was), lineIn(now), lineIn(wrote)]
  if (before === undefined || current === undefined || written === undefined) return undefined
  const back = (key: "start" | "end") =>
    sameValue(current[key], written[key]) && !sameValue(before[key], written[key]) ? before[key] : current[key]
  const start = back("start")
  const end = back("end")
  return start === current.start && end === current.end ? undefined : { ...current, start, end }
}
