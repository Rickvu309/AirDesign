import { type FontWidths, type scene, fontFace } from "@airdesign/document"
import { fontFamily } from "@airdesign/fonts"
import { fontsFor } from "./font-load.js"

export const pinnedOpticalSize = 32
const em = pinnedOpticalSize

type Measured = {
  readonly advances: Record<string, number>
  readonly kerning: Record<string, number>
  readonly pairs: ReadonlySet<string>
  readonly ascent: number
  readonly descent: number
}

type Held = { readonly faces: Map<string, Measured>; widths: FontWidths }

const held = new WeakMap<Document, Held>()

function heldFor(doc: Document): Held {
  let kept = held.get(doc)
  if (kept === undefined) {
    kept = { faces: new Map(), widths: {} }
    held.set(doc, kept)
  }
  return kept
}

export async function measureFaces(doc: Document, needs: scene.FaceNeeds): Promise<FontWidths> {
  const chars = new Set(["x"])
  const pairs = new Set<string>()
  for (const text of needs.texts) {
    let previous: string | undefined
    for (const char of text) {
      chars.add(char)
      if (previous !== undefined) pairs.add(previous + char)
      previous = char
    }
  }
  const kept = heldFor(doc)
  const wanted = needs.faces.filter((face) => {
    const done = kept.faces.get(fontFace(face.font, face.bold, face.italic))
    if (done === undefined) return true
    for (const char of chars) if (done.advances[char] === undefined) return true
    for (const pair of pairs) if (!done.pairs.has(pair)) return true
    return false
  })
  if (wanted.length === 0) return kept.widths
  const context = doc.createElement("canvas").getContext("2d")
  if (context === null) return kept.widths
  const loader = fontsFor(doc)
  await Promise.all([...new Set(wanted.map((face) => face.font))].map((name) => loader?.load(name)))
  const sans = getComputedStyle(doc.documentElement).getPropertyValue("--font-sans").trim()
  const sample = [...chars].join("")
  for (const face of wanted) {
    const font = `${face.italic ? "italic" : "normal"} ${face.bold ? 700 : 400} ${String(em)}px ${fontFamily(face.font).replace("var(--font-sans)", sans)}`
    await doc.fonts.load(font, sample).catch(() => [])
    if (!doc.fonts.check(font, sample)) continue
    context.font = font
    context.fontKerning = "normal"
    context.textRendering = "geometricPrecision"
    const name = fontFace(face.font, face.bold, face.italic)
    const before = kept.faces.get(name)
    const advances: Record<string, number> = { ...before?.advances }
    for (const char of chars) advances[char] ??= context.measureText(char).width / em
    const kerning: Record<string, number> = { ...before?.kerning }
    const seen = new Set(before?.pairs)
    for (const pair of pairs) {
      if (seen.has(pair)) continue
      seen.add(pair)
      const [left = "", right = ""] = [...pair]
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
    kept.faces.set(name, { advances, kerning, pairs: seen, ascent: metrics.ascent, descent: metrics.descent })
  }
  kept.widths = Object.fromEntries(
    [...kept.faces].map(([name, done]) => [
      name,
      { ascent: done.ascent, descent: done.descent, advances: done.advances, kerning: done.kerning },
    ]),
  )
  return kept.widths
}
