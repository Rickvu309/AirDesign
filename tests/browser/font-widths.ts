import { join } from "node:path"
import { pathToFileURL } from "node:url"
import type { Page } from "@playwright/test"
import type { FontWidths, ResolvedSlide } from "../../packages/document/src/index.ts"

export { fontFamily as cssFamily } from "../../packages/fonts/src/index.ts"
import { fontFamily as cssFamily } from "../../packages/fonts/src/index.ts"

export async function paintedFamilies(page: Page): Promise<readonly string[]> {
  return page.evaluate(() => {
    const found = new Set<string>()
    for (const node of document.querySelectorAll<HTMLElement>("[data-slide-paint] [data-paragraph]")) {
      found.add(getComputedStyle(node).fontFamily)
      found.add(getComputedStyle(node, "::before").fontFamily)
      for (const span of node.querySelectorAll("span")) found.add(getComputedStyle(span).fontFamily)
    }
    return [...found]
  })
}

const styles = [
  { bold: false, italic: false },
  { bold: true, italic: false },
  { bold: false, italic: true },
  { bold: true, italic: true },
]

function quotedName(family: string): string {
  return (family.split(",")[0] ?? "").trim().replace(/^"|"$/g, "")
}

export async function measureFaces(page: Page, families: readonly string[], chars: string): Promise<FontWidths> {
  const { fontFace } = await import(pathToFileURL(join(process.cwd(), "packages/document/dist/index.js")).href)
  const requests = families.flatMap((family) =>
    styles.map(({ bold, italic }) => ({
      family,
      bold,
      italic,
      key: fontFace(quotedName(family), bold, italic),
    })),
  )
  return page.evaluate(
    async ({ requests, chars }) => {
      const glyphs = [...new Set([...chars])]
      const context = document.createElement("canvas").getContext("2d")
      if (context === null) throw new Error("no canvas")
      const faces: Record<
        string,
        { ascent: number; descent: number; advances: Record<string, number>; kerning: Record<string, number> }
      > = {}
      for (const { family, bold, italic, key } of requests) {
        const font = `${italic ? "italic" : "normal"} ${bold ? 700 : 400} 1000px ${family}`
        await document.fonts.load(font, glyphs.join(""))
        context.font = font
        context.textRendering = "geometricPrecision"
        context.fontKerning = "normal"
        const advances: Record<string, number> = {}
        for (const glyph of glyphs) advances[glyph] = context.measureText(glyph).width / 1000
        const kerning: Record<string, number> = {}
        for (const left of glyphs)
          for (const right of glyphs) {
            const pair = context.measureText(left + right).width / 1000 - (advances[left] ?? 0) - (advances[right] ?? 0)
            if (Math.abs(pair) > 0.000001) kerning[left + right] = pair
          }
        const metrics = context.measureText("x")
        faces[key] = {
          ascent: metrics.fontBoundingBoxAscent / 1000,
          descent: metrics.fontBoundingBoxDescent / 1000,
          advances,
          kerning,
        }
      }
      return faces
    },
    { requests, chars },
  )
}

export async function paintedHeights(
  page: Page,
  boxes: readonly { readonly key: string; readonly width: number }[],
): Promise<readonly (number | null)[]> {
  return page.evaluate(
    (boxes) =>
      boxes.map(({ key, width }) => {
        const frame = document.querySelector<HTMLElement>(
          `[data-slide-paint] [data-canvas-element="${CSS.escape(key)}"]`,
        )
        if (frame === null) return null
        const scale = frame.getBoundingClientRect().width / width
        let height = 0
        for (const block of frame.querySelectorAll<HTMLElement>("[data-paragraph]")) {
          const style = getComputedStyle(block)
          height +=
            block.getBoundingClientRect().height +
            Number.parseFloat(style.marginTop) +
            Number.parseFloat(style.marginBottom)
        }
        return height / scale
      }),
    [...boxes],
  )
}

export const pageFont = "Geist Variable"

export async function slideWidths(page: Page, slides: readonly ResolvedSlide[]): Promise<FontWidths> {
  const fonts = new Set<string>([pageFont])
  const chars = new Set<string>("x")
  for (const slide of slides)
    for (const element of slide.elements)
      for (const paragraph of element.text?.paragraphs ?? []) {
        fonts.add(paragraph.end.font)
        if (paragraph.bullet !== null) {
          fonts.add(paragraph.bullet.font)
          for (const char of paragraph.bullet.text) chars.add(char)
        }
        for (const run of paragraph.runs) {
          fonts.add(run.font)
          for (const char of run.text) chars.add(char)
        }
      }
  const sans = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--font-sans"))
  const families = [...fonts].map((font) =>
    cssFamily(font === pageFont ? null : font).replace("var(--font-sans)", sans.trim()),
  )
  return measureFaces(page, families, [...chars].join(""))
}
