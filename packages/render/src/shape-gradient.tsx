import type { CanvasElement } from "./record.js"

type Gradient = NonNullable<NonNullable<CanvasElement["geometry"]>["gradient"]>

export const sidesGradient = (gradient: Gradient | undefined): boolean =>
  gradient !== undefined &&
  gradient.angle === null &&
  (gradient.path?.kind === "rect" || gradient.path?.kind === "shape")

const centred = { left: 0.5, top: 0.5, right: 0.5, bottom: 0.5 }
const seam = 1

const corners = (points: readonly number[]) =>
  [0, 2, 4, 6].map((index) => `${String(points[index])},${String(points[index + 1])}`).join(" ")

function RectGradient(props: {
  readonly id: string
  readonly gradient: Gradient
  readonly width: number
  readonly height: number
}) {
  const { gradient, height, id, width } = props
  const focus = gradient.path?.focus ?? centred
  const left = Math.min(focus.left * width, (1 - focus.right) * width)
  const right = Math.max(focus.left * width, (1 - focus.right) * width)
  const top = Math.min(focus.top * height, (1 - focus.bottom) * height)
  const bottom = Math.max(focus.top * height, (1 - focus.bottom) * height)
  const stops = gradient.stops.map((stop, index) => <stop key={index} offset={stop.position} stopColor={stop.color} />)
  const sides = [
    { name: "top", open: top > 0, points: [0, 0, width, 0, right, top, left, top], vector: [0, top, 0, 0] },
    {
      name: "right",
      open: right < width,
      points: [width, 0, width, height, right, bottom, right, top],
      vector: [right, 0, width, 0],
    },
    {
      name: "bottom",
      open: bottom < height,
      points: [0, height, width, height, right, bottom, left, bottom],
      vector: [0, bottom, 0, height],
    },
    { name: "left", open: left > 0, points: [0, 0, 0, height, left, bottom, left, top], vector: [left, 0, 0, 0] },
  ].filter((side) => side.open)
  return (
    <>
      {sides.map((side) => (
        <linearGradient
          key={side.name}
          id={`${id}-${side.name}`}
          gradientUnits="userSpaceOnUse"
          x1={side.vector[0]}
          y1={side.vector[1]}
          x2={side.vector[2]}
          y2={side.vector[3]}
        >
          {stops}
        </linearGradient>
      ))}
      <pattern id={id} patternUnits="userSpaceOnUse" width={width} height={height}>
        {sides.map((side) => (
          <polygon
            key={side.name}
            points={corners(side.points)}
            fill={`url(#${id}-${side.name})`}
            stroke={`url(#${id}-${side.name})`}
            strokeWidth={seam}
          />
        ))}
      </pattern>
    </>
  )
}

export function ShapeGradient(props: {
  readonly id: string
  readonly gradient: Gradient
  readonly width: number
  readonly height: number
}) {
  const { gradient, height, id, width } = props
  const stops = gradient.stops.map((stop, index) => <stop key={index} offset={stop.position} stopColor={stop.color} />)
  if (sidesGradient(gradient)) return <RectGradient id={id} gradient={gradient} width={width} height={height} />
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
