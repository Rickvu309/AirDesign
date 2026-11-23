import * as doom from "@airdesign/doom"
import { expect, it } from "vitest"
import { FontMetrics, measureWithin } from "./font-metrics.js"
import { FontSource } from "./font-source.js"

const family = "Liberation Sans Narrow"
const line = "Revenue grew 12% to $48.2M"
const canvas = { regular: 11.03173828125, bold: 11.39453125, kernAV: -0.06005859375 }

const widthOf = (face: doom.FontFace, words: string) =>
  [...words].reduce(
    (sum, char, at) => sum + (face.advances[char] ?? 0) + (at === 0 ? 0 : (face.kerning?.[words[at - 1]! + char] ?? 0)),
    0,
  )

const deckIn = (fonts: { heading: string; body: string }, words = line) =>
  doom.doomFromTree({
    theme: { ...doom.defaultTheme, fonts },
    slides: [
      {
        children: [
          {
            type: "shape",
            name: "title",
            props: {
              box: { x: 100, y: 100, w: 600, h: 100, rotation: 0, flipH: false, flipV: false },
              text: { ...doom.textFromMarkdown(words, "title"), resize: "fixed" },
            },
          },
        ],
      },
    ],
  })

function anyNameIsLiberation() {
  const calls: string[] = []
  const local = new FontSource(undefined)
  return {
    calls,
    source: {
      family: async (name: string) => {
        calls.push(name)
        if (name === "Never") return { ok: false, refusal: "unknown", family: name } as const
        if (name === "Slow") return new Promise<never>(() => undefined)
        return local.family(family)
      },
      file: (_name: string, file: string) => local.file(family, file),
    },
  }
}

it("reads a served face's advances and pair kerning as Chromium's canvas measures them", async () => {
  const widths = await new FontMetrics(new FontSource(undefined)).widths({
    faces: [
      { font: family, bold: false, italic: false },
      { font: family, bold: true, italic: false },
    ],
    texts: [line, "AV"],
  })
  if (typeof widths === "string") throw new Error(widths)
  const regular = widths[doom.fontFace(family, false, false)]!
  const bold = widths[doom.fontFace(family, true, false)]!
  expect(widthOf(regular, line)).toBeCloseTo(canvas.regular, 4)
  expect(widthOf(bold, line)).toBeCloseTo(canvas.bold, 4)
  expect(regular.kerning?.AV).toBeCloseTo(canvas.kernAV, 4)
  expect(regular.ascent).toBeGreaterThan(0)
})

it("measures a deck's words with its theme fonts, so a fixed box too short for them is found", async () => {
  const grown = deckIn({ heading: family, body: family })
  const measure = await new FontMetrics(new FontSource(undefined)).measure(grown.doom)
  if (typeof measure === "string") throw new Error(measure)
  expect(doom.layoutFindings(grown.doom, grown.slides, measure)).toMatchObject([
    { code: "overflow", node: grown.ids.title, room: 100 },
  ])
})

it("answers fonts when a deck's font cannot be served, and asks again only after a minute", async () => {
  const { calls, source } = anyNameIsLiberation()
  let now = 0
  const metrics = new FontMetrics(source, () => now)
  const deck = deckIn({ heading: "Never", body: family }).doom
  expect(await metrics.measure(deck)).toBe("fonts")
  now = 30_000
  expect(await metrics.measure(deck)).toBe("fonts")
  expect(calls.filter((name) => name === "Never")).toHaveLength(1)
  now = 61_000
  expect(await metrics.measure(deck)).toBe("fonts")
  expect(calls.filter((name) => name === "Never")).toHaveLength(2)
})

it("answers glyphs when the deck holds a character its font has no letter for, never a clear layout", async () => {
  const metrics = new FontMetrics(new FontSource(undefined))
  expect(await metrics.measure(deckIn({ heading: family, body: family }, "Doanh thu quý 3 tăng").doom)).not.toBe(
    "glyphs",
  )
  expect(await metrics.measure(deckIn({ heading: family, body: family }, "収益 grew 12%").doom)).toBe("glyphs")
})

it("answers time when the fonts take longer than the budget", async () => {
  const { source } = anyNameIsLiberation()
  expect(await measureWithin(new FontMetrics(source), deckIn({ heading: "Slow", body: "Slow" }).doom, 50)).toBe("time")
})

it("keeps at most twenty faces, loading the oldest again when it comes back", async () => {
  const { calls, source } = anyNameIsLiberation()
  const metrics = new FontMetrics(source)
  const faces = (name: string) => ({ faces: [{ font: name, bold: false, italic: false }], texts: ["a"] })
  for (let at = 0; at <= 20; at += 1) await metrics.widths(faces(`Face ${String(at)}`))
  await metrics.widths(faces("Face 20"))
  expect(calls.filter((name) => name === "Face 20")).toHaveLength(1)
  await metrics.widths(faces("Face 0"))
  expect(calls.filter((name) => name === "Face 0")).toHaveLength(2)
})
