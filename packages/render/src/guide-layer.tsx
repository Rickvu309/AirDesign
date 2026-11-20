import { useRef, useSyncExternalStore, type CSSProperties } from "react"
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

type LineLook = { readonly "data-guide": string; readonly d: string; readonly style: CSSProperties }

function snapLine(guide: SnapGuide, scaled: Scaled): LineLook {
  const line = crisp(scaled(guide.at))
  const along = (value: number) => crisp(scaled(value))
  const point = (across: number, down: number) => (guide.axis === "x" ? `${across},${down}` : `${down},${across}`)
  const marks = guide.marks.map((mark) => {
    const at = along(mark)
    return `M${point(line - markArm, at - markArm)}L${point(line + markArm, at + markArm)}M${point(line - markArm, at + markArm)}L${point(line + markArm, at - markArm)}`
  })
  return {
    "data-guide": `snap ${guide.axis} ${pixelsOf(scaled, guide.at)}`,
    d: `M${point(line, along(guide.from))}L${point(line, along(guide.to))}${marks.join("")}`,
    style: snapStroke,
  }
}

function spacingLine(guide: SpacingGuide, scaled: Scaled): LineLook {
  const across = crisp(scaled(guide.across))
  const from = crisp(scaled(guide.from))
  const to = crisp(scaled(guide.to))
  const point = (along: number, side: number) => (guide.axis === "x" ? `${along},${side}` : `${side},${along}`)
  const d = [
    `M${point(from, across)}L${point(to, across)}`,
    `M${point(from, across - tick)}L${point(from, across + tick)}`,
    `M${point(to, across - tick)}L${point(to, across + tick)}`,
  ].join("")
  return {
    "data-guide": `spacing ${guide.axis} ${pixelsOf(scaled, guide.from)} ${pixelsOf(scaled, guide.to)}`,
    d,
    style: spacingStroke,
  }
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

const restingLabel: CSSProperties = { display: "none" }

type Gap = SpacingGuide | Distance

function isGap(guide: Drawn): guide is Gap {
  return guide.kind === "spacing" || guide.kind === "distance"
}

function GapLabel(props: { readonly guide: Gap | undefined; readonly scaled: Scaled }) {
  const { guide, scaled } = props
  if (guide === undefined) return <span style={restingLabel}>{""}</span>
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

function distanceLine(guide: Distance, scaled: Scaled): LineLook {
  const across = crisp(scaled(guide.across))
  const from = crisp(scaled(guide.from))
  const to = crisp(scaled(guide.to))
  const point = (along: number) => (guide.axis === "x" ? `${along},${across}` : `${across},${along}`)
  return {
    "data-guide": `distance ${guide.axis} ${pixelsOf(scaled, guide.from)} ${pixelsOf(scaled, guide.to)}`,
    d: `M${point(from)}L${point(to)}`,
    style: snapStroke,
  }
}

function extensionLine(guide: Extension, scaled: Scaled): LineLook {
  const at = crisp(scaled(guide.at))
  const point = (along: number) => (guide.axis === "y" ? `${at},${along}` : `${along},${at}`)
  return {
    "data-guide": `extension ${guide.axis} ${pixelsOf(scaled, guide.at)}`,
    d: `M${point(crisp(scaled(guide.from)))}L${point(crisp(scaled(guide.to)))}`,
    style: extensionStroke,
  }
}

function outlineBox(guide: Outline, scaled: Scaled): LineLook {
  const { box } = guide
  const [left, top, right, bottom] = [box.left, box.top, box.right, box.bottom].map((edge) => crisp(scaled(edge)))
  return {
    "data-guide": `outline ${[box.left, box.top, box.right, box.bottom].map((edge) => pixelsOf(scaled, edge)).join(" ")}`,
    d: `M${left},${top}H${right}V${bottom}H${left}Z`,
    style: snapStroke,
  }
}

function drawnLine(guide: Drawn, scaled: Scaled): LineLook {
  if (guide.kind === "snap") return snapLine(guide, scaled)
  if (guide.kind === "spacing") return spacingLine(guide, scaled)
  if (guide.kind === "distance") return distanceLine(guide, scaled)
  if (guide.kind === "extension") return extensionLine(guide, scaled)
  return outlineBox(guide, scaled)
}

const layer: CSSProperties = { position: "absolute", inset: 0, overflow: "visible", pointerEvents: "none" }

export function GuideLayer(props: { readonly board: GuideBoard; readonly scaled: Scaled }) {
  const { board, scaled } = props
  const guides = useSyncExternalStore(board.subscribe, board.read, board.read)
  const gaps = guides.filter(isGap)
  const room = useRef({ lines: 0, labels: 0 })
  room.current = {
    lines: Math.max(room.current.lines, guides.length),
    labels: Math.max(room.current.labels, gaps.length),
  }
  return (
    <div {...(guides.length === 0 ? {} : { "data-guides": guides.length })} aria-hidden style={layer}>
      <svg width="100%" height="100%" style={{ ...layer, width: "100%", height: "100%" }}>
        {Array.from({ length: room.current.lines }, (_, index) => {
          const guide = guides[index]
          return (
            <path
              key={index}
              fill="none"
              shapeRendering="crispEdges"
              {...(guide === undefined ? {} : drawnLine(guide, scaled))}
            />
          )
        })}
      </svg>
      {Array.from({ length: room.current.labels }, (_, index) => (
        <GapLabel key={index} guide={gaps[index]} scaled={scaled} />
      ))}
    </div>
  )
}
