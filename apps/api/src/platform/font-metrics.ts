import * as doom from "@airdesign/doom"
import { boldWeight, regularWeight } from "@airdesign/fonts"
import * as hb from "harfbuzzjs"
import { fontSource } from "./font-route.js"
import type { FontSource } from "./font-source.js"
import type { OriginalStore } from "./original-store.js"

const paintedOpticalSize = 32
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
}

type Served = Awaited<ReturnType<FontSource["family"]>>
type ServedFace = Extract<Served, { ok: true }>["faces"][number]

function weightRange(face: ServedFace): readonly [number, number] {
  const [low = regularWeight, high = low] = face.weight.split(" ").map(Number)
  return [low, high]
}

function pickFace(faces: readonly ServedFace[], weight: number, italic: boolean): ServedFace | undefined {
  const styled = faces.filter((face) => face.style === (italic ? "italic" : "normal"))
  const pool = styled.length > 0 ? styled : faces
  const distance = (face: ServedFace) => {
    const [low, high] = weightRange(face)
    return weight < low ? low - weight : weight > high ? weight - high : 0
  }
  return [...pool].sort((one, two) => distance(one) - distance(two))[0]
}

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
    ...("opsz" in axes ? [new hb.Variation("opsz", paintedOpticalSize)] : []),
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
  }
}

export type Unmeasured = "fonts" | "glyphs" | "time"

export class FontMetrics {
  private readonly fonts: Pick<FontSource, "family" | "file">
  private readonly now: () => number
  private readonly shapers = new Map<string, Promise<Shaper | undefined>>()
  private readonly failed = new Map<string, number>()

  constructor(fonts: Pick<FontSource, "family" | "file">, now: () => number = Date.now) {
    this.fonts = fonts
    this.now = now
  }

  private async load(face: doom.Face): Promise<Shaper | undefined> {
    const served = await this.fonts.family(face.font)
    if (!served.ok) return undefined
    const weight = face.bold ? boldWeight : regularWeight
    const chosen = pickFace(served.faces, weight, face.italic)
    if (chosen === undefined) return undefined
    const bytes = await this.fonts.file(face.font, chosen.file)
    return bytes === undefined ? undefined : shaperOf(bytes, chosen, weight)
  }

  private shaper(face: doom.Face): Promise<Shaper | undefined> {
    const key = doom.fontFace(face.font, face.bold, face.italic)
    const failedAt = this.failed.get(key)
    if (failedAt !== undefined && this.now() - failedAt < failedFor) return Promise.resolve(undefined)
    let pending = this.shapers.get(key)
    if (pending === undefined) {
      pending = this.load(face).catch(() => undefined)
      void pending.then((shaper) => {
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

  async widths(needs: doom.FaceNeeds, used: ReadonlySet<string> = new Set()): Promise<doom.FontWidths | Unmeasured> {
    const chars = new Set<string>()
    const pairs = new Set<string>()
    for (const text of needs.texts) {
      const letters = [...text]
      for (const [at, char] of letters.entries()) {
        chars.add(char)
        if (at > 0) pairs.add(letters[at - 1]! + char)
      }
    }
    const widths: Record<string, doom.FontFace> = {}
    for (const face of needs.faces) {
      const shaper = await this.shaper(face)
      if (shaper === undefined) return "fonts"
      if (shaper.advances.size + shaper.kerning.size > heldLimit) {
        shaper.advances.clear()
        shaper.kerning.clear()
      }
      if (![...used].every((char) => shaper.advances.has(char) || holds(shaper, char))) return "glyphs"
      const advance = (char: string) => {
        let known = shaper.advances.get(char)
        if (known === undefined) shaper.advances.set(char, (known = advanceOf(shaper, char)))
        return known
      }
      const kern = (pair: string) => {
        let known = shaper.kerning.get(pair)
        if (known === undefined) {
          const [left = "", right = ""] = [...pair]
          shaper.kerning.set(pair, (known = advanceOf(shaper, pair) - advance(left) - advance(right)))
        }
        return known
      }
      widths[doom.fontFace(face.font, face.bold, face.italic)] = {
        ascent: shaper.ascent,
        descent: shaper.descent,
        advances: Object.fromEntries([...chars].map((char) => [char, advance(char)])),
        kerning: Object.fromEntries(
          [...pairs].map((pair) => [pair, kern(pair)]).filter(([, gap]) => Math.abs(gap as number) > 1e-6),
        ),
      }
    }
    return widths
  }

  async measure(fold: doom.Doom): Promise<doom.Measure | Unmeasured> {
    const needs = doom.doomFaces(fold)
    const used = new Set(
      [...fold.nodes.values()].flatMap((node) =>
        node.type === "shape" && node.text !== undefined ? [...node.text.chars] : [],
      ),
    )
    const widths = await this.widths(needs, used)
    return typeof widths === "string" ? widths : doom.measureWith(widths)
  }
}

export function measureWithin(
  metrics: FontMetrics,
  fold: doom.Doom,
  budget: number,
): Promise<doom.Measure | Unmeasured> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve("time"), budget)
    metrics.measure(fold).then(
      (measured) => {
        clearTimeout(timer)
        resolve(measured)
      },
      (error: unknown) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}

const held = new WeakMap<FontSource, FontMetrics>()

function metricsOf(fonts: FontSource): FontMetrics {
  let metrics = held.get(fonts)
  if (metrics === undefined) held.set(fonts, (metrics = new FontMetrics(fonts)))
  return metrics
}

export const servedFontMetrics = (store: OriginalStore | undefined): FontMetrics => metricsOf(fontSource(store))
