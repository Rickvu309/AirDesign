import { useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type RefObject } from "react"
import type { CanvasElement } from "./record.js"
import type { CanvasFit, CanvasParagraph, CanvasRunStyle, CanvasSpacing, CanvasText } from "./text-record.js"
import type { PaintBox } from "./paint-box.js"
import type { Scaled } from "./text-look.js"

type Shrink = Extract<CanvasFit, { kind: "shrink" }>

export type FitStep = readonly [scale: number, reduction: number]

const scaleStep = 0.075
const smallestScale = 0.25
const reductions = [0, 0.1, 0.2]
const radiansPerDegree = Math.PI / 180
const near = (left: number, right: number) => Math.abs(left - right) < 1e-6
const tidy = (value: number) => Math.round(value * 1000) / 1000

const scales = Array.from({ length: Math.round((1 - smallestScale) / scaleStep) + 1 }, (_, at) =>
  tidy(1 - at * scaleStep),
)

export function shrinkSteps(fit: Shrink): readonly FitStep[] {
  const narrower = reductions.filter((reduction) => reduction > fit.reduction + 1e-6)
  const smaller = scales.filter((scale) => scale < fit.scale - 1e-6)
  return [
    [fit.scale, fit.reduction],
    ...narrower.map((reduction): FitStep => [fit.scale, reduction]),
    ...smaller.flatMap((scale) => reductions.map((reduction): FitStep => [scale, reduction])),
  ]
}

function spaced(spacing: CanvasSpacing | null | undefined, factor: number): CanvasSpacing | null {
  if (spacing == null) return near(factor, 1) ? null : { percent: tidy(factor) }
  if ("percent" in spacing) return { percent: tidy(spacing.percent * factor) }
  return { length: spacing.length * factor }
}

function sized<Style extends CanvasRunStyle>(style: Style, factor: number): Style {
  return { ...style, size: style.size * factor }
}

export function fitted(text: CanvasText, [scale, reduction]: FitStep): CanvasText {
  const fit = text.fit
  if (fit?.kind !== "shrink") return text
  const size = scale / fit.scale
  const lines = (1 - reduction) / (1 - fit.reduction)
  const paragraph = (each: CanvasParagraph): CanvasParagraph => ({
    ...each,
    lineSpacing: spaced(each.lineSpacing, lines),
    runs: each.runs.map((run) => sized(run, size)),
    endStyle: sized(each.endStyle, size),
  })
  return { ...text, paragraphs: text.paragraphs.map(paragraph), fit: { kind: "shrink", scale, reduction } }
}

const kept = { top: -1, middle: 0, bottom: 1 } as const

export function grownBox(box: PaintBox, anchor: CanvasText["anchor"], extra: number): PaintBox {
  const height = box.height + extra
  const along = ((box.flipV ? 1 : -1) * kept[anchor] * extra) / 2
  const turn = box.rotation * radiansPerDegree
  const x = box.x + box.width / 2 - Math.sin(turn) * along
  const y = box.y + box.height / 2 + Math.cos(turn) * along
  return { ...box, x: x - box.width / 2, y: y - height / 2, height }
}

export function measured(text: CanvasText | null): boolean {
  return text?.fit !== undefined && (text.flow ?? "horz") === "horz" && (text.columns ?? 1) === 1
}

let fontLoads = 0
const fontWatchers = new Set<() => void>()

function fontsLoaded(): void {
  fontLoads += 1
  for (const watcher of fontWatchers) watcher()
}

function fontSet(): FontFaceSet | undefined {
  return typeof document === "undefined" ? undefined : (document.fonts as FontFaceSet | undefined)
}

function watchFonts(watcher: () => void): () => void {
  const fonts = fontSet()
  if (fonts === undefined) return () => {}
  if (fontWatchers.size === 0) fonts.addEventListener("loadingdone", fontsLoaded)
  fontWatchers.add(watcher)
  return () => {
    fontWatchers.delete(watcher)
    if (fontWatchers.size === 0) fonts.removeEventListener("loadingdone", fontsLoaded)
  }
}

const fontLoadsNow = () => fontLoads
const noFontLoads = () => 0

type Fitting = {
  readonly text: CanvasText | null
  readonly fonts: number
  readonly written: string
  readonly width: number
  readonly height: number
  readonly step: number
  readonly grown: number
}

const tolerance = 0.5

const sameFor = (fitting: Fitting, other: Fitting) =>
  fitting.text === other.text &&
  fitting.fonts === other.fonts &&
  fitting.written === other.written &&
  fitting.width === other.width &&
  fitting.height === other.height

export function nextFitting(fitting: Fitting, fit: CanvasFit, over: number, steps: number): Fitting {
  if (!(over > tolerance)) return fitting
  if (fit.kind === "grow") return { ...fitting, grown: fitting.grown + over }
  return fitting.step + 1 < steps ? { ...fitting, step: fitting.step + 1 } : fitting
}

function overflowOf(layer: HTMLElement): number | null {
  const body = layer.querySelector<HTMLElement>(":scope > [data-text-body]")
  if (body === null) return null
  const style = getComputedStyle(layer)
  const room =
    layer.clientHeight - (Number.parseFloat(style.paddingTop) || 0) - (Number.parseFloat(style.paddingBottom) || 0)
  return body.offsetHeight - room
}

export function useTextFit(
  element: CanvasElement,
  scaled: Scaled,
  written: string,
): { readonly element: CanvasElement; readonly layer: RefObject<HTMLDivElement | null> } {
  const layer = useRef<HTMLDivElement>(null)
  const { box, text } = element
  const fit = text?.fit
  const fonts = useSyncExternalStore(watchFonts, fontLoadsNow, noFontLoads)
  const now: Fitting = {
    text,
    fonts,
    written,
    width: box === null ? 0 : scaled(box.width),
    height: box === null ? 0 : scaled(box.height),
    step: 0,
    grown: 0,
  }
  const [held, hold] = useState(now)
  const fitting = sameFor(held, now) ? held : now
  const steps = useMemo(() => (fit?.kind === "shrink" ? shrinkSteps(fit) : []), [fit])
  useLayoutEffect(() => {
    const shown = layer.current
    if (shown === null || fit === undefined || !measured(text)) return
    const measure = () => {
      const over = overflowOf(shown)
      if (over !== null) hold((before) => nextFitting(sameFor(before, now) ? before : now, fit, over, steps.length))
    }
    measure()
    if (typeof ResizeObserver === "undefined") return
    const watch = new ResizeObserver(measure)
    for (const each of shown.children) watch.observe(each)
    return () => watch.disconnect()
  })
  const step = steps[fitting.step]
  const shrunk = text !== null && step !== undefined && fitting.step > 0 ? fitted(text, step) : text
  const grown =
    box !== null && text !== null && fitting.grown > 0 ? grownBox(box, text.anchor, fitting.grown / scaled(1)) : box
  return { element: shrunk === text && grown === box ? element : { ...element, text: shrunk, box: grown }, layer }
}
