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
import { flowWith } from "./layout-flow.js"

type Run = LayoutParagraph["runs"][number]
type Item = {
  readonly start: number
  end: number
  readonly run: Run
  readonly level: number
  readonly face: LayoutFace
  readonly provisional?: true
  script: string | undefined
  trackedClusters: number
}

const faceBudget = 48 * 1024 * 1024
const pinnedFaceCap = 128 * 1024 * 1024
const scalePerPx = 65536
const ignorable = 1
const emoji = 2
const emojiPresentation = 4
const extendedPictographic = 8
const printableAscii = /^[ -~]*$/u
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
  return (
    a.size === b.size &&
    a.tracking === b.tracking &&
    a.stack === b.stack &&
    a.faces.length === b.faces.length &&
    a.faces.every((face, index) => sameFace(face, b.faces[index]!))
  )
}

function shapingRuns(runs: LayoutParagraph["runs"]): readonly Run[] {
  const joined: Run[] = []
  for (const run of runs) {
    const previous = joined.at(-1)
    if (previous !== undefined && previous.range.end === run.range.start && sameMetrics(previous, run)) {
      joined[joined.length - 1] = { ...previous, range: { start: previous.range.start, end: run.range.end } }
    } else joined.push(run)
  }
  return joined
}

export function createFontLayout(): Promise<FontLayoutEngine> {
  return (engine ??= initializeLayout().catch((error: unknown) => {
    engine = undefined
    throw error
  }))
}

