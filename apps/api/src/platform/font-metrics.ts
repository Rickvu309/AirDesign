import * as doom from "@airdesign/doom"
import {
  boldWeight,
  createLayoutProbe,
  fallbackFont,
  pickServedFace,
  pinnedOpticalSize,
  regularWeight,
  weightRange,
  type LayoutComparison,
} from "@airdesign/fonts"
import * as hb from "harfbuzzjs"
import { bakeMeasure } from "./bake-measure.js"
import type { FontSource } from "./font-source.js"

const heldLimit = 200_000
const facesHeld = 20
const bytesHeld = 48 * 1024 * 1024
const failedFor = 60_000

type Shaper = {
  readonly bytes: number
  readonly font: hb.Font
  readonly upem: number
  readonly ascent: number
  readonly descent: number
  readonly advances: Map<string, number>
  readonly kerning: Map<string, number>
  readonly trackedKerning: Map<string, number>
  readonly glyphs: Map<string, boolean>
}

type Served = Awaited<ReturnType<FontSource["family"]>>
type ServedFace = Extract<Served, { ok: true }>["faces"][number]

const buffer = new hb.Buffer()
const noLigatures = ["liga", "clig"].map((tag) => new hb.Feature(tag, 0, 0, 0xffffffff))

function shaped(shaper: Shaper, text: string, tracked = false): hb.Buffer {
  const { font } = shaper
  buffer.reset()
  buffer.addText(text)
  buffer.guessSegmentProperties()
  hb.shape(font, buffer, tracked ? noLigatures : undefined)
  return buffer
}

const advanceOf = (shaper: Shaper, text: string, tracked = false): number =>
  shaped(shaper, text, tracked)
    .getGlyphPositions()
    .reduce((sum, position) => sum + position.xAdvance, 0) / shaper.upem

const holds = (shaper: Shaper, char: string): boolean =>
  char < " " ||
  shaped(shaper, char)
    .getGlyphInfos()
    .every((glyph) => glyph.codepoint !== 0)

function shaperOf(bytes: Uint8Array, face: ServedFace, weight: number): Shaper {
  const blob = new hb.Blob(bytes)
  const hbFace = new hb.Face(blob)
  blob.dispose()
  const font = new hb.Font(hbFace)
  const [low, high] = weightRange(face)
  const axes = hbFace.getAxisInfos()
  font.setVariations([
    ...("wght" in axes ? [new hb.Variation("wght", Math.min(high, Math.max(low, weight)))] : []),
    ...("opsz" in axes ? [new hb.Variation("opsz", pinnedOpticalSize)] : []),
  ])
  const extents = font.hExtents()
  const upem = hbFace.upem
  hbFace.dispose()
  return {
    font,
    bytes: bytes.byteLength,
    upem,
    ascent: extents.ascender / upem,
    descent: -extents.descender / upem,
    advances: new Map(),
    kerning: new Map(),
    trackedKerning: new Map(),
    glyphs: new Map(),
  }
}

export type Unmeasured = "fonts" | "time"
export type Measured = {
  readonly measure: doom.Measure
  readonly missing: doom.MissingGlyphs
  readonly pending: ReadonlySet<string>
  readonly shared?: (fold: doom.Doom, frame: doom.NodeId) => Promise<doom.Measure | Unmeasured>
}
type Widths = {
  readonly timedOut: boolean
  readonly widths: doom.FontWidths
  readonly missing: doom.MissingGlyphs
  readonly pending: ReadonlySet<string>
}

function within<T>(work: Promise<T>, budget: number): Promise<T | "time"> {
  if (budget === Number.POSITIVE_INFINITY) return work
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve("time"), budget)
    work.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error: unknown) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}

export class FontMetrics {
  private readonly fonts: Pick<FontSource, "family" | "file">
  private readonly probe: doom.MeasureProbe | undefined
  private readonly now: () => number
  private readonly shapers = new Map<
    string,
    {
      readonly result: Promise<Shaper | "unknown" | undefined>
      bytes: number
      users: number
    }
  >()
  private bytes = 0
  private readonly failed = new Map<string, number>()
  private readonly loading = new Map<string, number>()

