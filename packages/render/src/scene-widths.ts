import { type FontWidths, type scene, fontFace } from "@airdesign/document"
import { fontFamily } from "@airdesign/fonts"
import { fontsFor } from "./font-load.js"

const em = 1000

export async function measureFaces(doc: Document, needs: scene.FaceNeeds): Promise<FontWidths> {
  const context = doc.createElement("canvas").getContext("2d")
  if (context === null) return {}
  const loader = fontsFor(doc)
  await Promise.all([...new Set(needs.faces.map((face) => face.font))].map((name) => loader?.load(name)))
  const sans = getComputedStyle(doc.documentElement).getPropertyValue("--font-sans").trim()
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
  const sample = [...chars].join("")
  const widths: Record<string, FontWidths[string]> = {}
  for (const face of needs.faces) {
    const font = `${face.italic ? "italic" : "normal"} ${face.bold ? 700 : 400} ${String(em)}px ${fontFamily(face.font).replace("var(--font-sans)", sans)}`
    await doc.fonts.load(font, sample).catch(() => [])
    if (!doc.fonts.check(font, sample)) continue
    context.font = font
    context.fontKerning = "normal"
    const advances: Record<string, number> = {}
    for (const char of chars) advances[char] = context.measureText(char).width / em
    const kerning: Record<string, number> = {}
    for (const pair of pairs) {
      const [left = "", right = ""] = [...pair]
      const gap = context.measureText(pair).width / em - (advances[left] ?? 0) - (advances[right] ?? 0)
      if (Math.abs(gap) > 1e-6) kerning[pair] = gap
    }
    const metrics = context.measureText("x")
    widths[fontFace(face.font, face.bold, face.italic)] = {
      ascent: metrics.fontBoundingBoxAscent / em,
      descent: metrics.fontBoundingBoxDescent / em,
      advances,
      kerning,
    }
  }
  return widths
}
