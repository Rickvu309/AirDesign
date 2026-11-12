import type { CanvasElement } from "./record.js"

export function ShapeGradient(props: {
  readonly id: string
  readonly gradient: NonNullable<NonNullable<CanvasElement["geometry"]>["gradient"]>
  readonly width: number
  readonly height: number
}) {
  const { gradient, height, id, width } = props
  const stops = gradient.stops.map((stop, index) => <stop key={index} offset={stop.position} stopColor={stop.color} />)
  if (gradient.angle === null)
    return (
      <radialGradient id={id} r={Math.SQRT1_2}>
        {stops}
      </radialGradient>
    )
  const angle = (gradient.angle * Math.PI) / 180
  const dx = Math.cos(angle)
  const dy = Math.sin(angle)
  const length = Math.abs(width * dx) + Math.abs(height * dy)
  return (
    <linearGradient
      id={id}
      gradientUnits="userSpaceOnUse"
      x1={(width - dx * length) / 2}
      y1={(height - dy * length) / 2}
      x2={(width + dx * length) / 2}
      y2={(height + dy * length) / 2}
    >
      {stops}
    </linearGradient>
  )
}
