import { fontFace, type FontWidths, type ResolvedText } from "@airdesign/document"
import { fontFamily } from "@airdesign/fonts"
import { fontsFor } from "@airdesign/render"
import { pageFont } from "@/judged-slide"

type Face = { readonly font: string; readonly bold: boolean; readonly italic: boolean }
type Need = { readonly face: Face; readonly chars: Set<string>; readonly pairs: Set<string> }
type Measured = {
  readonly ascent: number
  readonly descent: number
  readonly advances: Record<string, number>
  readonly kerning: Record<string, number>
}

const em = 1000
const kept = new Map<string, Measured>()

function needOf(needs: Map<string, Need>, face: Face, text: string): void {
  const key = fontFace(face.font, face.bold, face.italic)
  const need = needs.get(key) ?? { face, chars: new Set(["x"]), pairs: new Set<string>() }
  needs.set(key, need)
  let previous: string | undefined
  for (const char of text) {
    need.chars.add(char)
    if (previous !== undefined) need.pairs.add(previous + char)
    previous = char
  }
}

export function textNeeds(texts: readonly ResolvedText[]): ReadonlyMap<string, Need> {
  const needs = new Map<string, Need>()
  for (const text of texts)
    for (const paragraph of text.paragraphs) {
      needOf(needs, { font: paragraph.end.font, bold: false, italic: false }, "")
      if (paragraph.bullet !== null)
        needOf(needs, { font: paragraph.bullet.font, bold: false, italic: false }, paragraph.bullet.text)
      for (const run of paragraph.runs) needOf(needs, { font: run.font, bold: run.bold, italic: run.italic }, run.text)
    }
  return needs
}

function cssFont(face: Face, sans: string): string {
  const family = face.font === pageFont ? sans : fontFamily(face.font).replace("var(--font-sans)", sans)
  return `${face.italic ? "italic" : "normal"} ${face.bold ? 700 : 400} ${String(em)}px ${family}`
}

function measuredFace(
  context: CanvasRenderingContext2D,
  font: string,
  need: Need,
  held: Measured | undefined,
): Measured {
  context.font = font
  context.fontKerning = "normal"
  const advances = { ...held?.advances }
  const kerning = { ...held?.kerning }
  for (const char of need.chars) advances[char] ??= context.measureText(char).width / em
  for (const pair of need.pairs) {
    if (Object.hasOwn(kerning, pair)) continue
    const [left = "", right = ""] = [...pair]
    const gap = context.measureText(pair).width / em - (advances[left] ?? 0) - (advances[right] ?? 0)
    kerning[pair] = Math.abs(gap) > 1e-6 ? gap : 0
  }
  if (held !== undefined) return { ascent: held.ascent, descent: held.descent, advances, kerning }
  const metrics = context.measureText("x")
  return {
    ascent: metrics.fontBoundingBoxAscent / em,
    descent: metrics.fontBoundingBoxDescent / em,
    advances,
    kerning,
  }
}

export async function measuredWidths(doc: Document, texts: readonly ResolvedText[]): Promise<FontWidths> {
  const context = doc.createElement("canvas").getContext("2d")
  if (context === null) return {}
  const needs = textNeeds(texts)
  const loader = fontsFor(doc)
  const names = [...new Set([...needs.values()].map(({ face }) => face.font))].filter((name) => name !== pageFont)
  await Promise.all(names.map((name) => loader?.load(name)))
  const sans = getComputedStyle(doc.documentElement).getPropertyValue("--font-sans").trim()
  const widths: Record<string, FontWidths[string]> = {}
  for (const [key, need] of needs) {
    const font = cssFont(need.face, sans)
    const sample = [...need.chars].join("")
    await doc.fonts.load(font, sample).catch(() => [])
    if (!doc.fonts.check(font, sample)) continue
    const measured = measuredFace(context, font, need, kept.get(`${key}|${sans}`))
    kept.set(`${key}|${sans}`, measured)
    const kerning = Object.fromEntries(Object.entries(measured.kerning).filter(([, gap]) => gap !== 0))
    widths[key] = { ascent: measured.ascent, descent: measured.descent, advances: measured.advances, kerning }
  }
  return widths
}
