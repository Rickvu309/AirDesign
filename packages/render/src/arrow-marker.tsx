export type Arrowhead = "triangle" | "stealth" | "diamond" | "oval" | "arrow"

const arrowPaths: Readonly<Record<Exclude<Arrowhead, "oval">, string>> = {
  triangle: "M0 0L10 5L0 10Z",
  stealth: "M0 0L10 5L0 10L3 5Z",
  diamond: "M0 5L5 0L10 5L5 10Z",
  arrow: "M0 0L10 5L0 10",
}

const defaultArrowScale = 3

export function ArrowMarker(props: {
  readonly id: string
  readonly kind: Arrowhead
  readonly color: string
  readonly weight: number
  readonly size: { readonly width: number; readonly length: number } | undefined
}) {
  const { id, kind, color, weight, size } = props
  return (
    <marker
      id={id}
      viewBox="0 0 10 10"
      preserveAspectRatio="none"
      markerWidth={(size?.length ?? defaultArrowScale) * weight}
      markerHeight={(size?.width ?? defaultArrowScale) * weight}
      refX={kind === "oval" || kind === "diamond" ? 5 : 10}
      refY={5}
      orient="auto-start-reverse"
      markerUnits="userSpaceOnUse"
      overflow="visible"
    >
      {kind === "oval" ? (
        <ellipse cx={5} cy={5} rx={5} ry={5} fill={color} />
      ) : (
        <path
          d={arrowPaths[kind]}
          fill={kind === "arrow" ? "none" : color}
          stroke={kind === "arrow" ? color : "none"}
          strokeWidth={1}
        />
      )}
    </marker>
  )
}