  constructor(
    fonts: Pick<FontSource, "family" | "file">,
    now: () => number = Date.now,
    record?: (result: LayoutComparison) => void,
  ) {
    this.fonts = fonts
    this.now = now
    this.probe =
      record === undefined
        ? undefined
        : createLayoutProbe({
            record,
            family: async (name) => {
              const manifest = await fonts.family(name)
              return !manifest.ok
                ? []
                : manifest.faces.map((face) => ({
                    ...face,
                    key: face.url,
                    read: async () => {
                      const file = await fonts.file(name, face.file)
                      if (file === undefined) throw new Error("Served face unavailable")
                      return file.buffer instanceof ArrayBuffer
                        ? new Uint8Array(file.buffer, file.byteOffset, file.byteLength)
                        : new Uint8Array(file)
                    },
                  }))
            },
          })
  }

  private async load(face: doom.Face): Promise<Shaper | "unknown" | undefined> {
    const served = await this.fonts.family(face.font)
    if (!served.ok) return "unknown"
    const weight = face.bold ? boldWeight : regularWeight
    const chosen = pickServedFace(served.faces, weight, face.italic)
    if (chosen === undefined) return "unknown"
    const bytes = await this.fonts.file(face.font, chosen.file)
    return bytes === undefined || bytes.byteLength > bytesHeld ? undefined : shaperOf(bytes, chosen, weight)
  }

  private trim(): void {
    for (const [key, cached] of this.shapers) {
      if (this.bytes <= bytesHeld && this.shapers.size <= facesHeld) break
      if (cached.users > 0 || this.loading.has(key)) continue
      this.shapers.delete(key)
      this.bytes -= cached.bytes
      void cached.result.then((shaper) => {
        if (shaper !== undefined && shaper !== "unknown") shaper.font.dispose()
      })
    }
  }

  private shaper(face: doom.Face, release: (() => void)[]): Promise<Shaper | "unknown" | undefined> {
    const key = doom.fontFace(face.font, face.bold, face.italic)
    const failedAt = this.failed.get(key)
    if (failedAt !== undefined && this.now() - failedAt < failedFor) return Promise.resolve(undefined)
    let cached = this.shapers.get(key)
    if (cached === undefined) {
      this.loading.set(key, this.now())
      const entry = { result: this.load(face).catch(() => undefined), bytes: 0, users: 0 }
      cached = entry
      void entry.result.then((shaper) => {
        this.loading.delete(key)
        if (shaper === undefined) {
          this.shapers.delete(key)
          this.failed.set(key, this.now())
        } else {
          entry.bytes = shaper === "unknown" ? 0 : shaper.bytes
          this.bytes += entry.bytes
          this.trim()
        }
      })
    } else this.shapers.delete(key)
    this.shapers.set(key, cached)
    const held = cached
    held.users++
    release.push(() => {
      held.users--
    })
    return held.result
  }

  private async stack(face: doom.Face, release: (() => void)[]): Promise<readonly Shaper[] | "fonts"> {
    const fonts = [...new Set([face.font, fallbackFont])]
    const loaded = await Promise.all(fonts.map((font) => this.shaper({ ...face, font }, release)))
    if (loaded.some((shaper) => shaper === undefined)) return "fonts"
    const stack = loaded.filter((shaper): shaper is Shaper => shaper !== undefined && shaper !== "unknown")
    return stack.length === 0 ? "fonts" : stack
  }

  private hung(face: doom.Face, budget: number): boolean {
    return [face.font, fallbackFont].some((font) => {
      const since = this.loading.get(doom.fontFace(font, face.bold, face.italic))
      return since !== undefined && this.now() - since >= budget
    })
  }

