export type Arrowhead = "arrow" | "triangle" | "circle"

const heads: Readonly<
  Record<
    Arrowhead,
    { readonly length: number; readonly width: number; readonly stroke: number; readonly pastEnd: number }
  >
> = {
  arrow: { length: 3.2, width: 6.4, stroke: 1, pastEnd: 0 },
  triangle: { length: 3.7, width: 4.3, stroke: 0.6, pastEnd: 0.4 },
  circle: { length: 4, width: 4, stroke: 0, pastEnd: 2 },
}

export function ArrowMarker(props: {
  readonly id: string
  readonly kind: Arrowhead
  readonly color: string
  readonly weight: number
}) {
  const { id, kind, color, weight } = props
  const head = heads[kind]
  const length = head.length * weight
  const width = head.width * weight
  const point = `M0 0L${String(length)} ${String(width / 2)}L0 ${String(width)}`
  return (
    <marker
      id={id}
      markerWidth={length}
      markerHeight={width}
      refX={length - head.pastEnd * weight}
      refY={width / 2}
      orient="auto-start-reverse"
      markerUnits="userSpaceOnUse"
      overflow="visible"
    >
      {kind === "circle" ? (
        <circle cx={length / 2} cy={width / 2} r={width / 2} fill={color} />
      ) : (
        <path
          d={kind === "triangle" ? `${point}Z` : point}
          fill={kind === "triangle" ? color : "none"}
          stroke={color}
          strokeWidth={head.stroke * weight}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </marker>
  )
}
