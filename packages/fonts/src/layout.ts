import bidiFactory from "bidi-js"
import * as hb from "harfbuzzjs/lazy"
import { loadBreaker } from "./icu-breaks.js"
import {
  type FontLayoutEngine,
  type LayoutFace,
  type LayoutGlyph,
  type LayoutParagraph,
  fontLayoutRevision,
} from "./layout-contract.js"
import { LayoutFaces } from "./layout-faces.js"

type Run = LayoutParagraph["runs"][number]
type Item = {
  readonly start: number
  end: number
  readonly run: Run
  readonly level: number
  readonly face: LayoutFace
  script: string | undefined
  trackedClusters: number
}

const faceBudget = 48 * 1024 * 1024
const scalePerPx = 65536
const ignorable = 1
const emoji = 2
const emojiPresentation = 4
const extendedPictographic = 8
const bidi = bidiFactory()
let engine: Promise<FontLayoutEngine> | undefined

function firstAfter(offsets: readonly number[], at: number): number {
  let low = 0
  let high = offsets.length
  while (low < high) {
    const mid = (low + high) >>> 1
    if (offsets[mid]! <= at) low = mid + 1
    else high = mid
  }
  return low
}

function sameFace(a: LayoutFace, b: LayoutFace): boolean {
  if (a === b) return true
  if (
    a.revision !== b.revision ||
    a.sha256 !== b.sha256 ||
    a.faceIndex !== b.faceIndex ||
    a.presentation !== b.presentation
  )
    return false
  const axes = Object.entries(a.axes)
  return axes.length === Object.keys(b.axes).length && axes.every(([tag, value]) => b.axes[tag] === value)
}

function sameMetrics(a: Run, b: Run): boolean {
  return a.size === b.size && a.tracking === b.tracking
}

function shapingRuns(runs: LayoutParagraph["runs"]): readonly Run[] {
  const joined: Run[] = []
  for (const run of runs) {
    const previous = joined.at(-1)
    if (
      previous !== undefined &&
      previous.range.end === run.range.start &&
      sameMetrics(previous, run) &&
      previous.faces.length === run.faces.length &&
      previous.faces.every((face, index) => sameFace(face, run.faces[index]!))
    ) {
      joined[joined.length - 1] = { ...previous, range: { start: previous.range.start, end: run.range.end } }
    } else joined.push(run)
  }
  return joined
}

export function createFontLayout(): Promise<FontLayoutEngine> {
  return (engine ??= initializeLayout())
}

