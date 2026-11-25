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
import type { FontSource } from "./font-source.js"

const heldLimit = 200_000
const facesHeld = 20
const failedFor = 60_000

type Shaper = {
  readonly font: hb.Font
  readonly upem: number
  readonly buffer: hb.Buffer
  readonly ascent: number
  readonly descent: number
  readonly advances: Map<string, number>
  readonly kerning: Map<string, number>
  readonly glyphs: Map<string, boolean>
}

type Served = Awaited<ReturnType<FontSource["family"]>>
type ServedFace = Extract<Served, { ok: true }>["faces"][number]

function shaped(shaper: Shaper, text: string): hb.Buffer {
  const { buffer, font } = shaper
  buffer.clearContents()
  buffer.addText(text)
  buffer.guessSegmentProperties()
  hb.shape(font, buffer)
  return buffer
}

const advanceOf = (shaper: Shaper, text: string): number =>
  shaped(shaper, text)
    .getGlyphPositions()
    .reduce((sum, position) => sum + position.xAdvance, 0) / shaper.upem

const holds = (shaper: Shaper, char: string): boolean =>
  char < " " ||
  shaped(shaper, char)
    .getGlyphInfos()
    .every((glyph) => glyph.codepoint !== 0)

function shaperOf(bytes: Uint8Array, face: ServedFace, weight: number): Shaper {
  const hbFace = new hb.Face(new hb.Blob(bytes))
  const font = new hb.Font(hbFace)
  const [low, high] = weightRange(face)
  const axes = hbFace.getAxisInfos()
  font.setVariations([
    ...("wght" in axes ? [new hb.Variation("wght", Math.min(high, Math.max(low, weight)))] : []),
    ...("opsz" in axes ? [new hb.Variation("opsz", pinnedOpticalSize)] : []),
  ])
  const extents = font.hExtents()
  return {
    font,
    upem: hbFace.upem,
    buffer: new hb.Buffer(),
    ascent: extents.ascender / hbFace.upem,
    descent: -extents.descender / hbFace.upem,
    advances: new Map(),
    kerning: new Map(),
    glyphs: new Map(),
  }
}

export type Unmeasured = "fonts" | "time"
export type Measured = {
  readonly measure: doom.Measure
  readonly missing: doom.MissingGlyphs
  readonly pending: ReadonlySet<string>
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
  private readonly shapers = new Map<string, Promise<Shaper | "unknown" | undefined>>()
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
    return bytes === undefined ? undefined : shaperOf(bytes, chosen, weight)
  }

  private shaper(face: doom.Face): Promise<Shaper | "unknown" | undefined> {
    const key = doom.fontFace(face.font, face.bold, face.italic)
    const failedAt = this.failed.get(key)
    if (failedAt !== undefined && this.now() - failedAt < failedFor) return Promise.resolve(undefined)
    let pending = this.shapers.get(key)
    if (pending === undefined) {
      this.loading.set(key, this.now())
      pending = this.load(face).catch(() => undefined)
      void pending.then((shaper) => {
        this.loading.delete(key)
        if (shaper !== undefined) return
        this.shapers.delete(key)
        this.failed.set(key, this.now())
      })
    } else this.shapers.delete(key)
    this.shapers.set(key, pending)
    for (const old of [...this.shapers.keys()].slice(0, Math.max(0, this.shapers.size - facesHeld)))
      this.shapers.delete(old)
    return pending
  }

  private async stack(face: doom.Face): Promise<readonly Shaper[] | "fonts"> {
    const fonts = [...new Set([face.font, fallbackFont])]
    const loaded = await Promise.all(fonts.map((font) => this.shaper({ ...face, font })))
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
    const stacks = await Promise.all(
      needs.faces.map((face) => (this.hung(face, budget) ? "time" : within(this.stack(face), budget))),
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
        if (shaper.advances.size + shaper.kerning.size + shaper.glyphs.size > heldLimit) {
          shaper.advances.clear()
          shaper.kerning.clear()
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
      const kern = (pair: string, [left, right]: readonly [string, string]) => {
        const shaper = holder(left)
        if (shaper === undefined || shaper !== holder(right)) return 0
        let known = shaper.kerning.get(pair)
        if (known === undefined)
          shaper.kerning.set(pair, (known = advanceOf(shaper, pair) - advance(shaper, left) - advance(shaper, right)))
        return known
      }
      const first = stack[0]!
      widths[key] = {
        ascent: first.ascent,
        descent: first.descent,
        advances: Object.fromEntries([...chars].map((char) => [char, advance(holder(char) ?? first, char)])),
        kerning: Object.fromEntries(
          [...pairs].flatMap(([pair, letters]) => {
            const gap = kern(pair, letters)
            return Math.abs(gap) > 1e-6 ? [[pair, gap]] : []
          }),
        ),
      }
    }
    return { widths, missing, pending, timedOut: stacks.includes("time") }
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
    return { measure: doom.measureWith(read.widths, this.probe), missing: read.missing, pending: read.pending }
  }
}

type Fonts = Pick<FontSource, "family" | "file">
const held = new WeakMap<Fonts, FontMetrics>()

export function servedFontMetrics(fonts: Fonts, record?: (result: LayoutComparison) => void): FontMetrics {
  let metrics = held.get(fonts)
  if (metrics === undefined) held.set(fonts, (metrics = new FontMetrics(fonts, undefined, record)))
  return metrics
}
