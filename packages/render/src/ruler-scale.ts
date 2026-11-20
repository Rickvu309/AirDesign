export type RulerTick = { readonly at: number; readonly label: string | null }

export type RulerSpan = { readonly length: number; readonly origin: number; readonly pixelsPerPoint: number }

const steps = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000] as const
const widest = 5000

const labelRoom = 48

export function rulerStep(pixelsPerPoint: number): number {
  return steps.find((step) => step * pixelsPerPoint >= labelRoom) ?? widest
}

function partsOf(step: number): number {
  return String(step).startsWith("2") ? 4 : 5
}

export function rulerTicks(span: RulerSpan): readonly RulerTick[] {
  const { length, origin, pixelsPerPoint } = span
  if (!(pixelsPerPoint > 0) || !(length > 0)) return []
  const step = rulerStep(pixelsPerPoint)
  const parts = partsOf(step)
  const minor = step / parts
  const first = Math.ceil(-origin / pixelsPerPoint / minor)
  const last = Math.floor((length - origin) / pixelsPerPoint / minor)
  const ticks: RulerTick[] = []
  for (let count = first; count <= last; count += 1) {
    const points = Math.round(count * minor * 1000) / 1000
    const at = origin + points * pixelsPerPoint
    ticks.push({ at, label: count % parts === 0 ? String(points) : null })
  }
  return ticks
}
