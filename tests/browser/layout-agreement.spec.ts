import { expect } from "@playwright/test"
import { test } from "./deck-test"

type Widths = Record<
  string,
  { ascent: number; descent: number; advances: Record<string, number>; kerning: Record<string, number> }
>

const vietnamese = "Doanh thu quý 3 tăng 12% lên 48,2 triệu đô la, biên lợi nhuận giữ ở mức 31%"
const families = [
  { family: "Inter", scripts: "all" },
  { family: "Lora", scripts: "all" },
  { family: "Liberation Sans Narrow", scripts: "latin" },
] as const
const styles = ["title", "heading", "body", "caption"] as const
const boxWidths = [480, 900, 1600]
const notWords = new Set(["op", "kind", "slide", "into", "textStyle", "icon", "fill", "color", "layout", "align"])

function wordsOf(value: unknown, key = ""): readonly string[] {
  if (typeof value === "string") return notWords.has(key) ? [] : [value]
  if (Array.isArray(value)) return value.flatMap((each) => wordsOf(each, key))
  if (typeof value === "object" && value !== null)
    return Object.entries(value).flatMap(([at, each]) => wordsOf(each, at))
  return []
}

test("the server breaks and stacks every line where the canvas paints it, in each family and script", async ({
  page,
}) => {
  const root = process.cwd()
  const { packageBuild } = await import("../../scripts/package-build.mjs")
  const doom = await packageBuild(root, "@airdesign/doom")
  const { servedFontMetrics, FontSource } = await packageBuild(root, "@airdesign/api")
  const { fontShelf, offShelf, shelfFolder } = await import("../../scripts/font-shelf.mjs")
  const metrics = servedFontMetrics(new FontSource(fontShelf(shelfFolder), offShelf))
  const sample: readonly string[] = wordsOf(doom.boardDeckChanges(["s:1", "s:2", "s:3", "s:4", "s:5"]))
  expect(sample.length).toBeGreaterThan(20)
  await page.goto("/fonts/family?family=Inter")
  for (const { family, scripts } of families) {
    const words = scripts === "all" ? [...sample, vietnamese] : sample
    const faces = [false, true].map((bold) => ({ font: family, bold, italic: false }))
    const served = await metrics.widths({ faces, texts: words })
    expect(typeof served, family).toBe("object")
    const painted: Widths = await page.evaluate(
      async ({ family, faces, words, keys }) => {
        const manifest = await (await fetch(`/fonts/family?family=${encodeURIComponent(family)}`)).json()
        for (const face of manifest.faces) {
          const loaded = await new FontFace(manifest.family, `url("${face.url}")`, {
            style: face.style,
            weight: face.weight,
          }).load()
          document.fonts.add(loaded)
        }
        const context = document.createElement("canvas").getContext("2d")!
        const out: Widths = {}
        for (const [at, face] of faces.entries()) {
          context.font = `normal ${face.bold ? 700 : 400} 32px "${manifest.family}"`
          context.fontKerning = "normal"
          context.textRendering = "geometricPrecision"
          const width = (text: string) => context.measureText(text).width / 32
          const advances: Record<string, number> = {}
          const kerning: Record<string, number> = {}
          for (const text of words) {
            const letters = [...text]
            for (const char of letters) advances[char] ??= width(char)
            for (let next = 1; next < letters.length; next += 1) {
              const pair = letters[next - 1]! + letters[next]!
              if (pair in kerning) continue
              kerning[pair] = width(pair) - advances[letters[next - 1]!]! - advances[letters[next]!]!
            }
          }
          out[keys[at]!] = { ascent: 0, descent: 0, advances, kerning }
        }
        return out
      },
      { family, faces, words, keys: faces.map((face) => doom.fontFace(face.font, face.bold, face.italic)) },
    )
    const theme = { ...doom.defaultTheme, fonts: { heading: family, body: family } }
    const canvas = doom.measureWith(painted)
    const server = doom.measureWith(served.widths)
    for (const chars of words)
      for (const style of styles)
        for (const width of boxWidths) {
          const text = { ...doom.textFromMarkdown(chars, style), resize: "fixed" }
          const shape = (measured: { h: number; lines: readonly { start: number; end: number }[] }) => ({
            h: measured.h,
            breaks: measured.lines.map((line) => [line.start, line.end]),
          })
          expect(shape(server(text, theme, width)), `${family} ${style} ${String(width)}: ${chars}`).toEqual(
            shape(canvas(text, theme, width)),
          )
        }
  }
  const missing = { ...doom.defaultTheme, fonts: { heading: "Liberation Sans Narrow", body: "Liberation Sans Narrow" } }
  const deck = doom.doomFromTree({
    theme: missing,
    slides: [{ children: [{ type: "shape", props: { text: doom.textFromMarkdown(vietnamese, "body") } }] }],
  })
  const unread = await metrics.measure([deck.doom])
  expect(typeof unread === "string" ? unread : [...unread.missing].sort()).toEqual([..."ệợậữởứ"].sort())
})
