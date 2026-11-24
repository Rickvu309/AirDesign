import { type FontWidths, fontFace } from "@airdesign/doom"
import * as doom from "@airdesign/doom"
import { fallbackFont, fontFamily, servedFontName } from "@airdesign/fonts"
import { fontsFor, waitForPaintFonts } from "./font-load.js"

export const pinnedOpticalSize = 32
const em = pinnedOpticalSize

type Measured = {
  readonly stack: string
  readonly advances: Record<string, number>
  readonly kerning: Record<string, number>
  readonly pairs: ReadonlySet<string>
  readonly ascent: number
  readonly descent: number
}

type Held = {
  readonly faces: Map<string, Measured>
  readonly covered: Set<string>
  widths: FontWidths
}

const coveredLimit = 4096

const held = new WeakMap<Document, Held>()

function heldFor(doc: Document): Held {
  let kept = held.get(doc)
  if (kept === undefined) {
    kept = { faces: new Map(), covered: new Set(), widths: {} }
    held.set(doc, kept)
  }
  return kept
}

function stackNames(faces: readonly doom.Face[]): readonly string[] {
  return [...new Set([fallbackFont, ...faces.flatMap(({ font }) => servedFontName(font) ?? [])])]
}

export function facesOnSlides(value: doom.Doom, slides: readonly doom.NodeId[]): doom.FaceNeeds {
  const layers = slides.flatMap((slide) => doom.descendantsOf(value, slide).map((node) => node.id))
  return doom.doomFaces(value, layers)
}

export async function waitForDoomFonts(
  doc: Document,
  value: doom.Doom,
  slides: readonly doom.NodeId[],
): Promise<boolean> {
  const loader = fontsFor(doc)
  return loader === undefined || loader.wait(stackNames(facesOnSlides(value, slides).faces))
}

export function measureReady(doc: Document, needs: doom.FaceNeeds): boolean {
  const loader = fontsFor(doc)
  return loader === undefined || stackNames(needs.faces).every((name) => loader.ready(name))
}

export function pendingDoomFonts(doc: Document, value: doom.Doom): readonly string[] {
  const waiting = new Set(fontsFor(doc)?.pendingNames())
  if (waiting.size === 0) return []
  return stackNames(doom.doomFaces(value).faces).filter((name) => waiting.has(name.toLowerCase()))
}

export function bakeFontState(doc: Document, value: doom.Doom, frame: doom.NodeId): "ready" | "pending" | "failed" {
  const loader = fontsFor(doc)
  if (loader === undefined) return "ready"
  const { required } = doom.bakeTextLayers(value, frame)
  if (required.length === 0) return "ready"
  const { theme } = doom.deckOf(value)
  const used = new Set(
    required.flatMap((id) => {
      const text = doom.propOf(value.nodes.get(id), "text")
      return text === undefined ? [] : [...doom.charsByFace(text, theme).keys()]
    }),
  )
  const names = stackNames(
    doom.doomFaces(value, required).faces.filter((face) => used.has(fontFace(face.font, face.bold, face.italic))),
  )
  if (names.some((name) => loader.failed(name))) return "failed"
  return names.every((name) => loader.ready(name)) ? "ready" : "pending"
}

export async function measureFaces(doc: Document, needs: doom.FaceNeeds): Promise<FontWidths | null> {
  const kept = heldFor(doc)
  const loader = fontsFor(doc)
  if (loader !== undefined)
    await waitForPaintFonts(Promise.all(stackNames(needs.faces).map((name) => loader.load(name))))
  const stack = (face: doom.Face) =>
    stackNames([face])
      .filter((name) => loader?.ready(name))
      .join(",")
  const faceIsNew = needs.faces.some(
    (face) => kept.faces.get(fontFace(face.font, face.bold, face.italic))?.stack !== stack(face),
  )
  if (kept.covered.size > coveredLimit) kept.covered.clear()
  const texts = faceIsNew ? needs.texts : needs.texts.filter((text) => !kept.covered.has(text))
  const { chars, pairs } = doom.fontSamples(texts, new Set(["x"]))
  const wanted = needs.faces.filter((face) => {
    const done = kept.faces.get(fontFace(face.font, face.bold, face.italic))
    if (done === undefined || done.stack !== stack(face)) return true
    for (const char of chars) if (done.advances[char] === undefined) return true
    for (const pair of pairs.keys()) if (!done.pairs.has(pair)) return true
    return false
  })
  if (wanted.length === 0) {
    for (const text of texts) kept.covered.add(text)
    return kept.widths
  }
  const context = doc.createElement("canvas").getContext("2d")
  if (context === null) return loader === undefined ? kept.widths : null
  const sample = [...chars].join("")
  for (const face of wanted) {
    const font = `${face.italic ? "italic" : "normal"} ${face.bold ? 700 : 400} ${String(em)}px ${fontFamily(face.font)}`
    if (loader === undefined && !doc.fonts.check(font, sample)) return null
    context.font = font
    context.fontKerning = "normal"
    context.textRendering = "geometricPrecision"
    const name = fontFace(face.font, face.bold, face.italic)
    const loaded = stack(face)
    const cached = kept.faces.get(name)
    const before = cached?.stack === loaded ? cached : undefined
    const advances: Record<string, number> = { ...before?.advances }
    for (const char of chars) advances[char] ??= context.measureText(char).width / em
    const kerning: Record<string, number> = { ...before?.kerning }
    const seen = new Set(before?.pairs)
    for (const [pair, [left, right]] of pairs) {
      if (seen.has(pair)) continue
      seen.add(pair)
      const gap = context.measureText(pair).width / em - (advances[left] ?? 0) - (advances[right] ?? 0)
      if (Math.abs(gap) > 1e-6) kerning[pair] = gap
    }
    const metrics =
      before === undefined
        ? (() => {
            const found = context.measureText("x")
            return { ascent: found.fontBoundingBoxAscent / em, descent: found.fontBoundingBoxDescent / em }
          })()
        : before
    kept.faces.set(name, {
      stack: loaded,
      advances,
      kerning,
      pairs: seen,
      ascent: metrics.ascent,
      descent: metrics.descent,
    })
  }
  if (needs.faces.every((face) => kept.faces.has(fontFace(face.font, face.bold, face.italic))))
    for (const text of texts) kept.covered.add(text)
  kept.widths = Object.fromEntries(
    [...kept.faces].map(([name, done]) => [
      name,
      { ascent: done.ascent, descent: done.descent, advances: done.advances, kerning: done.kerning },
    ]),
  )
  return kept.widths
}

export async function measureDoom(doc: Document, value: doom.Doom): Promise<doom.Measure> {
  const widths = await measureFaces(doc, doom.doomFaces(value))
  if (widths === null) throw new Error("Font metrics unavailable")
  return doom.measureWith(widths)
}
