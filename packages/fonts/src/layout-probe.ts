import { fallbackFont, servedFontName } from "./family.js"
import { fontRevision } from "./catalog.js"
import { boldWeight, regularWeight, type ServedFace } from "./named-face.js"
import { pickServedFace, weightRange } from "./served-face.js"
import type { FaceAsset, FontLayoutEngine, LayoutFace, LayoutParagraph } from "./layout-contract.js"

type MeasureSample = {
  readonly text: string
  readonly runs: readonly {
    readonly font: string
    readonly bold: boolean
    readonly italic: boolean
    readonly tracking: number
    readonly size: number
    readonly range: { readonly start: number; readonly end: number }
  }[]
  readonly sourceOffsetByTextOffset: readonly number[]
  readonly width: number
  readonly lines: readonly { readonly start: number; readonly end: number; readonly ink: number }[]
}

type FaceFile = ServedFace & { readonly key: string; readonly read: FaceAsset["read"] }
type MeasuredLine = { readonly end: number; readonly advance: number; readonly start: number }
type SampleResult =
  | { readonly kind: "measured"; readonly shared: readonly MeasuredLine[]; readonly legacy: MeasureSample["lines"] }
  | { readonly kind: "unserved" | "pending"; readonly range: { readonly start: number; readonly end: number } }
  | { readonly kind: "budget" | "unavailable" }
export type LayoutComparison = SampleResult & {
  readonly ms: number
  readonly cache?: ReturnType<FontLayoutEngine["cache"]>
}

const maxShapes = 64
const intervalMs = 250
let engine: Promise<FontLayoutEngine> | undefined

function compare(layout: FontLayoutEngine, sample: MeasureSample, paragraph: LayoutParagraph): SampleResult {
  const { text, sourceOffsetByTextOffset: offsets } = paragraph
  const { graphemes, opportunities } = layout.breaks(paragraph)
  const boundaries = new Set(graphemes)
  const ends = sample.width === Infinity ? [text.length] : opportunities.filter((end) => end > 0 && boundaries.has(end))
  const shared: MeasuredLine[] = []
  let start = 0
  let next = 0
  let shapes = 0
  while (start < text.length) {
    let chosen: MeasuredLine | undefined
    let chosenEnd = start
    for (let at = next; at < ends.length; at++) {
      const end = ends[at]!
      if (++shapes > maxShapes) return { kind: "budget" }
      const inkEnd = start + text.slice(start, end).replace(/ +$/u, "").length
      const line = layout.shapeLine({
        paragraph,
        range: { start, end: inkEnd },
        lineEnding: end < text.length && text[inkEnd - 1] === "\u00ad" ? "discretionary-hyphen" : "plain",
      })
      if (line.kind !== "shaped") return { kind: line.kind, range: line.range }
      if (chosen !== undefined && line.advance > sample.width) break
      chosen = { start: line.range.start, end: offsets[end] ?? end, advance: line.advance }
      chosenEnd = end
      next = at + 1
      if (line.advance > sample.width) break
    }
    if (chosen === undefined) return { kind: "budget" }
    shared.push(chosen)
    start = chosenEnd
  }
  return { kind: "measured", shared, legacy: sample.lines.map(({ start, end, ink }) => ({ start, end, ink })) }
}

export function createLayoutProbe(options: {
  readonly family: (name: string) => Promise<readonly FaceFile[]>
  readonly record: (result: LayoutComparison) => void
  readonly afterPaint?: () => Promise<void>
}): (sample: MeasureSample) => void {
  const now = performance.now.bind(performance)
  let busy = false
  let last = -Infinity
  return (sample) => {
    if (busy || now() - last < intervalMs) return
    busy = true
    void (async () => {
      let start = now()
      let outcome: SampleResult
      let cache: LayoutComparison["cache"]
      try {
        if (options.afterPaint !== undefined) await options.afterPaint()
        start = now()
        const active = await (engine ??= import("./layout.js").then(({ createFontLayout }) => createFontLayout()))
        const runs: LayoutParagraph["runs"][number][] = []
        for (const run of sample.runs) {
          const weight = run.bold ? boldWeight : regularWeight
          const primary = servedFontName(run.font) ?? fallbackFont
          const faces: LayoutFace[] = []
          for (const family of new Set([primary, fallbackFont])) {
            const chosen = pickServedFace(await options.family(family), weight, run.italic)
            if (chosen === undefined) continue
            const [low, high] = weightRange(chosen)
            faces.push(
              await active.prepareFace({
                revision: fontRevision,
                key: chosen.key,
                read: chosen.read,
                axes: { wght: Math.max(low, Math.min(high, weight)), opsz: 32 },
              }),
            )
          }
          const [first, ...fallbacks] = faces
          if (first !== undefined) runs.push({ ...run, faces: [first, ...fallbacks] })
        }
        outcome = compare(active, sample, {
          text: sample.text,
          sourceOffsetByTextOffset: sample.sourceOffsetByTextOffset,
          runs,
          locale: "und",
          direction: "auto",
        })
        cache = active.cache()
      } catch {
        outcome = { kind: "unavailable" }
      }
      last = now()
      options.record({ ...outcome, ms: last - start, ...(cache === undefined ? {} : { cache }) })
    })().finally(() => {
      busy = false
    })
  }
}
