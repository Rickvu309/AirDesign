import type { Aim } from "./line-end-drag"
import { ScreenSized } from "./screen-sized"
import type { Point } from "@/editing/slide-geometry"

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
            <ScreenSized key={at} at={{ x: site.x * scale, y: site.y * scale }}>
              <circle r={siteRadius} fill="white" stroke={edge} strokeWidth={1} />
            </ScreenSized>
          ))}
          {aim.site === null ? null : (
            <ScreenSized at={{ x: aim.site.x * scale, y: aim.site.y * scale }}>
              <circle data-line-site="" r={siteRadius + 2} fill={edge} />
            </ScreenSized>
          )}
        </g>
      )}
      {grips.map((grip, at) => {
        const end = ends[at]!
        return (
          <ScreenSized key={grip} at={{ x: end.x * scale, y: end.y * scale }}>
            <circle data-grip={grip} r={reach} fill="transparent" style={{ pointerEvents: "all", cursor: "move" }} />
            <circle
              data-line-end={attached[at] === true ? "attached" : "free"}
              r={radius}
              fill={attached[at] === true ? edge : "white"}
              stroke={edge}
              strokeWidth={1}
              style={{ pointerEvents: "none" }}
            />
          </ScreenSized>
        )
      })}
    </g>
  )
}
