import type { Page } from "@playwright/test"
import type { FontWidths } from "../../packages/doom/src/index.ts"

const styles = [
  { bold: false, italic: false },
  { bold: true, italic: false },
  { bold: false, italic: true },
  { bold: true, italic: true },
]

function quotedName(family: string): string {
  return (family.split(/,/, 1)[0] ?? "").trim().replace(/^"|"$/g, "")
}

export async function measureFaces(page: Page, families: readonly string[], chars: string): Promise<FontWidths> {
  const { packageBuild } = await import("../../scripts/package-build.mjs")
  const { fontFace } = await packageBuild(process.cwd(), "@airdesign/doom")
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
