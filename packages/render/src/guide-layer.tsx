import { useSyncExternalStore, type CSSProperties } from "react"
import type { Distance, Extension, Measure, Outline } from "./distances.js"
import type { SnapGuide, SpacingGuide, Guide } from "./snapping.js"
import type { Scaled } from "./text-look.js"

export type Drawn = Guide | Measure

export type GuideBoard = {
  readonly show: (guides: readonly Drawn[]) => void
  readonly read: () => readonly Drawn[]
  readonly subscribe: (listener: () => void) => () => void
}

const emuPerPoint = 12_700
const markArm = 2.5
const tick = 4

export function guideBoard(): GuideBoard {
  let shown: readonly Drawn[] = []
  let said = "[]"
  const listeners = new Set<() => void>()
  return {
    show(guides) {
      const next = JSON.stringify(guides)
      if (next === said) return
      said = next
      shown = guides
      for (const listener of Array.from(listeners)) listener()
    },
    read: () => shown,
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

function crisp(pixels: number): number {
  return Math.round(pixels) + 0.5
}

function pointsOf(emu: number): string {
  return String(Math.round((emu / emuPerPoint) * 10) / 10)
}

const snapStroke: CSSProperties = { stroke: "var(--snap-guide)", strokeWidth: 1 }
const spacingStroke: CSSProperties = { stroke: "var(--spacing-guide)", strokeWidth: 1 }
const extensionStroke: CSSProperties = { ...snapStroke, strokeDasharray: "var(--guide-dash)" }

function pixelsOf(scaled: Scaled, emu: number): string {
  return String(Math.round(scaled(emu)))
}

function SnapLine(props: { readonly guide: SnapGuide; readonly scaled: Scaled }) {
  const { guide, scaled } = props
  const line = crisp(scaled(guide.at))
  const along = (value: number) => crisp(scaled(value))
  const point = (across: number, down: number) => (guide.axis === "x" ? `${across},${down}` : `${down},${across}`)
  const marks = guide.marks.map((mark) => {
    const at = along(mark)
    return `M${point(line - markArm, at - markArm)}L${point(line + markArm, at + markArm)}M${point(line - markArm, at + markArm)}L${point(line + markArm, at - markArm)}`
  })
  return (
    <path
      data-guide={`snap ${guide.axis} ${pixelsOf(scaled, guide.at)}`}
      d={`M${point(line, along(guide.from))}L${point(line, along(guide.to))}${marks.join("")}`}
      fill="none"
      shapeRendering="crispEdges"
      style={snapStroke}
    />
  )
}

function SpacingLine(props: { readonly guide: SpacingGuide; readonly scaled: Scaled }) {
  const { guide, scaled } = props
  const across = crisp(scaled(guide.across))
  const from = crisp(scaled(guide.from))
  const to = crisp(scaled(guide.to))
  const point = (along: number, side: number) => (guide.axis === "x" ? `${along},${side}` : `${side},${along}`)
  const d = [
    `M${point(from, across)}L${point(to, across)}`,
    `M${point(from, across - tick)}L${point(from, across + tick)}`,
    `M${point(to, across - tick)}L${point(to, across + tick)}`,
  ].join("")
  return (
    <path
      data-guide={`spacing ${guide.axis} ${pixelsOf(scaled, guide.from)} ${pixelsOf(scaled, guide.to)}`}
      d={d}
      fill="none"
      shapeRendering="crispEdges"
      style={spacingStroke}
    />
  )
}

const label: CSSProperties = {
  position: "absolute",
  padding: "0 var(--space-4)",
  borderRadius: "var(--guide-label-radius)",
  background: "var(--spacing-guide)",
  color: "var(--guide-label-text)",
  fontSize: "var(--guide-label-size)",
  lineHeight: "var(--guide-label-leading)",
  fontWeight: 600,
  whiteSpace: "nowrap",
  fontVariantNumeric: "tabular-nums",
}

function GapLabel(props: { readonly guide: SpacingGuide | Distance; readonly scaled: Scaled }) {
  const { guide, scaled } = props
  const middle = scaled((guide.from + guide.to) / 2)
  const across = scaled(guide.across)
  const place: CSSProperties =
    guide.axis === "x"
      ? { left: middle, top: across, transform: "translate(-50%, var(--guide-label-offset))" }
      : { left: across, top: middle, transform: "translate(var(--guide-label-offset), -50%)" }
  const value = pointsOf(guide.to - guide.from)
  const named = guide.kind === "spacing" ? { "data-spacing": value } : { "data-distance": value }
  const paint = guide.kind === "spacing" ? "var(--spacing-guide)" : "var(--snap-guide)"
  return (
    <span {...named} style={{ ...label, ...place, background: paint }}>
      {value}
    </span>
  )
}

function DistanceLine(props: { readonly guide: Distance; readonly scaled: Scaled }) {
  const { guide, scaled } = props
  const across = crisp(scaled(guide.across))
  const from = crisp(scaled(guide.from))
  const to = crisp(scaled(guide.to))
  const point = (along: number) => (guide.axis === "x" ? `${along},${across}` : `${across},${along}`)
  return (
    <path
      data-guide={`distance ${guide.axis} ${pixelsOf(scaled, guide.from)} ${pixelsOf(scaled, guide.to)}`}
      d={`M${point(from)}L${point(to)}`}
      fill="none"
      shapeRendering="crispEdges"
      style={snapStroke}
    />
  )
}

function ExtensionLine(props: { readonly guide: Extension; readonly scaled: Scaled }) {
  const { guide, scaled } = props
  const at = crisp(scaled(guide.at))
  const point = (along: number) => (guide.axis === "y" ? `${at},${along}` : `${along},${at}`)
  return (
    <path
      data-guide={`extension ${guide.axis} ${pixelsOf(scaled, guide.at)}`}
      d={`M${point(crisp(scaled(guide.from)))}L${point(crisp(scaled(guide.to)))}`}
      fill="none"
      shapeRendering="crispEdges"
      style={extensionStroke}
    />
  )
}

function OutlineBox(props: { readonly guide: Outline; readonly scaled: Scaled }) {
  const { box } = props.guide
  const { scaled } = props
  const [left, top, right, bottom] = [box.left, box.top, box.right, box.bottom].map((edge) => crisp(scaled(edge)))
  return (
    <path
      data-guide={`outline ${[box.left, box.top, box.right, box.bottom].map((edge) => pixelsOf(scaled, edge)).join(" ")}`}
      d={`M${left},${top}H${right}V${bottom}H${left}Z`}
      fill="none"
      shapeRendering="crispEdges"
      style={snapStroke}
    />
  )
}

function DrawnLine(props: { readonly guide: Drawn; readonly scaled: Scaled }) {
  const { guide, scaled } = props
  if (guide.kind === "snap") return <SnapLine guide={guide} scaled={scaled} />
  if (guide.kind === "spacing") return <SpacingLine guide={guide} scaled={scaled} />
  if (guide.kind === "distance") return <DistanceLine guide={guide} scaled={scaled} />
  if (guide.kind === "extension") return <ExtensionLine guide={guide} scaled={scaled} />
  return <OutlineBox guide={guide} scaled={scaled} />
}

const layer: CSSProperties = { position: "absolute", inset: 0, overflow: "visible", pointerEvents: "none" }

export function GuideLayer(props: { readonly board: GuideBoard; readonly scaled: Scaled }) {
  const { board, scaled } = props
  const guides = useSyncExternalStore(board.subscribe, board.read, board.read)
  if (guides.length === 0) return null
  const gaps = guides.filter(
    (guide): guide is SpacingGuide | Distance => guide.kind === "spacing" || guide.kind === "distance",
  )
  return (
    <div data-guides={guides.length} aria-hidden style={layer}>
      <svg width="100%" height="100%" style={{ ...layer, width: "100%", height: "100%" }}>
        {guides.map((guide, index) => (
          <DrawnLine key={index} guide={guide} scaled={scaled} />
        ))}
      </svg>
      {gaps.map((guide, index) => (
        <GapLabel key={index} guide={guide} scaled={scaled} />
      ))}
    </div>
  )
}
