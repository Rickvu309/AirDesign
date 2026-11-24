import type { Aim } from "./line-end-drag"
import type { Point } from "./slide-geometry"

const edge = "var(--primary-strong)"
const radius = 5
const reach = 10
const siteRadius = 4

const grips = ["line-start", "line-end"] as const

export function LineHandles({
  ends,
  attached,
  aim,
  scale,
}: {
  readonly ends: readonly [Point, Point]
  readonly attached: readonly [boolean, boolean]
  readonly aim: Aim | null
  readonly scale: number
}) {
  return (
    <g data-line-handles="">
      {aim === null ? null : (
        <g data-line-sites="">
          {aim.sites.map((site, at) => (
            <circle
              key={at}
              cx={site.x * scale}
              cy={site.y * scale}
              r={siteRadius}
              fill="white"
              stroke={edge}
              strokeWidth={1}
            />
          ))}
          {aim.site === null ? null : (
            <circle data-line-site="" cx={aim.site.x * scale} cy={aim.site.y * scale} r={siteRadius + 2} fill={edge} />
          )}
        </g>
      )}
      {grips.map((grip, at) => {
        const end = ends[at]!
        return (
          <g key={grip}>
            <circle
              data-grip={grip}
              cx={end.x * scale}
              cy={end.y * scale}
              r={reach}
              fill="transparent"
              style={{ pointerEvents: "all", cursor: "move" }}
            />
            <circle
              data-line-end={attached[at] === true ? "attached" : "free"}
              cx={end.x * scale}
              cy={end.y * scale}
              r={radius}
              fill={attached[at] === true ? edge : "white"}
              stroke={edge}
              strokeWidth={1}
              style={{ pointerEvents: "none" }}
            />
          </g>
        )
      })}
    </g>
  )
}