async function initializeLayout(): Promise<FontLayoutEngine> {
  const [, breaker] = await Promise.all([hb.initialize(), loadBreaker()])
  if (hb.versionString() !== fontLayoutRevision.harfBuzz) throw new Error("HarfBuzz revision changed")
  const faces = new LayoutFaces(faceBudget, pinnedFaceCap)
  const buffer = new hb.Buffer()
  const noLigatures = ["liga", "clig"].map((tag) => new hb.Feature(tag, 0, 0, 0xffffffff))
  const contextualSpacing = new hb.Feature("chws", 1, 0, 0xffffffff)
  const spacingFeatures = new WeakMap<hb.Font, ReadonlySet<string>>()
  const paragraphs = new WeakMap<
    LayoutParagraph,
    {
      readonly graphemes: readonly number[]
      readonly levels: Uint8Array
      readonly runs: readonly Run[]
    }
  >()

  function shape(font: hb.Font, item: Item, line: string, start: number, locale: string, spacing = false) {
    buffer.reset()
    buffer.addText(line, item.start - start, item.end - item.start)
    buffer.setDirection(item.level % 2 === 0 ? hb.Direction.LTR : hb.Direction.RTL)
    buffer.setLanguage(locale)
    if (item.script !== undefined) buffer.setScript(item.script)
    buffer.guessSegmentProperties()
    const scale = Math.round(item.run.size * scalePerPx)
    font.setScale(scale, scale)
    const features = item.run.tracking === 0 ? [] : [...noLigatures]
    if (spacing && /[\u2018-\u201f\u3000-\u303f\uff00-\uffef]/u.test(line)) {
      let supported = spacingFeatures.get(font)
      if (supported === undefined) {
        supported = new Set(font.face.getTableFeatureTags("GPOS"))
        spacingFeatures.set(font, supported)
      }
      if (supported.has("halt")) {
        if (supported.has("chws")) features.push(contextualSpacing)
        const open = /[（［｛〔〈《「『【〘〖〝]/u
        const close = /[、。，．！？：；）］｝〕〉》」』】〙〗〟]/u
        const from = item.start - start
        const end = item.end - start
        for (let at = from; at < end; at++) {
          const char = line[at]!
          const previous = line[at - 1] ?? ""
          const next = line[at + 1] ?? ""
          if (
            (open.test(char) &&
              (at === from || !supported.has("chws")) &&
              (open.test(previous) || close.test(previous))) ||
            (close.test(char) && (at === end - 1 || !supported.has("chws")) && close.test(next))
          )
            features.push(new hb.Feature("halt", 1, at, at + 1))
        }
      }
    }
    hb.shape(font, buffer, features)
    return buffer.getGlyphInfos()
  }

  function presentation(points: readonly number[], flags: number): "text" | "color" | undefined {
    if ((flags & emoji) !== 0 && points.includes(0xfe0e)) return "text"
    if ((flags & emojiPresentation) !== 0 || ((flags & emoji) !== 0 && points.includes(0xfe0f))) return "color"
    if (points.includes(0x20e3) || ((flags & extendedPictographic) !== 0 && points.includes(0x200d))) return "color"
    return undefined
  }

  const clusters = new Map<string, ReturnType<typeof analyzeCluster>>()
  const directions = new Map<string, ReturnType<typeof bidi.getEmbeddingLevels>>()
  const leftToRight = new Uint8Array()

  function analyzeCluster(cluster: string) {
    const points = Array.from(cluster, (char) => char.codePointAt(0)!)
    const properties = points.map(breaker.properties)
    const flags = properties.reduce((found, value) => found | value, 0)
    return {
      points,
      visible: points.filter((_, index) => (properties[index]! & ignorable) === 0),
      flags,
      wanted: presentation(points, flags),
      script: points.map(breaker.script).find((tag) => tag !== undefined),
    }
  }

  function clusterOf(cluster: string) {
    const cached = clusters.get(cluster)
    if (cached !== undefined) return cached
    const analysis = analyzeCluster(cluster)
    if (cluster.length <= 32) {
      if (clusters.size >= 1024) clusters.clear()
      clusters.set(cluster, analysis)
    }
    return analysis
  }

  function embedding(text: string, direction: LayoutParagraph["direction"]) {
    if (direction !== "rtl" && printableAscii.test(text)) return undefined
    const key = direction + ":" + text
    const cached = directions.get(key)
    if (cached !== undefined) return cached
    const analysis = bidi.getEmbeddingLevels(text, direction === "auto" ? undefined : direction)
    if (text.length <= 4096) {
      if (directions.size >= 64) directions.clear()
      directions.set(key, analysis)
    }
    return analysis
  }

  const shapeLine: FontLayoutEngine["shapeLine"] = ({
    paragraph,
    range,
    lineEnding,
    missingFace,
    contextualSpacing,
  }) => {
    const { text, locale, sourceOffsetByTextOffset: source } = paragraph
    const sourceRange = (start: number, end: number) => ({ start: source[start] ?? start, end: source[end] ?? end })
    let prepared = paragraphs.get(paragraph)
    if (prepared === undefined) {
      prepared = {
        graphemes: breaker.graphemes(text),
        levels: embedding(text, paragraph.direction)?.levels ?? leftToRight,
        runs: shapingRuns(paragraph.runs),
      }
      paragraphs.set(paragraph, prepared)
    }
    const { graphemes, levels, runs } = prepared
    const items: Item[] = []
    const fonts = new Map<LayoutFace, hb.Font>()
    const fontFor = (face: LayoutFace) => {
      const cached = fonts.get(face)
      if (cached !== undefined) return cached
      const font = faces.font(face)
      if (font !== undefined) fonts.set(face, font)
      return font
    }
    const line = text.slice(range.start, range.end)
    let display = line
    let runAt = 0
    let script: string | undefined
    for (let at = firstAfter(graphemes, range.start); at < graphemes.length; at++) {
      const start = Math.max(range.start, graphemes[at - 1]!)
      if (start >= range.end) break
      const end = Math.min(graphemes[at]!, range.end)
      const cluster = clusterOf(text.slice(start, end))
      const { flags, wanted } = cluster
      script = cluster.script ?? script
      for (let from = start; from < end;) {
        while (runs[runAt] !== undefined && runs[runAt]!.range.end <= from) runAt++
        const run = runs[runAt]
        if (run === undefined || run.range.start > from) return { kind: "unserved", range: sourceRange(from, end) }
        const to = Math.min(end, run.range.end)
        const { points, visible } = from === start && to === end ? cluster : clusterOf(text.slice(from, to))
        const trackedClusters = visible.length > 0 && from === start ? 1 : 0
        const level = levels[from] ?? 0
        const fallback = () => run.fallback?.(text.slice(from, to), wanted) ?? []
        const ordered =
          wanted === "color"
            ? [
                ...run.faces.filter((face) => face.presentation === "color"),
                ...run.faces.filter((face) => face.presentation !== "color"),
              ]
            : run.faces
        let selected: Item | undefined
        function* colorFirst() {
          yield* fallback()
          yield* ordered
        }
        let offered: Iterable<LayoutFace | "loading"> =
          wanted === "color" && !ordered.some((face) => face.presentation === "color") ? colorFirst() : ordered
        for (let attempt = 0; attempt < 2; attempt++) {
          for (const face of offered) {
            if (face === "loading") {
              if (missingFace !== undefined)
                selected = {
                  start: from,
                  end: to,
                  run,
                  level,
                  script,
                  face: missingFace,
                  trackedClusters,
                  provisional: true,
                }
              break
            }
            if (
              (wanted === "text" && face.presentation === "color") ||
              ((flags & emoji) !== 0 && points.includes(0xfe0f) && face.presentation !== "color")
            )
              continue
            const font = fontFor(face)
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
            const mapped = visible.every((cp) => font.nominalGlyph(cp))
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
          if (selected !== undefined || wanted === "color" || run.fallback === undefined) break
          offered = fallback()
        }
        if (selected === undefined) {
          if (missingFace === undefined) return { kind: "unserved", range: sourceRange(start, end) }
          display =
            display.slice(0, from - range.start) +
            "?" +
            "\u2060".repeat(to - from - 1) +
            display.slice(to - range.start)
          selected = { start: from, end: to, run, level, script, face: missingFace, trackedClusters }
        }
        const last = items.at(-1)
        if (
          last !== undefined &&
          sameFace(last.face, selected.face) &&
          last.provisional === selected.provisional &&
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
      lineEnding === "discretionary-hyphen" && display.endsWith("\u00ad") && last !== undefined
        ? display.slice(0, -1) + (fontFor(last.face)?.nominalGlyph(0x2010) ? "‐" : "-")
        : display
    const glyphs: LayoutGlyph[] = []
    const intervals: { range: { start: number; end: number }; face: LayoutFace }[] = []
    let advance = 0
    for (const item of items) {
      const font = fontFor(item.face)
      if (font === undefined) return { kind: "pending", range: sourceRange(item.start, item.end), face: item.face }
      const shaped = shape(font, item, shown, range.start, locale, contextualSpacing)
      const missing = shaped.find((glyph) => glyph.codepoint === 0)
      if (missing !== undefined && !item.provisional) {
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
    return {
      kind: "shaped",
      range: sourceRange(range.start, range.end),
      advance,
      faces: intervals,
      glyphs,
      ...(shown === line ? {} : { display: shown }),
    }
  }

  return {
    breaks: breaker.breaks,
    shapeLine,
    prepareFace: (asset) => faces.prepare(asset),
    pinFace: (revision, key, priority) => faces.pin(revision, key, priority),
    hasFace: (face) => faces.has(face),
    cache: () => faces.cache(),
    flow: flowWith({ breaks: breaker.breaks, shapeLine }, (text) =>
      (embedding(text, "auto")?.paragraphs[0]?.level ?? 0) === 1 ? "rtl" : "ltr",
    ),
  }
}