async function initializeLayout(): Promise<FontLayoutEngine> {
  const [, breaker] = await Promise.all([hb.initialize(), loadBreaker()])
  if (hb.versionString() !== fontLayoutRevision.harfBuzz) throw new Error("HarfBuzz revision changed")
  const faces = new LayoutFaces(faceBudget)
  const buffer = new hb.Buffer()
  const noLigatures = ["liga", "clig"].map((tag) => new hb.Feature(tag, 0, 0, 0xffffffff))
  const paragraphs = new WeakMap<
    LayoutParagraph,
    {
      readonly graphemes: readonly number[]
      readonly levels: Uint8Array
      readonly runs: readonly Run[]
    }
  >()

  function shape(font: hb.Font, item: Item, line: string, start: number, locale: string) {
    buffer.reset()
    buffer.addText(line, item.start - start, item.end - item.start)
    buffer.setDirection(item.level % 2 === 0 ? hb.Direction.LTR : hb.Direction.RTL)
    buffer.setLanguage(locale)
    if (item.script !== undefined) buffer.setScript(item.script)
    buffer.guessSegmentProperties()
    const scale = Math.round(item.run.size * scalePerPx)
    font.setScale(scale, scale)
    hb.shape(font, buffer, item.run.tracking === 0 ? [] : noLigatures)
    return buffer.getGlyphInfos()
  }

  function properties(points: readonly number[]): number {
    return points.reduce((found, cp) => found | breaker.properties(cp), 0)
  }

  function presentation(points: readonly number[], flags: number) {
    if ((flags & emoji) !== 0 && points.includes(0xfe0e)) return "text"
    if ((flags & emojiPresentation) !== 0 || ((flags & emoji) !== 0 && points.includes(0xfe0f))) return "color"
    if (points.includes(0x20e3) || ((flags & extendedPictographic) !== 0 && points.includes(0x200d))) return "color"
    return undefined
  }

  const shapeLine: FontLayoutEngine["shapeLine"] = ({ paragraph, range, lineEnding }) => {
    const { text, locale, sourceOffsetByTextOffset: source } = paragraph
    const sourceRange = (start: number, end: number) => ({ start: source[start] ?? start, end: source[end] ?? end })
    let prepared = paragraphs.get(paragraph)
    if (prepared === undefined) {
      prepared = {
        graphemes: breaker.breaks(paragraph).graphemes,
        levels: bidi.getEmbeddingLevels(text, paragraph.direction === "auto" ? undefined : paragraph.direction).levels,
        runs: shapingRuns(paragraph.runs),
      }
      paragraphs.set(paragraph, prepared)
    }
    const { graphemes, levels, runs } = prepared
    const items: Item[] = []
    const line = text.slice(range.start, range.end)
    let runAt = 0
    let script: string | undefined
    for (let at = firstAfter(graphemes, range.start); at < graphemes.length; at++) {
      const start = Math.max(range.start, graphemes[at - 1]!)
      if (start >= range.end) break
      const end = Math.min(graphemes[at]!, range.end)
      const cluster = Array.from(text.slice(start, end), (char) => char.codePointAt(0)!)
      const flags = properties(cluster)
      const wanted = presentation(cluster, flags)
      const clusterScript = cluster.map(breaker.script).find((tag) => tag !== undefined)
      script = clusterScript ?? script
      for (let from = start; from < end;) {
        while (runs[runAt] !== undefined && runs[runAt]!.range.end <= from) runAt++
        const run = runs[runAt]
        if (run === undefined || run.range.start > from) return { kind: "unserved", range: sourceRange(from, end) }
        const to = Math.min(end, run.range.end)
        const points = Array.from(text.slice(from, to), (char) => char.codePointAt(0)!)
        const visible = points.some((cp) => (breaker.properties(cp) & ignorable) === 0)
        const trackedClusters = visible && from === start ? 1 : 0
        const level = levels[from] ?? 0
        const ordered =
          wanted === "color"
            ? [
                ...run.faces.filter((face) => face.presentation === "color"),
                ...run.faces.filter((face) => face.presentation !== "color"),
              ]
            : run.faces
        let selected: Item | undefined
        for (const face of ordered) {
          if (
            (wanted === "text" && face.presentation === "color") ||
            ((flags & emoji) !== 0 && points.includes(0xfe0f) && face.presentation !== "color")
          )
            continue
          const font = faces.font(face)
          if (font === undefined) return { kind: "pending", range: sourceRange(start, end), face }
          const item = { start: from, end: to, run, level, script, face, trackedClusters }
          const variationMissing = points.some((cp, index) => {
            const selector = (cp >= 0xfe00 && cp <= 0xfe0f) || (cp >= 0xe0100 && cp <= 0xe01ef)
            if (!selector || index === 0 || (wanted !== undefined && (cp === 0xfe0e || cp === 0xfe0f))) return false
            return !font.variationGlyph(points[index - 1]!, cp)
          })
          if (variationMissing) continue
          const explicitSequence =
            wanted === "color" &&
            points.length > 1 &&
            (points.includes(0x200d) ||
              points.includes(0x20e3) ||
              points.some(
                (cp) =>
                  (cp >= 0x1f1e6 && cp <= 0x1f1ff) ||
                  (cp >= 0x1f3fb && cp <= 0x1f3ff) ||
                  (cp >= 0xe0020 && cp <= 0xe007f),
              ))
          if (explicitSequence && face.presentation !== "color") continue
          const mapped = points.every((cp) => (breaker.properties(cp) & ignorable) !== 0 || font.nominalGlyph(cp))
          if (!mapped || explicitSequence) {
            const probe = shape(font, item, line, range.start, locale)
            if (
              probe.length === 0 ||
              probe.some((glyph) => glyph.codepoint === 0) ||
              (explicitSequence && probe.length !== 1)
            )
              continue
          }
          selected = item
          break
        }
        if (selected === undefined) return { kind: "unserved", range: sourceRange(start, end) }
        const last = items.at(-1)
        if (
          last !== undefined &&
          sameFace(last.face, selected.face) &&
          sameMetrics(last.run, run) &&
          last.level === level &&
          (last.script === script || last.script === undefined)
        ) {
          last.end = to
          last.script = script
          last.trackedClusters += trackedClusters
        } else items.push(selected)
        from = to
      }
    }
    const last = items.at(-1)
    const shown =
      lineEnding === "discretionary-hyphen" && line.endsWith("\u00ad") && last !== undefined
        ? line.slice(0, -1) + (faces.font(last.face)?.nominalGlyph(0x2010) ? "‐" : "-")
        : line
    const glyphs: LayoutGlyph[] = []
    const intervals: { range: { start: number; end: number }; face: LayoutFace }[] = []
    let advance = 0
    for (const item of items) {
      const font = faces.font(item.face)
      if (font === undefined) return { kind: "pending", range: sourceRange(item.start, item.end), face: item.face }
      const shaped = shape(font, item, shown, range.start, locale)
      const missing = shaped.find((glyph) => glyph.codepoint === 0)
      if (missing !== undefined) {
        const endAt = firstAfter(graphemes, range.start + missing.cluster)
        return {
          kind: "unserved",
          range: sourceRange(graphemes[endAt - 1] ?? item.start, graphemes[endAt] ?? item.end),
        }
      }
      glyphs.push(
        ...shaped.map((glyph) => ({
          cluster: source[range.start + glyph.cluster] ?? range.start + glyph.cluster,
          id: glyph.codepoint,
          unsafeToBreak: (glyph.flags & hb.GlyphFlag.UNSAFE_TO_BREAK) !== 0,
        })),
      )
      const previous = intervals.at(-1)
      if (previous !== undefined && sameFace(previous.face, item.face))
        previous.range.end = source[item.end] ?? item.end
      else intervals.push({ range: sourceRange(item.start, item.end), face: item.face })
      advance += buffer.getGlyphPositions().reduce((sum, position) => sum + position.xAdvance, 0) / scalePerPx
      advance += item.trackedClusters * item.run.tracking
    }
    return { kind: "shaped", range: sourceRange(range.start, range.end), advance, faces: intervals, glyphs }
  }

  return {
    breaks: breaker.breaks,
    shapeLine,
    prepareFace: (asset) => faces.prepare(asset),
    cache: () => faces.cache(),
  }
}