  async widths(
    needs: doom.FaceNeeds,
    used: ReadonlyMap<string, ReadonlySet<string>> = new Map(),
    budget = Number.POSITIVE_INFINITY,
  ): Promise<Widths | Unmeasured> {
    const { chars, pairs } = doom.fontSamples(needs.texts)
    const release: (() => void)[] = []
    try {
      const stacks = await Promise.all(
        needs.faces.map((face) => (this.hung(face, budget) ? "time" : within(this.stack(face, release), budget))),
      )
      const widths: Record<string, doom.FontFace> = {}
      const missing = new Map<string, Set<string>>()
      const pending = new Set<string>()
      for (const [at, face] of needs.faces.entries()) {
        const stack = stacks[at]!
        const key = doom.fontFace(face.font, face.bold, face.italic)
        if (typeof stack === "string") {
          pending.add(key)
          continue
        }
        for (const shaper of stack)
          if (
            shaper.advances.size + shaper.kerning.size + shaper.trackedKerning.size + shaper.glyphs.size >
            heldLimit
          ) {
            shaper.advances.clear()
            shaper.kerning.clear()
            shaper.trackedKerning.clear()
            shaper.glyphs.clear()
          }
        const holder = (cluster: string) =>
          stack.find((shaper) =>
            [...cluster].every((char) => {
              let held = shaper.glyphs.get(char)
              if (held === undefined) shaper.glyphs.set(char, (held = holds(shaper, char)))
              return held
            }),
          )
        const absent = [...(used.get(key) ?? [])].filter((char) => holder(char) === undefined)
        if (absent.length > 0) missing.set(key, new Set(absent))
        const advance = (shaper: Shaper, char: string) => {
          let known = shaper.advances.get(char)
          if (known === undefined) shaper.advances.set(char, (known = advanceOf(shaper, char)))
          return known
        }
        const kern = (pair: string, [left, right]: readonly [string, string], tracked: boolean) => {
          const shaper = holder(left)
          if (shaper === undefined || shaper !== holder(right)) return 0
          const table = tracked ? shaper.trackedKerning : shaper.kerning
          let known = table.get(pair)
          if (known === undefined)
            table.set(pair, (known = advanceOf(shaper, pair, tracked) - advance(shaper, left) - advance(shaper, right)))
          return known
        }
        const kernTable = (tracked: boolean) =>
          Object.fromEntries(
            [...pairs].flatMap(([pair, letters]) => {
              const gap = kern(pair, letters, tracked)
              return Math.abs(gap) > 1e-6 ? [[pair, gap]] : []
            }),
          )
        const first = stack[0]!
        widths[key] = {
          ascent: first.ascent,
          descent: first.descent,
          advances: Object.fromEntries([...chars].map((char) => [char, advance(holder(char) ?? first, char)])),
          kerning: kernTable(false),
          trackedKerning: kernTable(true),
        }
      }
      return { widths, missing, pending, timedOut: stacks.includes("time") }
    } finally {
      for (const drop of release) drop()
      this.trim()
    }
  }

  async measure(
    folds: readonly doom.Doom[],
    budget = Number.POSITIVE_INFINITY,
    layers?: readonly doom.NodeId[],
    extraTexts: readonly string[] = [],
  ): Promise<Measured | Unmeasured> {
    const used = new Map<string, Set<string>>()
    for (const fold of folds) {
      const { theme } = doom.deckOf(fold)
      const nodes = layers === undefined ? fold.nodes.values() : layers.map((id) => fold.nodes.get(id))
      for (const node of nodes)
        if (node?.type === "shape" && node.text !== undefined)
          for (const [face, chars] of doom.charsByFace(node.text, theme)) {
            let held = used.get(face)
            if (held === undefined) used.set(face, (held = new Set()))
            for (const char of chars) held.add(char)
          }
    }
    const each = folds.map((fold) => doom.doomFaces(fold, layers))
    const faces = new Map(
      each.flatMap((needs) => needs.faces).map((face) => [doom.fontFace(face.font, face.bold, face.italic), face]),
    )
    const needs = {
      faces: [...faces].flatMap(([key, face]) => (layers === undefined || used.has(key) ? [face] : [])),
      texts: [...new Set([...each.flatMap((needs) => needs.texts), ...extraTexts])],
    }
    const read = await this.widths(needs, used, budget)
    if (typeof read === "string") return read
    if (layers === undefined && read.pending.size > 0) return read.timedOut ? "time" : "fonts"
    return {
      measure: doom.measureWith(read.widths, this.probe),
      missing: read.missing,
      pending: read.pending,
      ...(layers === undefined
        ? {}
        : {
            shared: async (fold: doom.Doom, frame: doom.NodeId) => {
              let stopped = false
              try {
                return await within(
                  bakeMeasure(this.fonts, fold, frame, () => stopped),
                  budget,
                )
              } catch {
                return "fonts"
              } finally {
                stopped = true
              }
            },
          }),
    }
  }
}

type Fonts = Pick<FontSource, "family" | "file">
const held = new WeakMap<Fonts, FontMetrics>()

export function servedFontMetrics(fonts: Fonts, record?: (result: LayoutComparison) => void): FontMetrics {
  let metrics = held.get(fonts)
  if (metrics === undefined) held.set(fonts, (metrics = new FontMetrics(fonts, undefined, record)))
  return metrics
}
