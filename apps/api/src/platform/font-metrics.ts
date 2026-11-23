import * as doom from "@airdesign/doom"
import { boldWeight, regularWeight } from "@airdesign/fonts"
import * as hb from "harfbuzzjs"
import type { FontSource } from "./font-source.js"

const paintedOpticalSize = 32
const heldLimit = 200_000

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

function advanceOf(shaper: Shaper, text: string): number {
  const { buffer, font, upem } = shaper
  buffer.clearContents()
  buffer.addText(text)
  buffer.guessSegmentProperties()
  hb.shape(font, buffer)
  return buffer.getGlyphPositions().reduce((sum, position) => sum + position.xAdvance, 0) / upem
}

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

export class FontMetrics {
  private readonly fonts: Pick<FontSource, "family" | "file">
  private readonly shapers = new Map<string, Promise<Shaper | undefined>>()

  constructor(fonts: Pick<FontSource, "family" | "file">) {
    this.fonts = fonts
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
    let pending = this.shapers.get(key)
    if (pending === undefined) {
      pending = this.load(face).catch(() => undefined)
      this.shapers.set(key, pending)
      void pending.then((shaper) => {
        if (shaper === undefined) this.shapers.delete(key)
      })
    }
    return pending
  }

  async widths(needs: doom.FaceNeeds): Promise<doom.FontWidths | undefined> {
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
      if (shaper === undefined) return undefined
      if (shaper.advances.size + shaper.kerning.size > heldLimit) {
        shaper.advances.clear()
        shaper.kerning.clear()
      }
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

  async measure(fold: doom.Doom): Promise<doom.Measure | undefined> {
    const widths = await this.widths(doom.doomFaces(fold))
    return widths === undefined ? undefined : doom.measureWith(widths)
  }
}

const held = new WeakMap<FontSource, FontMetrics>()

export function metricsOf(fonts: FontSource): FontMetrics {
  let metrics = held.get(fonts)
  if (metrics === undefined) held.set(fonts, (metrics = new FontMetrics(fonts)))
  return metrics
}
