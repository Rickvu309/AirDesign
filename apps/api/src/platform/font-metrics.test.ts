import * as doom from "@airdesign/doom"
import { expect, it } from "vitest"
import { FontMetrics } from "./font-metrics.js"
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
  const regular = widths.widths[doom.fontFace(family, false, false)]!
  const bold = widths.widths[doom.fontFace(family, true, false)]!
  expect(widthOf(regular, line)).toBeCloseTo(canvas.regular, 4)
  expect(widthOf(bold, line)).toBeCloseTo(canvas.bold, 4)
  expect(regular.kerning?.AV).toBeCloseTo(canvas.kernAV, 4)
  expect(regular.ascent).toBeGreaterThan(0)
})

it("measures a deck's words with its theme fonts, so a fixed box too short for them is found", async () => {
  const grown = deckIn({ heading: family, body: family })
  const measured = await new FontMetrics(new FontSource(undefined)).measure(grown.doom)
  if (typeof measured === "string") throw new Error(measured)
  expect(doom.layoutFindings(grown.doom, grown.slides, measured.measure)).toMatchObject([
    { code: "overflow", node: grown.ids.title, room: 100 },
  ])
})

it("answers fonts when a deck's font cannot be served, and asks again only after a minute", async () => {
  const { calls, source } = anyNameIsLiberation()
  let now = 0
  const metrics = new FontMetrics(source, () => now)
  const deck = deckIn({ heading: "Never", body: family }).doom
  const asked = () => calls.filter((name) => name === "Never").length
  expect(await metrics.measure(deck)).toBe("fonts")
  const first = asked()
  now = 30_000
  expect(await metrics.measure(deck)).toBe("fonts")
  expect(asked()).toBe(first)
  now = 61_000
  expect(await metrics.measure(deck)).toBe("fonts")
  expect(asked()).toBe(first * 2)
})

it("names the characters a deck's font has no letters for, and only those", async () => {
  const metrics = new FontMetrics(new FontSource(undefined))
  const read = async (words: string) => {
    const measured = await metrics.measure(deckIn({ heading: family, body: family }, words).doom)
    if (typeof measured === "string") throw new Error(measured)
    return [...measured.missing]
  }
  expect(await read("Doanh thu quý 3 tăng")).toEqual([])
  expect(await read("収益 grew 12%")).toEqual(["収", "益"])
})

it("names a missing character on every measure, not only the first", async () => {
  const metrics = new FontMetrics(new FontSource(undefined))
  const deck = deckIn({ heading: family, body: family }, "Launch 🚀").doom
  for (let time = 0; time < 3; time += 1) {
    const measured = await metrics.measure(deck)
    if (typeof measured === "string") throw new Error(measured)
    expect([...measured.missing]).toEqual(["🚀"])
  }
})

it("answers time past the budget, and at once while that font still hangs", async () => {
  const { calls, source } = anyNameIsLiberation()
  let now = 0
  const metrics = new FontMetrics(source, () => now)
  const deck = deckIn({ heading: "Slow", body: "Slow" }).doom
  expect(await metrics.measure(deck, 50)).toBe("time")
  now = 120_000
  expect(await metrics.measure(deck, 60_000)).toBe("time")
  expect(calls.filter((name) => name === "Slow")).toHaveLength(2)
})

it("asks for every face of a deck at once, not one after another", async () => {
  const asked: string[] = []
  const local = new FontSource(undefined)
  let open: () => void = () => undefined
  const gate = new Promise<void>((resolve) => (open = resolve))
  const metrics = new FontMetrics({
    family: async (name) => {
      asked.push(name)
      await gate
      return local.family(family)
    },
    file: (_name, file) => local.file(family, file),
  })
  const pending = metrics.widths({
    faces: [
      { font: "One", bold: false, italic: false },
      { font: "Two", bold: false, italic: false },
    ],
    texts: ["a"],
  })
  await Promise.resolve()
  expect(asked).toEqual(["One", "Two"])
  open()
  expect(typeof (await pending)).toBe("object")
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
